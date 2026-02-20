import os
from datetime import datetime, timedelta

import pandas as pd


CANONICAL_COLUMNS = [
    "Account",
    "Product Category",
    "Item",
    "UPC Code",
    "Date",
    "Quantity",
]


def _normalize_colname(name: str) -> str:
    return "".join(ch for ch in str(name).strip().lower() if ch.isalnum())


def _map_columns(df: pd.DataFrame) -> pd.DataFrame:
    normalized = {_normalize_colname(col): col for col in df.columns}

    alias_map = {
        "Account": ["account", "accountname"],
        "Product Category": ["productcategory", "category", "categorycleaned"],
        "Item": ["item", "description", "itemdescription", "product", "productname"],
        "UPC Code": ["upccode", "upc", "upccodes", "sku", "skucatalog"],
        "Date": ["date", "transactiondate", "orderdate", "podate"],
        "Quantity": ["quantity", "qty", "orderquantity"],
    }

    rename_map = {}
    for canonical, aliases in alias_map.items():
        for alias in aliases:
            original = normalized.get(alias)
            if original:
                rename_map[original] = canonical
                break

    df = df.rename(columns=rename_map)
    for col in CANONICAL_COLUMNS:
        if col not in df.columns:
            df[col] = pd.NA
    return df[CANONICAL_COLUMNS].copy()


def _find_preferred_source_file(base_dir: str) -> str | None:
    candidates: list[str] = []

    clean_dir = os.path.join(base_dir, "data_cleaning", "clean")
    raw_dir = os.path.join(base_dir, "data_cleaning", "raw")

    for folder in [clean_dir, raw_dir]:
        if not os.path.isdir(folder):
            continue
        for name in os.listdir(folder):
            lower = name.lower()
            if lower.endswith(".csv") or lower.endswith(".xlsx"):
                candidates.append(os.path.join(folder, name))

    if not candidates:
        return None

    def score(path: str) -> tuple[int, int]:
        name = os.path.basename(path).lower()
        is_clean = 1 if "clean" in path else 0
        keyword_points = 0
        for keyword in ["cruzbuy", "campus", "store", "transaction"]:
            if keyword in name:
                keyword_points += 1
        return (is_clean + keyword_points, len(name) * -1)

    candidates.sort(key=score, reverse=True)
    return candidates[0]


def _load_campus_store_sheet() -> pd.DataFrame:
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    source_path = _find_preferred_source_file(backend_dir)
    if not source_path:
        return pd.DataFrame(columns=CANONICAL_COLUMNS)

    if source_path.lower().endswith(".xlsx"):
        df = pd.read_excel(source_path)
    else:
        df = pd.read_csv(source_path)

    df = _map_columns(df)

    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df["Quantity"] = pd.to_numeric(df["Quantity"], errors="coerce")
    df["Item"] = df["Item"].astype("string").str.strip()
    df["Product Category"] = df["Product Category"].astype("string").str.strip()
    df["Account"] = df["Account"].astype("string").str.strip()

    df = df.dropna(subset=["Item", "Date", "Quantity"])
    df = df[df["Quantity"] > 0]

    return df


def _serialize_item_rows(df: pd.DataFrame) -> list[dict]:
    rows = []
    for _, row in df.iterrows():
        rows.append(
            {
                "item": str(row["Item"]),
                "product_category": None if pd.isna(row["Product Category"]) else str(row["Product Category"]),
                "quantity": float(row["quantity"]),
                "purchase_count": int(row["purchase_count"]),
                "last_purchase_date": row["last_purchase_date"].date().isoformat(),
            }
        )
    return rows


def get_campus_store_item_insights(
    top_n: int = 5,
    lookback_days: int = 90,
    account_filter: str | None = "Campus Store",
) -> dict:
    df = _load_campus_store_sheet()

    if df.empty:
        return {
            "account_filter": account_filter,
            "lookback_days": lookback_days,
            "total_rows": 0,
            "most_bought": [],
            "least_bought": [],
            "stock_now": [],
            "stock_soon": [],
            "message": "No Campus Store data available.",
        }

    if account_filter:
        filtered = df[df["Account"].str.contains(account_filter, case=False, na=False)].copy()
        if not filtered.empty:
            df = filtered

    grouped = (
        df.groupby(["Item", "Product Category"], dropna=False)
        .agg(
            quantity=("Quantity", "sum"),
            purchase_count=("Quantity", "size"),
            last_purchase_date=("Date", "max"),
        )
        .reset_index()
    )

    if grouped.empty:
        return {
            "account_filter": account_filter,
            "lookback_days": lookback_days,
            "total_rows": 0,
            "most_bought": [],
            "least_bought": [],
            "stock_now": [],
            "stock_soon": [],
            "message": "No purchasable items found in Campus Store data.",
        }

    most_bought = grouped.sort_values(["quantity", "purchase_count"], ascending=[False, False]).head(top_n)
    least_bought = grouped.sort_values(["quantity", "purchase_count"], ascending=[True, True]).head(top_n)

    cutoff = datetime.now() - timedelta(days=lookback_days)
    recent_df = df[df["Date"] >= cutoff].copy()

    if recent_df.empty:
        stock_now = most_bought.head(min(3, len(most_bought))).copy()
        stock_soon = most_bought.iloc[min(3, len(most_bought)):min(6, len(most_bought))].copy()
    else:
        recent_grouped = (
            recent_df.groupby(["Item", "Product Category"], dropna=False)
            .agg(
                quantity=("Quantity", "sum"),
                purchase_count=("Quantity", "size"),
                last_purchase_date=("Date", "max"),
            )
            .reset_index()
        )

        now = datetime.now()
        recent_grouped["days_since_last"] = (now - recent_grouped["last_purchase_date"]).dt.days.clip(lower=0)

        qty_max = max(recent_grouped["quantity"].max(), 1)
        count_max = max(recent_grouped["purchase_count"].max(), 1)
        days_max = max(recent_grouped["days_since_last"].max(), 1)

        recent_grouped["demand_score"] = (
            (recent_grouped["quantity"] / qty_max) * 0.6
            + (recent_grouped["purchase_count"] / count_max) * 0.3
            + ((days_max - recent_grouped["days_since_last"]) / days_max) * 0.1
        )

        ranked = recent_grouped.sort_values("demand_score", ascending=False)
        stock_now = ranked.head(min(5, len(ranked))).copy()
        stock_soon = ranked.iloc[min(5, len(ranked)):min(10, len(ranked))].copy()

    return {
        "account_filter": account_filter,
        "lookback_days": lookback_days,
        "total_rows": int(len(df)),
        "most_bought": _serialize_item_rows(most_bought),
        "least_bought": _serialize_item_rows(least_bought),
        "stock_now": _serialize_item_rows(stock_now),
        "stock_soon": _serialize_item_rows(stock_soon),
    }
