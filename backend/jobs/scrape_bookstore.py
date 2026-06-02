import requests, time, re, os
import pandas as pd
from dotenv import load_dotenv
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from app.firebase import db
from google.cloud import bigquery
from google.oauth2 import service_account


load_dotenv()


def normalize_item_name(name: str) -> set:
    """
    Strips punctutation, lowercases, and separates the string into a set of words
    Ignores common filler words
    """
    # remove special characters and lowercase the string
    clean_str = re.sub(r'[^a-z0-9\s]', ' ', str(name).lower())

    # separate battery numbers
    # ex) "aa4" -> "aa 4"
    clean_str = re.sub(r'\baa(\d+)\b', r'aa \1', clean_str)
    clean_str = re.sub(r'\baaa(\d+)\b', r'aaa \1', clean_str)

    # standardize pack strings
    clean_str = re.sub(r'(\d+)pk\b', r'\1 pack', clean_str)

    # strip Apple SKUs
    # ex) "mx532am a"
    clean_str = re.sub(r'\b[a-z0-9]{5,}\s[a-z]\b', ' ', clean_str)
    
    # built directly from analyzing the high-frequency words in bookstore_clean.csv
    aliases = {
        "jg": "julia gash",
        "ls": "long sleeve",
        "ss": "short sleeve",
        "wmns": "womens",
        "tee": "shirt",
        "nb": "notebook",
        "sub": "subject",
        "comp": "composition",
        "hood": "hoodie",
        "ua": "under armour",
        "blk": "black",
        "w": "with",
        "batteries": "battery", 
        "airtags": "airtag"    
    }
    
    # replace aliases in the string safely using word boundaries (\b)
    for abbreviation, full_word in aliases.items():
        clean_str = re.sub(rf'\b{abbreviation}\b', full_word, clean_str)
        
    words = set(clean_str.split())
    
    # discard domain-specific filler words 
    filler_words = {
        "ucsc", "uc", "santa", "cruz", 
        "the", "and", "set", "of", "in", "for", 
        "design", "favorite", "heather",
        "duracell", "pack", "apple"
    }
    
    for filler in filler_words:
        words.discard(filler)
        
    return words



def is_safe_match(csv_name: str, web_name: str) -> bool:
    """
    Verifies that the web result is actually the item requested using strict word-subset matching.
    """
    csv_words = normalize_item_name(csv_name)
    web_words = normalize_item_name(web_name)
    
    if not csv_words or not web_words:
        return False
        
    # condition 1: One name is entirely contained within the other
    if csv_words.issubset(web_words) or web_words.issubset(csv_words):
        return True
        
    # condition 2: Overlap Coefficient
    overlap = csv_words.intersection(web_words)
    match_ratio = len(overlap) / max(min(len(csv_words), len(web_words)), 1)
    
    return match_ratio >= 0.66


def extract_search_terms(raw_csv_name: str):
    """
    Cleans POS export strings and splits into Base and Variant.
    Example: "iPad : Mc9W4Ll/A" -> ("iPad", "Mc9W4Ll/A")
    """
    name = str(raw_csv_name)
    name = re.sub(r'\([^)]*\)', '', name).strip()
    
    if ":" in name:
        parts = name.split(":")
        base_name = parts[0].strip(" -")
        variant_name = parts[1].strip(" -")
        return base_name, variant_name
        
    return name.strip(" -"), None



def get_price_from_search(session: requests.Session, clean_item_name: str) -> float:
    """
    Hits the bookstore search endpoint and grabs the price of the first result
    using the injected requests.Session
    """
    base_url = "https://slugstore.ucsc.edu/api/cacheable/items"
    
    # pass the URL parameters as a dictionary
    # requests.get() will safely URL-encode spaces and special characters
    params = {
        "c": "5711120",                 
        "country": "US",
        "currency": "USD",
        "fieldset": "details",
        "language": "en",
        "limit": 1,                     
        "q": clean_item_name,           
        "use_pcv": "F"
    }
    
    headers = {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    try:
        # pass the params dictionary directly into the request
        response = session.get(base_url, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        items_list = data.get("items", [])
        
        # no results found
        if not items_list:
            return None
            
        # grab the first result
        first_item = items_list[0]
        web_title = (
            first_item.get("storedisplayname2") or 
            first_item.get("displayname") or 
            first_item.get("itemid", "")
        )

        price_detail = first_item.get("onlinecustomerprice_detail") or {}
        raw_price = (
            price_detail.get("onlinecustomerprice") or 
            first_item.get("pricelevel6") or 
            first_item.get("pricelevel2") or 
            0.0
        )
        price = float(raw_price)
        
        if not is_safe_match(clean_item_name, web_title):
            print(f"[REJECTED] CSV: '{clean_item_name}' | Web: '{web_title}'")
            return None
            
        return price
            
    except Exception as e:
        print(f"[DEBUG] API Error for {clean_item_name}: {e}")
        pass
        
    return None



def sync_all_catalog_prices(csv_path: str, retry_rejected: bool = False):
    """
    Reads all unique bookstore items, checks Firestore for existing prices AND rejected items,
    only scrapes BRAND NEW unknown items, and pushes the flagged data to DBs.
    """
    df = pd.read_csv(csv_path)
    all_unique_items = df["Item Description"].dropna().unique().tolist()
    
    total_items = len(all_unique_items)
    print(f"[INFO] Found {total_items} unique items in the CSV history.")

    print("[INFO] Checking Firestore for existing cached states...")
    doc_ref = db.collection("metadata").document("bookstore_full_pricing")
    doc = doc_ref.get()
    
    existing_prices = {}
    existing_rejected = []
    
    if doc.exists:
        data = doc.to_dict()
        existing_prices = data.get("prices", {})
        existing_rejected = data.get("rejected_items", [])
        print(f"[INFO] Found {len(existing_prices)} valid prices and {len(existing_rejected)} rejected items in Firestore.")

    if retry_rejected:
        print("[WARN] Override active: Clearing rejected cache in memory to force re-scrape...")
        existing_rejected = []
    
    # only scrape items that are NOT in the prices dict AND NOT in the rejected list
    items_to_scrape = [
        item for item in all_unique_items 
        if item not in existing_prices and item not in existing_rejected
    ]
    
    newly_scraped_prices = {}
    newly_rejected_items = []
    
    if not items_to_scrape:
        print("[SUCCESS] No new items found! Skipping web scraping entirely.")
    else:
        print(f"[INFO] Found {len(items_to_scrape)} new unknown items. Starting web scraper...")
        
        session = requests.Session()
        retries = Retry(total=3, backoff_factor=0.5, status_forcelist=[500, 502, 503, 504])
        session.mount('https://', HTTPAdapter(max_retries=retries))
        
        items_processed = 0
        total_to_scrape = len(items_to_scrape)

        for raw_item in items_to_scrape:
            items_processed += 1

            if items_processed % 50 == 0:
                print(f"[{items_processed}/{total_to_scrape}] Scraping new items...")
            
            time.sleep(0.3)

            base_term, variant_term = extract_search_terms(raw_item)
            price = get_price_from_search(session, base_term)

            # MATRIX FALLBACK
            if (price is None or price == 0.0) and variant_term:
                time.sleep(0.3)
                price = get_price_from_search(session, variant_term)

            # --- THE FLAGGING LOGIC ---
            if price is not None and price > 0.0:
                newly_scraped_prices[raw_item] = price
            else:
                newly_rejected_items.append(raw_item)       # tag it as discontinued/missing

    final_prices = {**existing_prices, **newly_scraped_prices}
    final_rejected = existing_rejected + newly_rejected_items

    if final_prices or final_rejected:
        print(f"[INFO] Uploading {len(final_prices)} valid items and {len(final_rejected)} rejected items...")
        
        # upload to Firestore
        doc_ref.set({
            "prices": final_prices,
            "rejected_items": final_rejected,
            "total_matched": len(final_prices),
            "total_rejected": len(final_rejected),
            "last_updated": pd.Timestamp.now().isoformat()
        })
        print("[SUCCESS] Firestore updated!")
        
        # upload to bigquery
        push_prices_to_bigquery(final_prices, final_rejected)
        
    else:
        print("[ERROR] No data exists to push.")




def push_prices_to_bigquery(scraped_prices: dict, rejected_items: list):
    """
    Converts the scraped data into a structured dataframe with an explicit `is_online` flag
    and safely overwrites the BigQuery pricing dimension table.
    """
    print("[INFO] Syncing flagged pricing data to BigQuery...")
    
    project_id = os.getenv("VITE_FIREBASE_PROJECT_ID")
    dataset_name = os.getenv("BIGQUERY_DATASET")
    
    project_dataset = f"{project_id}.{dataset_name}"
    table_id = f"{project_dataset}.bookstore_current_pricing"
    
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(current_dir)
        project_root = os.path.dirname(backend_dir)
        cred_path = os.path.join(project_root, "google-drive-service.json")
        
        if not os.path.exists(cred_path):
            print(f"[ERROR] Credential file missing at: {cred_path}")
            return

        credentials = service_account.Credentials.from_service_account_file(cred_path)
        client = bigquery.Client(credentials=credentials, project=project_id)
        
        rows_to_insert = []
        
        # 1. Add the SUCCESSFUL items (is_online = True)
        for name, price in scraped_prices.items():
            rows_to_insert.append({
                "item_description": name, 
                "current_price": float(price),
                "is_online": True
            })
            
        # 2. Add the REJECTED items (is_online = False)
        for name in rejected_items:
            rows_to_insert.append({
                "item_description": name, 
                "current_price": None, # Explicitly Null
                "is_online": False
            })
        
        df = pd.DataFrame(rows_to_insert)
        
        # Important schema update for BigQuery!
        job_config = bigquery.LoadJobConfig(
            write_disposition="WRITE_TRUNCATE"
        )
        
        job = client.load_table_from_dataframe(df, table_id, job_config=job_config)
        job.result() 
        
        print(f"[SUCCESS] Uploaded {len(df)} total rows to BigQuery: {table_id}")
        
    except Exception as e:
        print(f"[ERROR] Failed to push prices to BigQuery: {e}")



if __name__ == "__main__":
    import os, argparse
    
    # setting up the cli args
    # overrides the rejected items list so that it can be rescraped by the scraper
    # with python -m jobs.scrape_bookstore --retry-rejected
    parser = argparse.ArgumentParser(description="Booktsore Pricing Scraper")
    parser.add_argument(
        "--retry-rejected",
        action="store_true",
        help="Bypass the Firestore cache and force a re-scrape of all previously rejected items."
    )
    args = parser.parse_args()

    # get the directory this exact script lives in (backend/jobs)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(current_dir)

    # safely build the absolute path to the CSV file
    CLEANED_DATA_PATH = os.path.join(
        backend_dir, 
        "data_cleaning", 
        "data", 
        "clean", 
        "bookstore_clean.csv"
    )
    
    if not os.path.exists(CLEANED_DATA_PATH):
        print("[ERROR] The CSV file does not exist at the resolved path. Run the cleaning pipeline first!")
    else:
        sync_all_catalog_prices(CLEANED_DATA_PATH, retry_rejected=args.retry_rejected)
