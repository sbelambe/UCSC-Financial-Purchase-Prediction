import os, sys, uuid, json
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(current_dir, "..", ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

from data_cleaning.src.clean_amazon import load_amazon
from data_cleaning.src.clean_cruzbuy import clean_cruzbuy
from data_cleaning.src.clean_pcard import load_pcard
from data_cleaning.src.firestore_upload import df_to_firestore
from data_cleaning.src.firestore_summaries import (
    save_top_values_summary, 
    save_top_items_detailed_summary,
    compute_top_items_detailed
)
from app.firebase import bucket
from datetime import datetime, timezone

# --- Environment Controls ---
MOCK_FIRESTORE = os.getenv("MOCK_FIRESTORE", "False").lower() == "true"
print(f"ENV: MOCK_FIRESTORE is {'ENABLED' if MOCK_FIRESTORE else 'DISABLED'}")

def mock_df_to_firestore(df, dataset, **kwargs):
    """Generates a dummy ID and skips the actual upload."""
    dummy_id = f"test_id_{uuid.uuid4().hex[:8]}"
    print(f"[MOCK] df_to_firestore: Created {dummy_id} for '{dataset}' ({len(df)} rows)")
    return dummy_id


def mock_save_summary(upload_id, name, **kwargs):
    """Skips the summary document write."""
    print(f"[MOCK] save_summary: Skipping write for '{name}' under ID {upload_id}")


def test_dashboard_integration(all_results: dict):
    """
    Combines datasets to provide a clear view of top expenditures across all platforms.
    Safely handles type conversions for currency strings.
    """
    print("\n --- TOP EXPENDITURES (MERGED) ---")
    merged = {}
    for dataset, items in all_results.items():
        for item in items:
            name = item['clean_item_name']
            if name not in merged:
                merged[name] = {"count": 0, "total": 0.0, "sources": set()}
            
            # --- Safe Numeric Parsing ---
            raw_total = item.get('total_spent', 0)
            try:
                # If it's a string, strip $ and commas, then convert to float
                if isinstance(raw_total, str):
                    clean_total = float(raw_total.replace('$', '').replace(',', '').strip())
                else:
                    clean_total = float(raw_total)
            except (ValueError, TypeError):
                clean_total = 0.0
            # ----------------------------

            merged[name]["count"] += item['count']
            merged[name]["total"] += clean_total
            merged[name]["sources"].add(dataset.upper())

    # Sort by total spent for finance relevance, or switch to ['count'] for frequency
    final_list = sorted(merged.items(), key=lambda x: x[1]['total'], reverse=True)

    print(f"{'Rank':<5} | {'Description':<40} | {'Qty':<6} | {'Total Spend':<14} | {'Platforms'}")
    print("-" * 90)
    for i, (name, stats) in enumerate(final_list[:10], 1):
        platforms = ", ".join(stats["sources"])
        print(f"{i:<5} | {name[:40]:<40} | {stats['count']:<6} | ${stats['total']:>12,.2f} | {platforms}")
    print("-" * 90 + "\n")


def run_pipeline():
    """
    Runs all cleaning functions and returns summary information.
    """

    # Clean each dataset
    amazon_df = load_amazon()
    cruzbuy_df = clean_cruzbuy()
    pcard_df = load_pcard()
    
    # TODO: currently adds csv based on time, should only upload if any major cleaning is happening to an additional csv
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    
    amazon_local = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "data", "clean", "amazon_clean.csv")
    )
    cruzbuy_local = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "data", "clean", "cruzbuy_clean.csv")
    )
    pcard_local = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "data", "clean", "procard_clean.csv")
    )

    # Storage paths
    amazon_storage = f"clean/amazon/amazon_clean_{ts}.csv"
    cruzbuy_storage = f"clean/cruzbuy/cruzbuy_clean_{ts}.csv"
    pcard_storage = f"clean/pcard/pcard_clean_{ts}.csv"

    # if MOCK_FIRESTORE is false in .env, then upload to db
    # otherwise, will output mock data instead
    upload_fn = mock_df_to_firestore if MOCK_FIRESTORE else df_to_firestore
    amazon_upload_id = upload_fn(amazon_df, dataset="amazon")
    cruzbuy_upload_id = upload_fn(cruzbuy_df, dataset="cruzbuy")
    pcard_upload_id = upload_fn(pcard_df, dataset="pcard")

    print("\n--- Running Local Finance Summary Integration Test ---")
    try:
        # Compute local summaries without saving to Firestore
        local_previews = {
            "amazon": compute_top_items_detailed(amazon_df, "Item Name", "Subtotal", "Merchant Name"),
            "cruzbuy": compute_top_items_detailed(cruzbuy_df, "Product Description", "Unit Price", "Supplier Name"),
            "pcard": compute_top_items_detailed(pcard_df, "Item Name", "Subtotal", "Merchant Name")
        }
        # Run the finance staff preview
        test_dashboard_integration(local_previews)
        print("✅ Local Integration computation successful!")
    except Exception as e:
        print(f"❌ Local Integration computation failed: {e}")

    # Upload both (amazon may be empty/missing if raw file missing)
    # upload_csv_to_storage(amazon_local, amazon_storage)
    # upload_csv_to_storage(cruzbuy_local, cruzbuy_storage)
    # upload_csv_to_storage(pcard_local, pcard_storage)
    
    #  Uploading to Firestore
    # amazon_upload_id = df_to_firestore(amazon_df, dataset="amazon", storage_path=amazon_storage)
    # cruzbuy_upload_id = df_to_firestore(cruzbuy_df, dataset="cruzbuy", storage_path=cruzbuy_storage)
    # pcard_upload_id = df_to_firestore(pcard_df, dataset="pcard", storage_path=pcard_storage)

    print(f"DEBUG: Amazon columns: {amazon_df.columns.tolist()}")
    print(f"DEBUG: Cruzbuy columns: {cruzbuy_df.columns.tolist()}")
    print(f"DEBUG: PCard columns: {pcard_df.columns.tolist()}")

    if MOCK_FIRESTORE:
        # Save the integrated preview to a local JSON file for the React Frontend to use
        preview_file = os.path.join(BACKEND_ROOT, "..", "frontend", "src", "data", "preview_data.json")
        os.makedirs(os.path.dirname(preview_file), exist_ok=True)
    
    with open(preview_file, 'w') as f:
        json.dump(local_previews, f)
    print(f"📦 [MOCK] Preview data saved to frontend for UI testing.")
    
    # Only push summaries to Firestore if we are NOT in mock mode
    if not MOCK_FIRESTORE:
        # cruzbuy: top manufacturers
        save_top_values_summary(
            upload_id=cruzbuy_upload_id,
            dataset="cruzbuy",
            storage_path=cruzbuy_storage,
            summary_name="top_manufacturers_10",
            title="Top manufacturers",
            df=cruzbuy_df,
            column="Manufacturer",
            n=10,
        )

        save_top_items_detailed_summary(
            upload_id=cruzbuy_upload_id,
            dataset="cruzbuy",
            storage_path=cruzbuy_storage,
            summary_name="top_items_detailed",
            title="Top Purchased Items",
            df=cruzbuy_df,
            item_col="Product Description",     
            price_col="Unit Price",      
            vendor_col="Supplier Name",
            n=20
        )

        # amazon: top manufacturers 
        save_top_values_summary(
            upload_id=amazon_upload_id,
            dataset="amazon",
            storage_path=amazon_storage,
            summary_name="top_manufacturers_10",
            title="Top manufacturers",
            df=amazon_df,
            column="Merchant Name",
            n=10,
        )

        save_top_items_detailed_summary(
            upload_id=amazon_upload_id,
            dataset="amazon",
            storage_path=amazon_storage,
            summary_name="top_items_detailed",
            title="Top Purchased Items",
            df=amazon_df,
            item_col="Item Name",
            price_col="Subtotal",
            vendor_col="Merchant Name",
            n=20
        )
        
        # pcard: top merchants (manufacturers)
        save_top_values_summary(
            upload_id=pcard_upload_id,
            dataset="pcard",
            storage_path=pcard_storage,
            summary_name="top_merchants_10",
            title="Top merchants",
            df=pcard_df,
            column="Merchant Name",
            n=10,
        )

        save_top_items_detailed_summary(
            upload_id=pcard_upload_id,
            dataset="pcard",
            storage_path=pcard_storage,
            summary_name="top_items_detailed",
            title="Top Purchased Items",
            df=pcard_df,
            item_col="Item Name",
            price_col="Subtotal",
            vendor_col="Merchant Name",
            n=20
        )
    else:
        print("\n[MOCK MODE] Skipping real Firestore summary uploads.")


    # Create Summary
    result = {
        "amazon_rows": len(amazon_df),
        "cruzbuy_rows": len(cruzbuy_df),
        "pcard_rows": len(pcard_df),
        "bundle_keys": ["amazon", "cruzbuy", "pcard"],
        "uploaded": {
            "amazon": amazon_storage,
            "cruzbuy": cruzbuy_storage,
            "pcard": pcard_storage,
        },
        "firestore_upload_ids": {
            "amazon": amazon_upload_id,
            "cruzbuy": cruzbuy_upload_id,
            "pcard": pcard_upload_id,
        }
    }

    return result

def upload_csv_to_storage(local_path, storage_path):
    """
    Uploads a local CSV file to Firebase Storage.
    """
    if not os.path.exists(local_path):
        print(f"[WARNING] Clean CSV not found, skipping upload: {local_path}")
        return
    
    blob = bucket.blob(storage_path)
    blob.upload_from_filename(local_path, content_type="text/csv")
    print(f"Uploaded {local_path} to Firebase Storage at {storage_path}")

if __name__ == "__main__":
    print(run_pipeline())