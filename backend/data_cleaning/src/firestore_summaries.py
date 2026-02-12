from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.app.firebase import db
import pandas as pd


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_summary(
    *,
    upload_id: str,
    name: str,
    payload: Dict[str, Any],
    dataset: Optional[str] = None,
    storage_path: Optional[str] = None,
) -> None:
    doc_ref = (
        db.collection("uploads")
        .document(upload_id)
        .collection("summaries")
        .document(name)
    )

    doc = {
        "name": name,
        "dataset": dataset,
        "storagePath": storage_path,
        "generatedAt": utc_now_iso(),
        "payload": payload,
    }

    doc_ref.set(doc, merge=True)


def top_counts_payload(
    *,
    title: str,
    items: List[Dict[str, Any]],
    unit: str = "count",
) -> Dict[str, Any]:
    return {
        "type": "top_counts",
        "title": title,
        "unit": unit,
        "items": items,
    }



def compute_top_values(
    df: pd.DataFrame,
    column: str,
    n: int = 10,
    fill_value: str = "unlisted",
    dropna: bool = False,
) -> List[Dict[str, Any]]:
    """
    Returns [{"name": <value>, "count": <int>}, ...] for top N values in df[column].

    - fill_value: used when values are NaN/empty (unless dropna=True)
    - dropna: if True, ignores NaNs instead of replacing
    """
    if column not in df.columns:
        print(f"[WARNING] Column '{column}' not found; skipping top-values.")
        return []

    s = df[column]

    # Normalize to strings (safe for CSV-derived columns)
    if dropna:
        s = s.dropna()
    else:
        s = s.fillna(fill_value)

    s = s.astype(str).str.strip()
    if not dropna:
        s = s.replace("", fill_value)

    counts = s.value_counts().head(n)
    return [{"name": name, "count": int(count)} for name, count in counts.items()]


def save_top_values_summary(
    *,
    upload_id: str,
    dataset: str,
    storage_path: Optional[str],
    summary_name: str,
    title: str,
    df: pd.DataFrame,
    column: str,
    n: int = 10,
    fill_value: str = "unlisted",
    ) -> None:
        """
        Computes top values for a column and saves to:
        uploads/{upload_id}/summaries/{summary_name}
        """
        items = compute_top_values(df, column=column, n=n, fill_value=fill_value)
        if not items:
            return

        save_summary(
            upload_id=upload_id,
            name=summary_name,
            dataset=dataset,
            storage_path=storage_path,
            payload=top_counts_payload(title=title, items=items),
        )