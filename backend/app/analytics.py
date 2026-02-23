from .firebase import db
from google.cloud.firestore import FieldFilter
from datetime import datetime
from collections import defaultdict
from typing import Dict, Any, Optional, List

DEFAULT_UPLOAD_IDS = {
    "cruzbuy": "050b029b-8c03-41ea-aad6-668ae16f0985",
    "amazon": "36938f90-f75f-462d-b18c-beb7141964bf",
    "pcard": "40165d34-fd1f-4e50-b5f5-40484e8cd6a3",
}


def _parse_amount(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)

    s = str(value).strip()
    if not s:
        return None

    # Handles "$2,353.88", "4998.67", "-$10.00", etc.
    s = s.replace("$", "").replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def _parse_transaction_date(value: Any) -> Optional[datetime]:
    if value is None:
        return None

    s = str(value).strip()
    if not s:
        return None

    # Cleaned rows are "YYYY-MM-DD", but this accepts timestamps too.
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass

    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def _period_key(dt: datetime, interval: str) -> str:
    if interval == "day":
        return dt.strftime("%Y-%m-%d")
    if interval == "week":
        year, week, _ = dt.isocalendar()
        return f"{year}-W{week:02d}"
    return dt.strftime("%Y-%m")


def _dataset_rows(upload_id: str) -> List[Dict[str, Any]]:
    docs = (
        db.collection("uploads")
        .document(upload_id)
        .collection("rows")
        .stream()
    )
    return [doc.to_dict() for doc in docs]


def get_spend_over_time(
    *,
    upload_ids: Optional[Dict[str, str]] = None,
    interval: str = "month",
    include_refunds: bool = True,
) -> Dict[str, Any]:
    if interval not in {"day", "week", "month"}:
        raise ValueError("interval must be one of: day, week, month")

    chosen_upload_ids = upload_ids or DEFAULT_UPLOAD_IDS
    dataset_series: Dict[str, Dict[str, float]] = {}
    combined = defaultdict(float)
    errors = {}

    for dataset in ("amazon", "cruzbuy", "pcard"):
        upload_id = chosen_upload_ids.get(dataset)
        if not upload_id:
            errors[dataset] = "missing upload_id"
            dataset_series[dataset] = {}
            continue

        try:
            rows = _dataset_rows(upload_id)
        except Exception as e:
            errors[dataset] = str(e)
            dataset_series[dataset] = {}
            continue

        agg = defaultdict(float)
        for row in rows:
            dt = _parse_transaction_date(row.get("Transaction_Date"))
            if dt is None:
                continue

            amount = _parse_amount(row.get("Total_Price"))
            if amount is None:
                amount = _parse_amount(row.get("Subtotal"))
            if amount is None:
                continue

            # Optional exclusion of refunds for pcard.
            if dataset == "pcard" and not include_refunds:
                if str(row.get("Transaction_Type", "")).lower() == "refund" or amount < 0:
                    continue

            key = _period_key(dt, interval)
            agg[key] += amount
            combined[key] += amount

        dataset_series[dataset] = dict(sorted(agg.items()))

    return {
        "interval": interval,
        "include_refunds": include_refunds,
        "upload_ids": chosen_upload_ids,
        "datasets": {
            name: [{"period": p, "spend": round(v, 2)} for p, v in series.items()]
            for name, series in dataset_series.items()
        },
        "combined": [{"period": p, "spend": round(v, 2)} for p, v in sorted(combined.items())],
        "errors": errors,
    }


def get_item_freq(user_id: str, limit: int = 20):
    """
    Queries the 'summaries' collection group for all 'top_items_detailed' documents.
    Groups the results by dataset (amazon, cruzbuy, pcard) to perfectly match 
    the structure of the frontend's preview_data.json.
    """
    print("Fetching pre-calculated summaries from 'summaries' collection group...")
    
    try:
        docs = db.collection_group("summaries").where(filter=FieldFilter("name", "==", "top_items_detailed")).stream()
        
        # 1. Initialize buckets to match your preview_data.json keys
        grouped_stats = {
            "amazon": {},
            "cruzbuy": {},
            "pcard": {}
        }
        
        doc_count = 0
        for doc in docs:
            doc_count += 1
            data = doc.to_dict()
            
            # 2. Identify which platform this document belongs to
            dataset = data.get("dataset", "unknown").lower()
            payload = data.get("payload", {})
            items = payload.get("items", [])
            
            # If a new dataset appears, safely initialize it
            if dataset not in grouped_stats:
                grouped_stats[dataset] = {}
                
            target_group = grouped_stats[dataset]

            for item in items:
                name = item.get("clean_item_name", "").strip()
                if not name:
                    continue

                if name not in target_group:
                    target_group[name] = {
                        "clean_item_name": name,
                        "count": 0,
                        "total_spent": 0.0,
                        "vendors": set()
                    }
                
                # --- SAFEGUARD: Handle legacy string data ---
                raw_spent = item.get("total_spent", 0.0)
                if isinstance(raw_spent, str):
                    try:
                        clean_spent = float(raw_spent.replace('$', '').replace(',', '').strip())
                    except ValueError:
                        clean_spent = 0.0
                else:
                    clean_spent = float(raw_spent)
                # --------------------------------------------
                
                target_group[name]["count"] += item.get("count", 0)
                target_group[name]["total_spent"] += clean_spent
                
                vendors = item.get("vendors", [])
                if isinstance(vendors, list):
                    for v in vendors:
                        target_group[name]["vendors"].add(v)
                elif isinstance(vendors, str):
                    target_group[name]["vendors"].add(vendors)

        if doc_count == 0:
            print("No detailed summary documents found! Run the ETL script first.")
            return {"amazon": [], "cruzbuy": [], "pcard": []}
            
        print(f"Successfully fetched and grouped data from {doc_count} summary documents.")
        
        # 3. Format the final output to mirror preview_data.json
        final_result = {}
        for ds, items_dict in grouped_stats.items():
            final_list = list(items_dict.values())
            for item in final_list:
                item["vendors"] = list(item["vendors"])
                
            # Sort each section independently and apply the limit
            final_list.sort(key=lambda x: x["count"], reverse=True)
            final_result[ds] = final_list[:limit]

        return final_result
            
    except Exception as e:
        print(f"CRITICAL FIREBASE ERROR: {e}")
        return {"amazon": [], "cruzbuy": [], "pcard": []}