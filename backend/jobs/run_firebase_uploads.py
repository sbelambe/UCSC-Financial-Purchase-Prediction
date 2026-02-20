import os
import sys
from typing import Dict, Any, Optional

current_dir = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(current_dir, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from firebase.pipeline import upload_cleaned_data
from jobs.run_cleaning import run_cleaning


def run_firebase_uploads(cleaning_result: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Runs Firebase upload pipeline.
    If cleaning_result is not provided, this job runs cleaning first.
    """
    if cleaning_result is None:
        cleaning_result = run_cleaning()

    dataframes = cleaning_result["dataframes"]
    local_paths = cleaning_result["local_paths"]
    upload_result = upload_cleaned_data(dataframes=dataframes, local_paths=local_paths)

    return {
        "amazon_rows": len(dataframes["amazon"]),
        "cruzbuy_rows": len(dataframes["cruzbuy"]),
        "pcard_rows": len(dataframes["pcard"]),
        "bundle_keys": ["amazon", "cruzbuy", "pcard"],
        "uploaded": upload_result["uploaded"],
        "firestore_upload_ids": upload_result["firestore_upload_ids"],
    }


if __name__ == "__main__":
    print(run_firebase_uploads())
