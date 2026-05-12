# Takes the cleaned dataframes and uploads them to Firestore in a structured way
import re, uuid, pandas as pd
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import time
from google.api_core.exceptions import DeadlineExceeded
from app.firebase import db


BATCH_LIMIT = 200  # Firestore batch write limit
MAX_COMMIT_RETRIES = 4
BASE_RETRY_DELAY_SECONDS = 1.0

# Helper function to get current UTC time in ISO format for metadata timestamps
def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# Firestore field names have some restrictions and best practices. This 
# function cleans column names to be safe for Firestore
def _sanitize_field_name(name: str) -> str:
    name = name.strip()
    name = re.sub(r"\s+", "_", name)          # spaces -> underscores
    name = re.sub(r"[^\w\-]", "", name)       # drop weird chars
    return name[:150] if name else "field"

# Firestore doesn't allow NaN/NaT values, so we convert them to None. We also 
# convert numpy types to native Python types for better compatibility
def _clean_value(v: Any) -> Any:
    if pd.isna(v):
        return None

    if hasattr(v, "item"):
        try:
            return v.item()
        except Exception:
            pass
    return v


# Commits a Firestore batch with retries for transient DeadlineExceeded errors, 
# using exponential backoff
def _commit_with_retry(batch, *, timeout: int = 120) -> None:
    for attempt in range(1, MAX_COMMIT_RETRIES + 1):
        try:
            batch.commit(timeout=timeout)
            return
        except DeadlineExceeded:
            if attempt == MAX_COMMIT_RETRIES:
                raise
            sleep_s = BASE_RETRY_DELAY_SECONDS * (2 ** (attempt - 1))
            print(f"[WARN] Firestore commit timed out (attempt {attempt}/{MAX_COMMIT_RETRIES}), retrying in {sleep_s:.1f}s...")
            time.sleep(sleep_s)


# Takes a cleaned dataframe and uploads it to Firestore as metadata + row
# documents
def df_to_firestore(
    df: pd.DataFrame,
    dataset: str,
    storage_path: Optional[str] = None,
    upload_id: Optional[str] = None,
    write_rows: bool = True,
) -> str:
    """
    Stores a dataframe into Firestore under:
      uploads/{upload_id}  (metadata)
      uploads/{upload_id}/rows/{auto_id}  (row docs)

    Returns the upload_id.
    """
    # Generate upload ID (a unique ID for each run of the pipeline)
    if upload_id is None:
        upload_id = str(uuid.uuid4())

    # Store metadata for datasets
    # Ex: 
    '''
    {
        "dataset": "amazon",
        "rowCount": 500,
        "createdAt": "...",
        "schema": ["date", "amount", "vendor"]
    }
    '''
    meta_ref = db.collection("uploads").document(upload_id)
    meta_ref.set(
        {
            "dataset": dataset,
            "rowCount": int(len(df)),
            "storagePath": storage_path,
            "createdAt": _utc_now_iso(),
            "schema": [_sanitize_field_name(c) for c in df.columns],
        },
        merge=True,
    )

    # Edge cases
    # Prevent metadata-only uploads
    if not write_rows:
        print(f"[INFO] {dataset}: wrote metadata only (row writes disabled, upload_id={upload_id})")
        return upload_id
    
    # Skip empty datasets
    if df.empty:
        print(f"[INFO] {dataset}: df is empty; wrote metadata only (upload_id={upload_id})")
        return upload_id

    # Optimized rows collection
    rows_col = meta_ref.collection("rows")

    # Prepare row data (clean column names and values)
    df_upload = df.copy()
    df_upload.columns = [_sanitize_field_name(c) for c in df_upload.columns]

    # Convert dataframes to python dicts
    records = df_upload.to_dict(orient="records")

    # Write rows in batches
    batch = db.batch()
    op_count = 0

    for row_dict in records:
        doc_ref = rows_col.document()  # auto ID

        doc_data = {k: _clean_value(v) for k, v in row_dict.items()}

        batch.set(doc_ref, doc_data)
        op_count += 1

        if op_count >= BATCH_LIMIT:
            _commit_with_retry(batch, timeout=120)
            batch = db.batch()
            op_count = 0

    # Commit remaining
    if op_count > 0:
        _commit_with_retry(batch, timeout=120)

    print(f"[OK] Stored {len(df)} rows for '{dataset}' in Firestore (upload_id={upload_id})")
    return upload_id
