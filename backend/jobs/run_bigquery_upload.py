import os
import pandas as pd
from google.cloud import bigquery
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

firebase_path = os.getenv("FIREBASE_CREDENTIALS_PATH")

if firebase_path:
    # 1. Find the absolute path of the directory this script lives in
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 2. Go up the folder tree to your root directory (Adjust the ".." if needed)
    # If the script is in backend/data_cleaning/, going up two levels ("..", "..") hits the root
    root_dir = os.path.abspath(os.path.join(script_dir, "..", ".."))
    
    # 3. Combine the root directory with the filename from your .env
    absolute_key_path = os.path.join(root_dir, firebase_path)

    # 4. Give the guaranteed absolute path to Google Cloud
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = absolute_key_path
    
    print(f"Loaded credentials from: {absolute_key_path}")
else:
    print("[WARN] FIREBASE_CREDENTIALS_PATH not found in .env file.")


def upload_dataframe_to_bigquery(df: pd.DataFrame, table_name: str):
    """
    Takes a cleaned pandas DataFrame and uploads it to BigQuery.
    Overwrites the existing table if it already exists (WRITE_TRUNCATE).
    """
    project_id = os.getenv("VITE_FIREBASE_PROJECT_ID")
    dataset_name = os.getenv("BIGQUERY_DATASET")
    
    if not project_id or not dataset_name:
        raise ValueError("Missing GCP_PROJECT_ID or BIGQUERY_DATASET in your .env file.")

    # Initialize the BigQuery client
    client = bigquery.Client()
    table_id = f"{project_id}.{dataset_name}.{table_name}"

    # Configure the upload job
    job_config = bigquery.LoadJobConfig(
        # WRITE_TRUNCATE deletes the old table and replaces it with the new fresh data.
        # Use WRITE_APPEND to transition to streaming new rows only.
        write_disposition="WRITE_TRUNCATE",
        
        # Tells BigQuery to figure out the column types (Strings, Integers, Dates) automatically.
        autodetect=True, 
    )

    print(f"Uploading {len(df)} rows to {table_id}...")
    
    # Execute the upload
    job = client.load_table_from_dataframe(
        df, 
        table_id, 
        job_config=job_config
    )
    
    # Wait for the job to complete
    job.result() 
    print(f"[SUCCESS] Table {table_id} is now live in BigQuery!")


def main():
    """
    Standalone execution to upload all local cleaned CSVs to BigQuery.

    Flags:
      --dev   Upload the combined 3-year fake bookstore data as 'bookstore_cleaned_dev'
              instead of the real production tables. Use this after running
              generate_mock_data.py to prepare a dev BigQuery table for model testing.
    """
    import sys
    dev_mode = "--dev" in sys.argv

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data_cleaning", "data"))

    if dev_mode:
        fake_dir = os.path.join(base_dir, "fake")
        fake_files = ["fake_bookstore_23.csv", "fake_bookstore_24.csv", "fake_bookstore_25.csv"]
        present = [f for f in fake_files if os.path.exists(os.path.join(fake_dir, f))]

        if not present:
            print("[ERROR] No fake bookstore files found in data/fake/. Run generate_mock_data.py first.")
            return

        print(f"[DEV MODE] Combining {len(present)} fake bookstore files into 'bookstore_cleaned_dev'...\n")
        frames = [pd.read_csv(os.path.join(fake_dir, f)) for f in present]
        combined = pd.concat(frames, ignore_index=True)
        print(f"  Total rows: {len(combined):,}")
        try:
            upload_dataframe_to_bigquery(combined, "bookstore_cleaned_dev")
        except Exception as e:
            print(f"[ERROR] Failed to upload bookstore_cleaned_dev: {e}")
        print("\n[DEV MODE] Upload complete.")
        print("Next: In BigQuery console, run the ARIMA_PLUS CREATE MODEL SQL")
        print("  targeting 'bookstore_cleaned_dev' and saving as 'bookstore_inventory_forecast_dev'")
        return

    # Normal (production) upload path
    clean_dir = os.path.join(base_dir, "clean")
    datasets_to_upload = {
        "amazon_clean.csv": "amazon_cleaned",
        "bookstore_clean.csv": "bookstore_cleaned",
        "cruzbuy_clean.csv": "cruzbuy_cleaned",
        "onecard_clean.csv": "onecard_cleaned"
    }

    print(f"Starting BigQuery upload sequence. Looking for files in: {clean_dir}\n")

    for filename, table_name in datasets_to_upload.items():
        file_path = os.path.join(clean_dir, filename)

        if os.path.exists(file_path):
            print(f"Reading local file: {filename}...")
            try:
                df = pd.read_csv(file_path)
                upload_dataframe_to_bigquery(df, table_name)
            except Exception as e:
                print(f"[ERROR] Failed to process {filename}: {e}")
        else:
            print(f"[SKIP] File not found: {filename}. Skipping upload for {table_name}.")

    print("\nUpload sequence complete.")


if __name__ == "__main__":
    main()