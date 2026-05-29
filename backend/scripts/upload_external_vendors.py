"""
Generated using Claude
One-time upload script: pushes external_vendors_combined.csv to Firebase Storage
at the fixed path  reference/external_vendors_combined.csv

Run from the backend/ directory:
    python -m scripts.upload_external_vendors
"""

import os
import sys

# Ensure backend package is importable when run from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.firebase import bucket  # noqa: E402 — must come after sys.path tweak

_LOCAL_CSV = os.path.normpath(
    os.path.join(
        os.path.dirname(__file__),
        "..", "data_cleaning", "data", "clean",
        "external_vendors_combined.csv",
    )
)

_STORAGE_PATH = "reference/external_vendors_combined.csv"


def main() -> None:
    if not os.path.exists(_LOCAL_CSV):
        print(f"[ERROR] CSV not found: {_LOCAL_CSV}")
        print("Re-run the 'External vendor counts and distribution' cell in data_mining.ipynb first.")
        sys.exit(1)

    blob = bucket.blob(_STORAGE_PATH)
    blob.upload_from_filename(_LOCAL_CSV, content_type="text/csv")
    print(f"Uploaded to Firebase Storage: gs://{bucket.name}/{_STORAGE_PATH}")


if __name__ == "__main__":
    main()
