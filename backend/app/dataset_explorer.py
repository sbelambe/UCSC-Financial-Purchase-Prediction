from __future__ import annotations

import io
import os
import math
from typing import Any, Dict, List

import pandas as pd
from fastapi import HTTPException

from .data_config import CANONICAL_COLUMN_ORDER, dataset_schema


DATASET_UPLOAD_IDS = {
    "amazon": "amazon",
    "onecard": "onecard",
    "cruzbuy": "cruzbuy",
    "bookstore": "bookstore",
}

LOCAL_CLEANED_FILENAMES = {
    "amazon": "amazon_clean.csv",
    "onecard": "onecard_clean.csv",
    "cruzbuy": "cruzbuy_clean.csv",
    "bookstore": "bookstore_clean.csv",
}

HARDCODED_STORAGE_PATHS = {
    "amazon": "clean/amazon/amazon_clean_20260305_050239.csv",
    "bookstore": "clean/bookstore/bookstore_clean_20260305_050239.csv",
    "cruzbuy": "clean/cruzbuy/cruzbuy_clean_20260305_050239.csv",
    "onecard": "clean/onecard/onecard_clean_20260305_050239.csv",
}

SEARCH_FIELD_MAP = {
    "all": None,
    "item": ["Item Name", "Item Description"],
    "merchant": ["Merchant Name"],
    "category": ["Category", "Subcategory"],
}


def _load_dataset_frame(dataset: str) -> pd.DataFrame:
    upload_id = DATASET_UPLOAD_IDS.get(dataset)
    if not upload_id:
        raise HTTPException(status_code=400, detail=f"Unsupported dataset '{dataset}'.")

    try:
        db, bucket = _get_firebase_clients()

        storage_path = HARDCODED_STORAGE_PATHS.get(dataset)
        if storage_path:
            blob = bucket.blob(storage_path)
            if blob.exists():
                print(f"[INFO] Loaded dataset '{dataset}' directly from hardcoded storage path in Firebase.")   
                return pd.read_csv(io.BytesIO(blob.download_as_bytes()))
        snapshot = db.collection("uploads").document(upload_id).get()
        if snapshot.exists:
            payload = snapshot.to_dict() or {}
            storage_path = payload.get("storagePath")
            if storage_path:
                blob = bucket.blob(storage_path)
                if blob.exists():
                    return pd.read_csv(io.BytesIO(blob.download_as_bytes()))
    except Exception as firebase_error:
        print(f"[WARN] Dataset Explorer Firebase read failed for '{dataset}': {firebase_error}")

    local_path = _local_cleaned_csv_path(dataset)
    if os.path.exists(local_path):
        return pd.read_csv(local_path)

    raise HTTPException(
        status_code=404,
        detail=(
            f"No cleaned dataset is available for '{dataset}'. "
            "Run the cleaning pipeline or refresh the Firebase upload first."
        ),
    )


def _local_cleaned_csv_path(dataset: str) -> str:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data_cleaning", "data", "clean"))
    return os.path.join(base_dir, LOCAL_CLEANED_FILENAMES[dataset])


def _get_firebase_clients():
    from .firebase import bucket, db

    return db, bucket


def _normalize_frame(df: pd.DataFrame, dataset: str) -> pd.DataFrame:
    schema = dataset_schema(dataset)
    rename_map = {
        column["cleaned_name"]: column["canonical_name"]
        for column in schema["columns"]
        if column.get("cleaned_name")
    }

    normalized = df.rename(columns=rename_map).copy()

    for column in CANONICAL_COLUMN_ORDER:
        if column not in normalized.columns:
            normalized[column] = None

    normalized = normalized[CANONICAL_COLUMN_ORDER]
    return normalized


def _apply_search(df: pd.DataFrame, search: str, search_field: str) -> pd.DataFrame:
    if not search.strip():
        return df

    search_targets = SEARCH_FIELD_MAP.get(search_field, SEARCH_FIELD_MAP["all"])
    if search_targets is None:
        search_targets = list(df.columns)

    available_targets = [column for column in search_targets if column in df.columns]
    if not available_targets:
        return df

    mask = pd.Series(False, index=df.index)
    lowered = search.strip().lower()

    for column in available_targets:
        mask = mask | df[column].fillna("").astype(str).str.lower().str.contains(lowered, regex=False)

    return df[mask]


def _apply_exact_filter(df: pd.DataFrame, column: str, value: str) -> pd.DataFrame:
    if not value.strip() or column not in df.columns:
        return df
    return df[df[column].fillna("").astype(str) == value]


def _apply_date_range(df: pd.DataFrame, start_date: str, end_date: str) -> pd.DataFrame:
    date_column = "Transaction Date"
    if date_column not in df.columns or (not start_date and not end_date):
        return df

    dated = df.copy()
    dated[date_column] = pd.to_datetime(dated[date_column], errors="coerce")

    if start_date:
        dated = dated[dated[date_column] >= pd.to_datetime(start_date)]
    if end_date:
        dated = dated[dated[date_column] <= pd.to_datetime(end_date)]

    return dated


def _sort_frame(df: pd.DataFrame, sort_by: str, sort_dir: str) -> pd.DataFrame:
    column = sort_by if sort_by in df.columns else "Transaction Date"
    ascending = sort_dir.lower() != "desc"

    sortable = df.copy()
    numeric_series = pd.to_numeric(sortable[column], errors="coerce")
    if numeric_series.notna().any():
        sortable["_sort_value"] = numeric_series
    else:
        sortable["_sort_value"] = sortable[column].fillna("").astype(str).str.lower()

    sortable = sortable.sort_values(by="_sort_value", ascending=ascending, na_position="last")
    return sortable.drop(columns=["_sort_value"])


def _available_filter_values(df: pd.DataFrame, column: str, *, limit: int = 200) -> List[str]:
    if column not in df.columns:
        return []

    values = (
        df[column]
        .dropna()
        .astype(str)
        .str.strip()
    )
    values = values[values != ""].drop_duplicates().sort_values()
    return values.head(limit).tolist()


def _sanitize_value(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value

    # Pandas sometimes returns numpy scalar objects here.
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    return value


def _records_for_json(df: pd.DataFrame) -> List[Dict[str, Any]]:
    sanitized_df = df.astype(object)
    records = sanitized_df.to_dict(orient="records")
    return [
        {key: _sanitize_value(value) for key, value in record.items()}
        for record in records
    ]


def get_dataset_explorer_rows(
    *,
    dataset: str,
    page: int,
    page_size: int,
    search: str,
    search_field: str,
    merchant: str,
    category: str,
    start_date: str,
    end_date: str,
    sort_by: str,
    sort_dir: str,
) -> Dict[str, Any]:
    normalized_dataset = dataset.strip().lower()
    schema = dataset_schema(normalized_dataset)
    raw_df = _load_dataset_frame(normalized_dataset)
    df = _normalize_frame(raw_df, normalized_dataset)

    filtered = _apply_search(df, search, search_field)
    filtered = _apply_exact_filter(filtered, "Merchant Name", merchant)
    filtered = _apply_exact_filter(filtered, "Category", category)
    filtered = _apply_date_range(filtered, start_date, end_date)
    filtered = _sort_frame(filtered, sort_by, sort_dir)

    safe_page = max(page, 1)
    safe_page_size = min(max(page_size, 10), 100)
    total_rows = len(filtered)
    total_pages = max((total_rows + safe_page_size - 1) // safe_page_size, 1)
    current_page = min(safe_page, total_pages)
    start_index = (current_page - 1) * safe_page_size
    end_index = start_index + safe_page_size

    page_df = filtered.iloc[start_index:end_index].copy()
    if "Transaction Date" in page_df.columns:
        page_df["Transaction Date"] = pd.to_datetime(page_df["Transaction Date"], errors="coerce").dt.strftime("%Y-%m-%d")
        page_df["Transaction Date"] = page_df["Transaction Date"].where(page_df["Transaction Date"].notna(), None)

    visible_columns = [
        column_details["canonical_name"]
        for column_details in schema["columns"]
        if column_details["available"]
    ]

    return {
        "dataset": normalized_dataset,
        "label": schema["label"],
        "columns": visible_columns,
        "rows": _records_for_json(page_df),
        "page": current_page,
        "page_size": safe_page_size,
        "total_rows": total_rows,
        "total_pages": total_pages,
        "sort_by": sort_by if sort_by in visible_columns else "Transaction Date",
        "sort_dir": "desc" if sort_dir.lower() == "desc" else "asc",
        "available_filters": {
            "merchants": _available_filter_values(df, "Merchant Name"),
            "categories": _available_filter_values(df, "Category"),
        },
        "schema": schema,
    }
