import os, sys, uuid, json
import pandas as pd
from dotenv import load_dotenv
from datetime import datetime, timezone

# --- Path Resolution (Matching Pipeline Architecture) ---
current_dir = os.path.dirname(os.path.abspath(__file__))
# Navigate up to the data_cleaning root
BACKEND_ROOT = os.path.abspath(os.path.join(current_dir, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

# Load environment variables from the root .env
load_dotenv(os.path.join(BACKEND_ROOT, ".env"))

# Import real cleaning and summarization logic
from data_cleaning.src.clean_amazon import load_amazon
from data_cleaning.src.clean_cruzbuy import load_cruzbuy
from data_cleaning.src.clean_pcard import load_pcard
from firebase.summaries import compute_top_items_detailed, compute_spend_over_time

# --- Environment Controls ---
MOCK_FIRESTORE = os.getenv("MOCK_FIRESTORE", "False").lower() == "true"
print(f"ENV: MOCK_FIRESTORE is {'ENABLED' if MOCK_FIRESTORE else 'DISABLED'}")

def test_dashboard_integration(all_results: dict):
    """
    Detailed description: Combines real datasets to provide a terminal-based 
    preview of top expenditures. Matches the logic used in production.
    """
    print("\n --- TOP EXPENDITURES ---")
    merged = {}
    for dataset, items in all_results.items():
        for item in items:
            name = item['clean_item_name']
            if name not in merged:
                merged[name] = {"count": 0, "total": 0.0, "sources": set()}
            
            # --- Safe Numeric Parsing ---
            raw_total = item.get('total_spent', 0)
            try:
                if isinstance(raw_total, str):
                    clean_total = float(raw_total.replace('$', '').replace(',', '').strip())
                else:
                    clean_total = float(raw_total)
            except (ValueError, TypeError):
                clean_total = 0.0

            merged[name]["count"] += item['count']
            merged[name]["total"] += clean_total
            merged[name]["sources"].add(dataset.upper())

    # Sort by total spent for finance relevance
    final_list = sorted(merged.items(), key=lambda x: x[1]['total'], reverse=True)

    print(f"{'Rank':<5} | {'Description':<40} | {'Qty':<6} | {'Total Spend':<14} | {'Platforms'}")
    print("-" * 90)
    for i, (name, stats) in enumerate(final_list[:10], 1):
        platforms = ", ".join(stats["sources"])
        print(f"{i:<5} | {name[:40]:<40} | {stats['count']:<6} | ${stats['total']:>12,.2f} | {platforms}")
    print("-" * 90 + "\n")

def run_pre_upload_audit():
    """
    Detailed description: Loads real data from the local cleaned CSVs and 
    generates a local JSON preview for the school finance dashboard.
    """
    print("--- Initiating Pre-Upload Data Audit ---")

    try:
        print("[INFO] Loading real DataFrames from local storage...")
        amazon_df = load_amazon()
        pcard_df = load_pcard()
        cruzbuy_df = load_cruzbuy()

        # 2. Compute summaries using real production logic
        print("[INFO] Computing summaries...")
        local_top_items_previews = {
            "amazon": compute_top_items_detailed(amazon_df, "Item Description", "Subtotal", "Merchant Name"),
            "cruzbuy": compute_top_items_detailed(cruzbuy_df, "Item Description", "Subtotal", "Merchant Name"),
            "pcard": compute_top_items_detailed(pcard_df, "Item Name", "Subtotal", "Merchant Name")
        }

        local_spend_trend_previews = {
            "amazon": compute_spend_over_time(
                amazon_df,
                date_col="Transaction Date",
                amount_col="Total Price",
                interval="month",
            ),
            "cruzbuy": compute_spend_over_time(
                cruzbuy_df,
                date_col="Transaction Date",
                amount_col="Total Price",
                interval="month",
            ),
            "pcard": compute_spend_over_time(
                pcard_df,
                date_col="Transaction Date",
                amount_col="Total Price",
                interval="month",
                transaction_type_col="Transaction Type",
                include_refunds=True,
            ),
        }

        # 3. Display the terminal summary for immediate audit
        test_dashboard_integration(local_top_items_previews)

        # 4. Export to frontend for visual verification
        # Path assumes: project_root/frontend/src/data/preview_top_20_data.json
        preview_top_items_file = os.path.abspath(
            os.path.join(BACKEND_ROOT, "..", "frontend", "src", "data", "preview_top_20_data.json")
        )
        preview_spend_file = os.path.abspath(
            os.path.join(BACKEND_ROOT, "..", "frontend", "src", "data", "preview_spend_over_time_data.json")
        )
        os.makedirs(os.path.dirname(preview_top_items_file), exist_ok=True)
        
        with open(preview_top_items_file, 'w') as f:
            json.dump(local_top_items_previews, f, indent=4)

        with open(preview_spend_file, 'w') as f:
            json.dump(local_spend_trend_previews, f, indent=4)
        
        print(f"[SUCCESS] Top-items preview saved to: {preview_top_items_file}")
        print(f"[SUCCESS] Spend-trend preview saved to: {preview_spend_file}")
        print("Audit complete.")

    except Exception as e:
        print(f"Audit Failed: {e}")
        print("[TIP] Ensure your cleaned CSVs exist in data_cleaning/data/clean/")

if __name__ == "__main__":
    run_pre_upload_audit()
