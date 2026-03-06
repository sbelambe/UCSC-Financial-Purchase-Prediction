from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.firebase import db
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


def spend_over_time_payload(
    *,
    title: str,
    time_period: str,
    points: List[Dict[str, Any]],
    currency: str = "USD",
) -> Dict[str, Any]:
    return {
        "type": "spend_over_time",
        "title": title,
        "time_period": time_period,
        "interval": time_period,  # Backward-compatible field
        "currency": currency,
        "points": points,
    }


# could potentially remove this function once cleaning is complete
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


def compute_spend_over_time(
    df: pd.DataFrame,
    *,
    date_col: str = "Transaction Date",
    amount_col: str = "Total Price",
    time_period: str = "month",
    interval: Optional[str] = None,  # Backward-compatible alias
    transaction_type_col: Optional[str] = None,
    include_refunds: bool = True,
) -> List[Dict[str, Any]]:
    """
    Returns [{"period": <YYYY|YYYY-MM|YYYY-MM-DD|YYYY-Www>, "spend": <float>}, ...].
    """
    chosen_time_period = interval or time_period
    if chosen_time_period not in {"day", "week", "month", "year"}:
        raise ValueError("time_period must be one of: day, week, month, year")

    if date_col not in df.columns or amount_col not in df.columns:
        print(f"[WARNING] Missing required columns: {date_col}, {amount_col}")
        return []

    tmp = df[[date_col, amount_col] + ([transaction_type_col] if transaction_type_col and transaction_type_col in df.columns else [])].copy()
    tmp[date_col] = pd.to_datetime(tmp[date_col], errors="coerce")

    # Handle "$2,353.88" and numeric strings.
    tmp[amount_col] = (
        tmp[amount_col]
        .astype(str)
        .str.replace(r"[\$,]", "", regex=True)
        .str.strip()
    )
    tmp[amount_col] = pd.to_numeric(tmp[amount_col], errors="coerce")
    tmp = tmp.dropna(subset=[date_col, amount_col])

    if not include_refunds and transaction_type_col and transaction_type_col in tmp.columns:
        tmp = tmp[tmp[transaction_type_col].astype(str).str.lower() != "refund"]
    elif not include_refunds:
        tmp = tmp[tmp[amount_col] >= 0]

    if tmp.empty:
        return []

    if chosen_time_period == "day":
        tmp["period"] = tmp[date_col].dt.strftime("%Y-%m-%d")
    elif chosen_time_period == "week":
        iso = tmp[date_col].dt.isocalendar()
        tmp["period"] = iso["year"].astype(str) + "-W" + iso["week"].astype(str).str.zfill(2)
    elif chosen_time_period == "year":
        tmp["period"] = tmp[date_col].dt.strftime("%Y")
    else:
        tmp["period"] = tmp[date_col].dt.strftime("%Y-%m")

    grouped = (
        tmp.groupby("period", as_index=False)[amount_col]
        .sum()
        .sort_values("period")
    )
    return [{"period": row["period"], "spend": round(float(row[amount_col]), 2)} for _, row in grouped.iterrows()]


def save_top_values_summary(
    *,
    upload_id: str,
    dataset: str,
    storage_path: Optional[str],
    summary_name: str,
    title: str,
    df: pd.DataFrame,
    column: str,
    n: int = 20,
    ) -> None:
        """
        Computes top values for a column and saves to:
        uploads/{upload_id}/summaries/{summary_name}
        """
        items = compute_top_values(df, column=column, n=n)
        if not items:
            return
        
        payload = top_counts_payload(title=title, items=items)

        save_summary(
            upload_id=upload_id,
            name=summary_name,
            dataset=dataset,
            storage_path=storage_path,
            payload=payload,
        )


def compute_top_items_detailed(df, item_col, price_col, vendor_col, date_col=None, n=20):
    df_clean = df.copy()
    
    # Standardize column names (case-insensitive search)
    cols_lower = {c.lower(): c for c in df.columns}
    actual_item_col = cols_lower.get(item_col.lower(), item_col)
    actual_price_col = cols_lower.get(price_col.lower(), price_col)
    
    # Safely get the actual vendor column name
    actual_vendor_col = cols_lower.get(vendor_col.lower(), vendor_col)

    # Safely get the actual date column name if provided
    actual_date_col = None
    if date_col:
        actual_date_col = cols_lower.get(date_col.lower(), date_col)

    if actual_item_col not in df_clean.columns:
        print(f"[WARNING] Item column '{item_col}' not found; skipping top-items detailed.")
        return []
    if actual_price_col not in df_clean.columns:
        print(f"[WARNING] Price column '{price_col}' not found; skipping top-items detailed.")
        return []
    
    # Extract and clean the strings
    df_clean['clean_item_name'] = df_clean[actual_item_col].fillna("").astype(str).str.strip()

    # Clean the vendor column
    if actual_vendor_col in df_clean.columns:
        df_clean['clean_vendor_name'] = df_clean[actual_vendor_col].fillna("Unknown").astype(str).str.strip()
    else:
        df_clean['clean_vendor_name'] = "Unknown"

    # Extract the Year from the Date Column
    if actual_date_col and actual_date_col in df_clean.columns:
        df_clean['year'] = pd.to_datetime(df_clean[actual_date_col], errors='coerce').dt.year.fillna(0).astype(int).astype(str)
        df_clean['year'] = df_clean['year'].replace('0', 'Unknown')
    else:
        df_clean['year'] = 'All Time'

    # DEBUGGING
    if df_clean.empty:
        print(f"[TEST] No data remaining after filtering '{item_col}'. Check your column name!")
        return []

    # Clean the price column
    df_clean[actual_price_col] = df_clean[actual_price_col].astype(str).str.replace(r'[\$,]', '', regex=True)
    df_clean[actual_price_col] = pd.to_numeric(df_clean[actual_price_col], errors='coerce').fillna(0.0)



    # Calculate precise stats for every Item + Year + Vendor combination
    vendor_stats = df_clean.groupby(['clean_item_name', 'year', 'clean_vendor_name']).agg(
        vendor_count=('clean_item_name', 'count'),
        vendor_spent=(actual_price_col, 'sum')
    ).reset_index()

    # Pack these stats into a dictionary column so it serializes cleanly to JSON
    vendor_stats['vendor_dict'] = vendor_stats.apply(
        lambda r: {
            "name": r['clean_vendor_name'], 
            "count": r['vendor_count'], 
            "spend": r['vendor_spent']
        },
        axis=1
    )

    # Roll up everything to the Item level
    stats = vendor_stats.groupby(['clean_item_name', 'year']).agg(
        count=('vendor_count', 'sum'),
        total_spent=('vendor_spent', 'sum'),
        vendors=('vendor_dict', list)
    ).reset_index()
    
    stats = stats.sort_values(by='count', ascending=False).head(n)

    # DEBUGGING
    print(f"\n--- DATA PREVIEW ({item_col}) ---")
    if not stats.empty:
        # Print the top 5 to terminal
        print(stats[['clean_item_name', 'count']].head(5).to_string(index=False))
    else:
        print("Empty results.")
    print("-----------------------------------\n")

    return stats.to_dict(orient='records')

def save_top_items_detailed_summary(
    *,
    upload_id: str,
    dataset: str,
    storage_path: Optional[str],
    summary_name: str,
    title: str,
    df: pd.DataFrame,
    item_col: str,
    price_col: str,
    vendor_col: str,
    n: int = 20,
) -> None:
    """
    Computes detailed top items for a dataset and saves to:
    uploads/{upload_id}/summaries/{summary_name}
    """
    items = compute_top_items_detailed(
        df, item_col=item_col, price_col=price_col, vendor_col=vendor_col, n=n
    )
    
    if not items:
        return

    payload = top_counts_payload(title=title, items=items)
    
    save_summary(
        upload_id=upload_id,
        name=summary_name,
        dataset=dataset,
        storage_path=storage_path,
        payload=payload,
    )
    print(f"[OK] Saved detailed summary '{summary_name}' for upload_id={upload_id}")


def save_spend_over_time_summary(
    *,
    upload_id: str,
    dataset: str,
    storage_path: Optional[str],
    summary_name: str,
    title: str,
    df: pd.DataFrame,
    date_col: str = "Transaction Date",
    amount_col: str = "Total Price",
    time_period: str = "month",
    interval: Optional[str] = None,  # Backward-compatible alias
    transaction_type_col: Optional[str] = None,
    include_refunds: bool = True,
) -> None:
    chosen_time_period = interval or time_period
    points = compute_spend_over_time(
        df,
        date_col=date_col,
        amount_col=amount_col,
        time_period=chosen_time_period,
        transaction_type_col=transaction_type_col,
        include_refunds=include_refunds,
    )
    if not points:
        return

    payload = spend_over_time_payload(title=title, time_period=chosen_time_period, points=points)
    save_summary(
        upload_id=upload_id,
        name=summary_name,
        dataset=dataset,
        storage_path=storage_path,
        payload=payload,
    )
    print(f"[OK] Saved spend-over-time summary '{summary_name}' for upload_id={upload_id}")
