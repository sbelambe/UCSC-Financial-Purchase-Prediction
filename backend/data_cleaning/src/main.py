from backend.data_cleaning.src.clean_amazon import load_amazon
from backend.data_cleaning.src.clean_cruzbuy import clean_cruzbuy
from backend.app.firebase import bucket
import os
from datetime import datetime

def run_pipeline():
    """
    Runs all cleaning functions and returns summary information.
    """

    # Clean each dataset
    amazon_df = load_amazon()
    cruzbuy_df = clean_cruzbuy()
    # pcard_df = clean_pcard()
    
    # TODO: currently adds csv based on time, should only upload if any major cleaning is happening to an additional csv
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    amazon_local = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "clean", "amazon_clean.csv")
    )
    cruzbuy_local = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "clean", "cruzbuy_clean.csv")
    )

    # Storage paths
    amazon_storage = f"clean/amazon/amazon_clean_{ts}.csv"
    cruzbuy_storage = f"clean/cruzbuy/cruzbuy_clean_{ts}.csv"

    # Upload both (amazon may be empty/missing if raw file missing)
    upload_csv_to_storage(amazon_local, amazon_storage)
    upload_csv_to_storage(cruzbuy_local, cruzbuy_storage)

    # Create Summary
    result = {
        "amazon_rows": len(amazon_df),
        "cruzbuy_rows": len(cruzbuy_df),
        "bundle_keys": ["amazon", "cruzbuy"],
        "uploaded": {
            "amazon": amazon_storage,
            "cruzbuy": cruzbuy_storage,
        },
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

    local_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "clean", "cruzbuy_clean.csv")
    )

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    storage_path = f"clean/cruzbuy/cruzbuy_clean_{ts}.csv"


    upload_csv_to_storage(local_path, storage_path)