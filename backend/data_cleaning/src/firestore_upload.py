import re, uuid, pandas as pd
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from app.firebase import db


BATCH_LIMIT = 500  # Firestore batch write limit


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sanitize_field_name(name: str) -> str:
    """
    Firestore supports many characters, but keeping keys simple avoids issues.
    """
    name = name.strip()
    name = re.sub(r"\s+", "_", name)          # spaces -> underscores
    name = re.sub(r"[^\w\-]", "", name)       # drop weird chars
    return name[:150] if name else "field"


def _clean_value(v: Any) -> Any:
    """
    Convert pandas NaN/NaT to None (Firestore-friendly).
    """
    if pd.isna(v):
        return None
    # Convert numpy types to native Python types
    if hasattr(v, "item"):
        try:
            return v.item()
        except Exception:
            pass
    return v


def df_to_firestore(
    df: pd.DataFrame,
    dataset: str,
    storage_path: Optional[str] = None,
    upload_id: Optional[str] = None,
) -> str:
    """
    Stores a dataframe into Firestore under:
      uploads/{upload_id}  (metadata)
      uploads/{upload_id}/rows/{auto_id}  (row docs)

    Returns the upload_id.
    """
    if upload_id is None:
        upload_id = str(uuid.uuid4())

    # Metadata doc
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

    if df.empty:
        print(f"[INFO] {dataset}: df is empty; wrote metadata only (upload_id={upload_id})")
        return upload_id

    # Prepare rows collection
    rows_col = meta_ref.collection("rows")

    # Write rows in batches
    batch = db.batch()
    op_count = 0

    # Pre-sanitize columns once
    col_map: Dict[str, str] = {c: _sanitize_field_name(c) for c in df.columns}

    for _, row in df.iterrows():
        doc_ref = rows_col.document()  # auto ID
        doc_data = {col_map[k]: _clean_value(v) for k, v in row.items()}

        batch.set(doc_ref, doc_data)
        op_count += 1

        if op_count >= BATCH_LIMIT:
            batch.commit()
            batch = db.batch()
            op_count = 0

    # Commit remaining
    if op_count > 0:
        batch.commit()

    print(f"[OK] Stored {len(df)} rows for '{dataset}' in Firestore (upload_id={upload_id})")
    return upload_id
