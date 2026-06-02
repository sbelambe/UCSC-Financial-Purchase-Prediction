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

def sanitize_forecast_data(forecast_rows, historical_max_spend):
    """
    Validates and sanitizes ML predictions before sending them to the frontend
    Ensures no negative spend/stock and flags extreme anomalies
    """
    sanitized_data = []

    # define an anomaly as a prediction that is greater than 200% of the historical max
    ANOMALY_THRESHOLD = historical_max_spend * 2.0

    for row in forecast_rows:
        # floor negative predictions to exactly 0
        safe_prediction = max(0.0, float(row.get("predicted_spend", 0.0)))

        # floor confidence intervals (so the lower bound isn't negative)
        safe_lower_bound = max(0.0, float(row.get("prediction_interval_lower_bound", 0.0)))
        safe_upper_bound = max(0.0, float(row.get("prediction_interval_upper_bound", 0.0)))

        is_anomaly = safe_prediction > ANOMALY_THRESHOLD

        sanitized_data.append({
            "date": row["forecast_timestamp"],
            "predicted_spend": safe_prediction,
            "lower_bound": safe_lower_bound,
            "upper_bound": safe_upper_bound,
            "is_anomaly": is_anomaly,
            "warning": "Unusually high projection" if is_anomaly else None
        })

    return sanitized_data



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
    item_name: str = Query(..., description="Exact Item Description"),
    dev_mode: bool = Query(False),
    dataset_type: str = Query("bookstore", description="Either 'bookstore' or 'amazon'"),
):
    try:
        history = fetch_item_history(item_name, dev_mode, dataset_type)
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