from fastapi import APIRouter, HTTPException, Query
from app.bigquery_service import (
    fetch_bookstore_forecast_from_bigquery,
    fetch_amazon_forecast_from_bigquery,
    fetch_item_history,
    fetch_amazon_bookstore_recommendations
)

router = APIRouter(
    prefix="/api/analytics",
    tags=["insights"]
)

@router.get("/bookstore-insights")
def get_bookstore_insights(
    time_period: str = Query("1_quarter", description="Time horizon for forecast"),
    dev_mode: bool = Query(False, description="Use synthetic dev data and dev model"),
):
    try:
        results = fetch_bookstore_forecast_from_bigquery(time_period, dev_mode)
        return {"status": "success", "time_period": time_period, "dev_mode": dev_mode, "data": results}
    except Exception as e:
        print(f"[ERROR] Bookstore Insights: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch ML insights from BigQuery.")


@router.get("/amazon-insights")
def get_amazon_insights(
    time_period: str = Query("1_quarter", description="Time horizon for forecast"),
    dev_mode: bool = Query(False, description="Use synthetic dev data and dev model"),
):
    try:
        results = fetch_amazon_forecast_from_bigquery(time_period, dev_mode)
        return {"status": "success", "time_period": time_period, "dev_mode": dev_mode, "data": results}
    except Exception as e:
        print(f"[ERROR] Amazon Insights: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch Amazon ML insights from BigQuery.")
    

@router.get("/item-history")
def get_item_history(
    item_name: str = Query(..., description="Exact Item Description from bookstore_cleaned"),
    dev_mode: bool = Query(False),
):
    try:
        history = fetch_item_history(item_name, dev_mode)
        return {"item_name": item_name, "history": history}
    except Exception as e:
        print(f"[ERROR] Item History ({item_name}): {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch item history from BigQuery.")
    

@router.get("/cache/clear")
def clear_cache():
    """Dev utility: clears all lru_cache entries so new SQL takes effect without restart."""
    fetch_bookstore_forecast_from_bigquery.cache_clear()
    fetch_amazon_forecast_from_bigquery.cache_clear()
    fetch_item_history.cache_clear()
    fetch_amazon_bookstore_recommendations.cache_clear()
    return {"status": "ok", "message": "All caches cleared."}