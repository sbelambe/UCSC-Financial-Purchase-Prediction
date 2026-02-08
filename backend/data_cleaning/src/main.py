# program entry point - runs the program
from clean_amazon import load_amazon
from clean_cruzbuy import clean_cruzbuy
# from .clean_pcard import clean_pcard
from app.firebase import bucket
import os



def run_pipeline():
    """
    Runs all cleaning functions and returns summary information.
    """

    # Clean each dataset
    amazon_df = load_amazon()
    cruzbuy_df = clean_cruzbuy()
    # pcard_df = clean_pcard()

    # Create summary
    result = {
        # "amazon_rows": len(amazon_df),
        "cruzbuy_rows": len(cruzbuy_df),
        # "pcard_rows": len(pcard_df),
        # "bundle_keys": ["amazon", "cruzbuy", "pcard"]
        "bundle_keys": ["cruzbuy"]
    }

    return result

def upload_csv_to_storage(local_path, storage_path):
    """
    Uploads a local CSV file to Firebase Storage.
    """
    blob = bucket.blob(storage_path)
    blob.upload_from_filename(local_path, content_type="text/csv")
    print(f"Uploaded {local_path} to Firebase Storage at {storage_path}")


if __name__ == "__main__":
    print(run_pipeline()) 

    local_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "clean", "cruzbuy_clean.csv")
    )
    storage_path = "clean/cruzbuy/cruzbuy_clean.csv"

    upload_csv_to_storage(local_path, storage_path)