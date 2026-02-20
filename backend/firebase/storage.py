import os
from datetime import datetime, timezone
from typing import Dict

from app.firebase import bucket


def build_storage_paths() -> Dict[str, str]:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return {
        "amazon": f"clean/amazon/amazon_clean_{ts}.csv",
        "cruzbuy": f"clean/cruzbuy/cruzbuy_clean_{ts}.csv",
        "pcard": f"clean/pcard/pcard_clean_{ts}.csv",
    }


def upload_csv_to_storage(local_path: str, storage_path: str) -> None:
    """
    Uploads a local CSV file to Firebase Storage.
    """
    if not os.path.exists(local_path):
        print(f"[WARNING] Clean CSV not found, skipping upload: {local_path}")
        return

    blob = bucket.blob(storage_path)
    blob.upload_from_filename(local_path, content_type="text/csv")
    print(f"Uploaded {local_path} to Firebase Storage at {storage_path}")


def upload_all_to_storage(local_paths: Dict[str, str]) -> Dict[str, str]:
    """
    Uploads all cleaned CSV files to Firebase Storage and returns storage paths.
    """
    storage_paths = build_storage_paths()
    for dataset in ("amazon", "cruzbuy", "pcard"):
        upload_csv_to_storage(local_paths[dataset], storage_paths[dataset])
    return storage_paths
