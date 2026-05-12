# Uploads cleaned CSV files to Firebase Storage and organizes them with timestamps
# Like a Google Drive, but for Firebase
import os
from datetime import datetime, timezone
from typing import Dict

from app.firebase import bucket

# Create timestamped file paths
def build_storage_paths() -> Dict[str, str]:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return {
        "amazon": f"clean/amazon/amazon_clean_{ts}.csv",
        "cruzbuy": f"clean/cruzbuy/cruzbuy_clean_{ts}.csv",
        "onecard": f"clean/onecard/onecard_clean_{ts}.csv",
        "bookstore": f"clean/bookstore/bookstore_clean_{ts}.csv",
    }

# Checks if a local CSV file exists, then uploads it to Firebase Storage
def upload_csv_to_storage(local_path: str, storage_path: str) -> None:
    # Prevents crashing if a file is missing
    if not os.path.exists(local_path):
        print(f"[WARNING] Clean CSV not found, skipping upload: {local_path}")
        return

    blob = bucket.blob(storage_path)
    blob.upload_from_filename(local_path, content_type="text/csv")
    print(f"Uploaded {local_path} to Firebase Storage at {storage_path}")

# Uploads all cleaned CSV files to Firebase Storage and returns storage paths
def upload_all_to_storage(local_paths: Dict[str, str]) -> Dict[str, str]:
    storage_paths = build_storage_paths()
    for dataset in ("amazon", "cruzbuy", "onecard", "bookstore"):
        upload_csv_to_storage(local_paths[dataset], storage_paths[dataset])
    return storage_paths
