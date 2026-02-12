from backend.data_cleaning.src.clean_amazon import load_amazon
from backend.data_cleaning.src.clean_cruzbuy import clean_cruzbuy
from backend.data_cleaning.src.clean_pcard import load_pcard
from backend.app.firebase import bucket
import os
from datetime import datetime, timezone
from backend.data_cleaning.src.firestore_upload import df_to_firestore
from backend.data_cleaning.src.firestore_summaries import save_top_values_summary

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
        os.path.join(os.path.dirname(__file__), "..", "clean", "amazon_clean.csv")
    )
    cruzbuy_local = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "clean", "cruzbuy_clean.csv")
    )
    pcard_local = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "clean", "procard_clean.csv")
    )

    # Storage paths
    amazon_storage = f"clean/amazon/amazon_clean_{ts}.csv"
    cruzbuy_storage = f"clean/cruzbuy/cruzbuy_clean_{ts}.csv"
    pcard_storage = f"clean/pcard/pcard_clean_{ts}.csv"

    # Upload both (amazon may be empty/missing if raw file missing)
    upload_csv_to_storage(amazon_local, amazon_storage)
    upload_csv_to_storage(cruzbuy_local, cruzbuy_storage)
    upload_csv_to_storage(pcard_local, pcard_storage)
    
    #  Uploading to Firestore
    amazon_upload_id = df_to_firestore(amazon_df, dataset="amazon", storage_path=amazon_storage)
    cruzbuy_upload_id = df_to_firestore(cruzbuy_df, dataset="cruzbuy", storage_path=cruzbuy_storage)
    pcard_upload_id = df_to_firestore(pcard_df, dataset="pcard", storage_path=pcard_storage)
    
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