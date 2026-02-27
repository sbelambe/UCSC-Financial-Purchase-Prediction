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


def _period_key(dt: datetime, time_period: str) -> str:
    if time_period == "day":
        return dt.strftime("%Y-%m-%d")
    if time_period == "week":
        year, week, _ = dt.isocalendar()
        return f"{year}-W{week:02d}"
    if time_period == "year":
        return dt.strftime("%Y")
    return dt.strftime("%Y-%m")


def _dataset_rows(upload_id: str) -> List[Dict[str, Any]]:
    docs = (
        db.collection("uploads")
        .document(upload_id)
        .collection("rows")
        .stream()
    )
    return [doc.to_dict() for doc in docs]


def _dataset_spend_summary(upload_id: str, time_period: str) -> List[Dict[str, Any]]:
    doc = (
        db.collection("uploads")
        .document(upload_id)
        .collection("summaries")
        .document(f"spend_over_time_{time_period}")
        .get()
    )

    if not doc.exists:
        return []

    payload = doc.to_dict().get("payload", {})
    points = payload.get("points", [])
    normalized: List[Dict[str, Any]] = []
    for point in points:
        period = str(point.get("period", "")).strip()
        spend = _parse_amount(point.get("spend"))
        if not period or spend is None:
            continue
        normalized.append({"period": period, "spend": round(float(spend), 2)})
    return normalized


def get_spend_over_time(
    *,
    upload_ids: Optional[Dict[str, str]] = None,
    time_period: str = "month",
    interval: Optional[str] = None,  # Backward-compatible alias
    include_refunds: bool = True,
) -> Dict[str, Any]:
    chosen_time_period = interval or time_period
    if chosen_time_period not in {"day", "week", "month", "year"}:
        raise ValueError("time_period must be one of: day, week, month, year")

    chosen_upload_ids = upload_ids or DEFAULT_UPLOAD_IDS
    dataset_series: Dict[str, List[Dict[str, Any]]] = {}
    combined = defaultdict(float)
    errors = {}

    for dataset in ("amazon", "cruzbuy", "pcard"):
        upload_id = chosen_upload_ids.get(dataset)
        if not upload_id:
            errors[dataset] = "missing upload_id"
            dataset_series[dataset] = []
            continue

        try:
            points = _dataset_spend_summary(upload_id, chosen_time_period)
        except Exception as e:
            errors[dataset] = str(e)
            dataset_series[dataset] = []
            continue

        if dataset == "pcard" and not include_refunds:
            errors[dataset] = (
                "summary data is generated with refunds included; rerun ETL with "
                "a no-refund summary if you need exclude_refunds behavior"
            )

        dataset_series[dataset] = points
        for point in points:
            combined[str(point["period"])] += float(point["spend"])

    return {
        "time_period": chosen_time_period,
        "interval": chosen_time_period,  # Kept for existing frontend compatibility
        "include_refunds": include_refunds,
        "upload_ids": chosen_upload_ids,
        "datasets": dataset_series,
        "combined": [{"period": p, "spend": round(v, 2)} for p, v in sorted(combined.items())],
        "errors": errors,
    }


def get_item_freq(user_id: str, limit: int = 20):
    """
    Queries the 'summaries' collection group for all 'top_items_detailed' documents, 
    merges the results, and returns the highest frequency items.
    """
    print("Fetching pre-calculated summaries from 'summaries' collection group...")
    
    try:
        # Fetch only documents named "top_items_detailed" across all uploads
        docs = db.collection_group("summaries").where(filter=FieldFilter("name", "==", "top_items_detailed")).stream()
        
        # Merge dictionary to combine stats across multiple uploads
        merged_stats = {}
        
        doc_count = 0
        for doc in docs:
            doc_count += 1
            payload = doc.to_dict().get("payload", {})
            items = payload.get("items", [])
            
            for item in items:
                name = item["clean_item_name"]
                if name not in merged_stats:
                    merged_stats[name] = {
                        "clean_item_name": name,
                        "count": 0,
                        "total_spent": 0.0,
                        "vendors": set()
                    }
                
                merged_stats[name]["count"] += item["count"]
                merged_stats[name]["total_spent"] += item["total_spent"]
                for v in item["vendors"]:
                    merged_stats[name]["vendors"].add(v)

        if doc_count == 0:
            print("No detailed summary documents found! Run the ETL script first.")
            return []
            
        print(f"Successfully merged data from {doc_count} summary documents.")
        
        # Convert sets back to lists for JSON serialization
        final_list = list(merged_stats.values())
        for item in final_list:
            item["vendors"] = list(item["vendors"])
            
        # Sort by count descending and apply limit
        final_list.sort(key=lambda x: x["count"], reverse=True)
        return final_list[:limit]
            
    except Exception as e:
        print(f"CRITICAL FIREBASE ERROR: {e}")
        return []
