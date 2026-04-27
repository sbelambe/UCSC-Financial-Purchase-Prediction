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
    """
    # Dynamically resolve the absolute path to 'clean' data folder.
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data_cleaning", "data", "clean"))

    # Map local CSV filenames to their target BigQuery table names
    datasets_to_upload = {
        "amazon_clean.csv": "amazon_cleaned",
        "bookstore_clean.csv": "bookstore_cleaned",
        "cruzbuy_clean.csv": "cruzbuy_cleaned",
        "onecard_clean.csv": "onecard_cleaned"
    }

    print(f"Starting BigQuery upload sequence. Looking for files in: {base_dir}\n")

    for filename, table_name in datasets_to_upload.items():
        file_path = os.path.join(base_dir, filename)
        
        if os.path.exists(file_path):
            print(f"Reading local file: {filename}...")
            try:
                # Read the CSV into a pandas DataFrame
                df = pd.read_csv(file_path)
                
                # Upload to BigQuery
                upload_dataframe_to_bigquery(df, table_name)
            except Exception as e:
                print(f"[ERROR] Failed to process {filename}: {e}")
        else:
            print(f"[SKIP] File not found: {filename}. Skipping upload for {table_name}.")
            
    print("\nUpload sequence complete.")


if __name__ == "__main__":
    main()