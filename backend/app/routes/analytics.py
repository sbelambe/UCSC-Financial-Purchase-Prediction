from fastapi import APIRouter, HTTPException
from typing import Optional
from app.analytics import get_item_freq, get_spend_over_time
from app.analytics_bookstore import get_campus_store_item_insights
from app.data_config import dataset_schema
from app.bigquery_service import query_spend_over_time_from_bigquery, query_top_items_from_bigquery

router = APIRouter(tags=["analytics"])

# Returns the item frequency/top item data
@router.get("/api/analytics/top-items")
def get_top_items(user_id: str):
    try:
        data = get_item_freq(user_id)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/analytics/top-items/bigquery")
def get_top_items_bigquery(
    dataset: str = "overall",
    search_query: str = "",
    selected_year: str = "All Time",
    selected_quarter: str = "All Quarters",
    min_spend: float = 0,
    limit: int = 20,
    sort_mode: str = "frequency",
    group_by: str = "item",
):
    try:
        data = query_top_items_from_bigquery(
            dataset=dataset,
            search_query=search_query,
            selected_year=selected_year,
            selected_quarter=selected_quarter,
            min_spend=min_spend,
            limit=limit,
            sort_mode=sort_mode,
            group_by=group_by,
        )
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/analytics/dataset-config")
def get_dataset_config(dataset: str = "overall"):
    try:
        normalized = dataset.strip().lower()
        return {"status": "success", "data": dataset_schema(normalized)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Returns the time-series spend data
@router.get("/api/analytics/spend-over-time")
def spend_over_time(
    time_period: str = "month",
    interval: Optional[str] = None,  # Backward-compatible alias
    include_refunds: bool = True,
    amazon_upload_id: Optional[str] = None,
    cruzbuy_upload_id: Optional[str] = None,
    onecard_upload_id: Optional[str] = None,
):
    try:
        upload_ids = None
        if amazon_upload_id or cruzbuy_upload_id or onecard_upload_id:
            upload_ids = {
                "amazon": amazon_upload_id,
                "cruzbuy": cruzbuy_upload_id,
                "onecard": onecard_upload_id,
            }

        data = get_spend_over_time(
            upload_ids=upload_ids,
            time_period=time_period,
            interval=interval,
            include_refunds=include_refunds,
        )
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/analytics/spend-over-time/bigquery")
def spend_over_time_bigquery(
    dataset: str = "overall",
    time_period: str = "month",
    selected_year: str = "All Time",
    selected_quarter: str = "All Quarters",
):
    try:
        data = query_spend_over_time_from_bigquery(
            dataset=dataset,
            time_period=time_period,
            selected_year=selected_year,
            selected_quarter=selected_quarter,
        )
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _bookstore_items_response(top_n: int, lookback_days: int, account: str):
    return get_campus_store_item_insights(
        top_n=top_n,
        lookback_days=lookback_days,
        account_filter=account,
    )

# Bookstore-related analytics endpoints
@router.get("/analytics/campus-store-items")
def campus_store_items(top_n: int = 5, lookback_days: int = 90, account: str = "Campus Store"):
    """
    Returns most/least purchased Campus Store items and stock priority recommendations.
    """
    try:
        return _bookstore_items_response(top_n, lookback_days, account)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/analytics/bookstore-items")
def api_bookstore_items(top_n: int = 5, lookback_days: int = 90, account: str = "Campus Store"):
    """
    Standardized Bookstore analytics endpoint.
    """
    try:
        return _bookstore_items_response(top_n, lookback_days, account)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/analytics/campus-store-items")
def api_campus_store_items(top_n: int = 5, lookback_days: int = 90, account: str = "Campus Store"):
    """
    Alias for Campus Store analytics endpoint.
    """
    try:
        return _bookstore_items_response(top_n, lookback_days, account)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))