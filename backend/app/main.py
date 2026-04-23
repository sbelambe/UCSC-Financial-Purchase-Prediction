# Backend entry point and API router; connects frontend actions to backend
# behavior (ex: user clicks "Refresh Data"). Includes creating the FastAPI
# app, frontend/backend port communication through CORS Middleware, health
# and status checks, refresh data, and returning dashboard data
import sys, os, io
import pandas as pd
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from functools import lru_cache
from typing import Optional
from .analytics import get_item_freq, get_spend_over_time
from .analytics_bookstore import get_campus_store_item_insights
from .data_config import dataset_schema
from .dataset_explorer import get_dataset_explorer_rows
from .bigquery_service import query_spend_over_time_from_bigquery, query_top_items_from_bigquery, _bigquery_client
from firebase.summaries import compute_top_items_detailed
# # from backend.jobs.run_full_pipeline import run_full_pipeline
from dotenv import load_dotenv

load_dotenv()

# --- Path Configuration ---
# Add backend/ to sys.path so app, jobs, firebase, and data_cleaning packages can be imported.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.drive import sync_drive_folder
from jobs.run_full_pipeline import run_full_pipeline

load_dotenv()

# Create the FastAPI App.
app = FastAPI(title="UCSC Financial Dashboard API")

# --- CORS Middleware ---
# Allows the frontend (running on port 5173) to communicate with this backend (port 8000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  
)

@app.get("/health")
# Simple health check endpoint to verify the backend is running.
def health():
    return {"ok": True}

@app.get("/status")
# Simple backend status check.
def status():
    return {
        "job_running": False,
        "last_updated": None,
        "last_result": None,
        "message": "Backend is up",
    }

@app.post("/refresh")
# Runs the data cleaning pipeline to sync new files from Google
# Drive.
def refresh_data():
    try:
        folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")

        raw_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "data_cleaning",
            "data",
            "raw"
        )

        changed = sync_drive_folder(folder_id, raw_dir)

        if not changed:
            return {"status": "ok", "message": "No new Drive updates detected."}

        result = run_full_pipeline()
        return {"status": "ok", "message": "New Drive updates detected.", "result": result}
    
    except Exception as e:
        # If the pipeline crashes, tell the frontend why
        raise HTTPException(status_code=500, detail=str(e))
    
# Returns the item frequency/top item data
@app.get("/api/analytics/top-items")
def get_top_items(user_id: str):
    try:
        data = get_item_freq(user_id)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/top-items/bigquery")
def get_top_items_bigquery(
    dataset: str = "overall",
    search_query: str = "",
    selected_year: str = "All Time",
    selected_quarter: str = "All Quarters",
    min_spend: float = 0,
    limit: int = 20,
    sort_mode: str = "frequency",
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
        )
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/dataset-config")
def get_dataset_config(dataset: str = "overall"):
    try:
        normalized = dataset.strip().lower()
        return {"status": "success", "data": dataset_schema(normalized)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/api/dataset-explorer")
def dataset_explorer(
    dataset: str = "amazon",
    page: int = 1,
    page_size: int = 25,
    search: str = "",
    search_field: str = "all",
    merchant: str = "",
    category: str = "",
    start_date: str = "",
    end_date: str = "",
    sort_by: str = "Transaction Date",
    sort_dir: str = "desc",
):
    try:
        data = get_dataset_explorer_rows(
            dataset=dataset,
            page=page,
            page_size=page_size,
            search=search,
            search_field=search_field,
            merchant=merchant,
            category=category,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        return {"status": "success", "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Returns the time-series spend data
@app.get("/api/analytics/spend-over-time")
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


@app.get("/api/analytics/spend-over-time/bigquery")
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
@app.get("/analytics/campus-store-items")
def campus_store_items(top_n: int = 5, lookback_days: int = 90, account: str = "Campus Store"):
    """
    Returns most/least purchased Campus Store items and stock priority recommendations.
    """
    try:
        return _bookstore_items_response(top_n, lookback_days, account)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/bookstore-items")
def api_bookstore_items(top_n: int = 5, lookback_days: int = 90, account: str = "Campus Store"):
    """
    Standardized Bookstore analytics endpoint.
    """
    try:
        return _bookstore_items_response(top_n, lookback_days, account)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/campus-store-items")
def api_campus_store_items(top_n: int = 5, lookback_days: int = 90, account: str = "Campus Store"):
    """
    Alias for Campus Store analytics endpoint.
    """
    try:
        return _bookstore_items_response(top_n, lookback_days, account)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# This caches the last 10 unique time_period queries in server RAM.
@lru_cache(maxsize=10)
def fetch_forecast_from_bigquery(time_period: str):
    """
    Retrieves inventory health insights by comparing calculated current stock 
    against BigQuery ML predictive demand.
    
    Logic:
    1. Explanations: Fetches item-level demand forecast from BQML.
    2. TotalSales: Aggregates all-time historical sales from bookstore_cleaned.
    3. InventoryBaseline: Establishes a starting stock count (Mock for prototype).
    4. Comparison: Subtracts sales from baseline to find current stock and 
       evaluates if that stock covers the predicted demand.
    5. Incorporates yearly seasonality to explain the 'why' behind demand spikes.
    """
    bq_project = os.getenv("VITE_FIREBASE_PROJECT_ID", "")
    bq_dataset = os.getenv("BIGQUERY_DATASET", "")
    model_path = f"{bq_project}.{bq_dataset}.bookstore_inventory_forecast"

    horizon_map = {"1_month": 1, "1_quarter": 3, "6_months": 6, "1_year": 12}
    months_to_forecast = horizon_map.get(time_period, 3)

    # Query BigQuery ML
    # will ask bigquery to predict future sales for various categories, explains the historical trends, 
    # and compares those predicted numbers against the current stock
    sql = f"""
    -- Explanations calls the BQML model
    -- we SUM the predicted quantities over the horizon and AVG the trend/seasonality
    WITH Explanations AS (
        SELECT 
            item_name,
            SUM(time_series_data) as predicted_qty,
            SUM(prediction_interval_lower_bound) as lower_bound,
            SUM(prediction_interval_upper_bound) as upper_bound,
            AVG(trend) as avg_trend,
            AVG(seasonal_period_yearly) as yearly_seasonality
            FROM ML.EXPLAIN_FORECAST(MODEL `{model_path}`, 
                                 STRUCT({months_to_forecast} AS horizon))
        GROUP BY item_name
    ),

    TotalSales AS (
        -- Aggregate historical sales to calculate stock depletion
        SELECT 
            `Item Description` as item_name, 
            SUM(Quantity) as amount_sold 
        FROM `{bq_project}.{bq_dataset}.bookstore_cleaned`
        GROUP BY item_name
    ),

    InventoryBaseline AS (
        -- Baseline for theoretical inventory calculation
        SELECT item_name, 2000 as starting_stock FROM TotalSales
    ),

    -- CurrentStock represents the bookstore's stock of items
    CurrentStock AS (
        SELECT 
            b.item_name,
            (b.starting_stock - COALESCE(s.amount_sold, 0)) as stock
        FROM InventoryBaseline b
        LEFT JOIN TotalSales s ON b.item_name = s.item_name
    )

    -- we use LEFT JOIN so if the ML model predicts demand for an item out of stock (0 amount), it still appears in the final output
    SELECT 
        e.item_name,
        CAST(e.predicted_qty AS INT64) as predicted_qty,
        CAST(e.lower_bound as INT64) as lower_bound,
        CAST(e.upper_bound as INT64) as upper_bound,
        e.avg_trend,
        e.yearly_seasonality,
        COALESCE(CAST(c.stock AS INT64), 0) as current_stock   -- COALESCE handles the NULL -> 0 conversion
    FROM Explanations e
    LEFT JOIN CurrentStock c ON e.item_name = c.item_name
    WHERE e.item_name IS NOT NULL
      AND CAST(e.predicted_qty AS INT64) > 0
    ORDER BY ABS(CAST(c.stock AS INT64) - CAST(e.predicted_qty AS INT64)) DESC
    LIMIT 25
    """
    
    bq_client = _bigquery_client()
    query_job = bq_client.query(sql)
    results = []

    for row in query_job.result():
        # data extraction
        item_name = row["item_name"]
        category = row["item_name"]
        predicted = int(row["predicted_qty"] or 0)
        stock = max(0, int(row["current_stock"] or 0))
        trend = row["avg_trend"] or 0
        seasonality = row["yearly_seasonality"] or 0
        upper = int(row["upper_bound"] or 0)
        lower = int(row["lower_bound"] or 0)

        # 1. CALCULATE ACTUAL CERTAINTY SCORE
        # Formula: 1 - (Range Width / (2 * Predicted))
        # A tight range = high certainty. A wide range = low certainty.
        if predicted > 0:
            interval_width = upper - lower
            # We normalize the width against the prediction to get a percentage
            error_margin = interval_width / (predicted * 2) if predicted > 0 else 0.5
            certainty_score = max(5, min(99, int((1 - error_margin) * 100)))
        else:
            certainty_score = 50 # Default for items with no predicted sales

        # 2. HANDLE "NO SEASONALITY" DATA
        # we adjust the reasoning to reflect that this is a "Steady" item
        if seasonality == 0:
            seasonality_impact = "a stable, non-seasonal baseline"
        else:
            seasonality_impact = "historical seasonal spikes" if seasonality > 0 else "standard seasonal baseline"
        
        # Reasoning Section
        # =================
        # we calculate the shortfall (predicted - actual) to see if what we predicted match up with the actual stock
        shortfall = predicted - stock

        # update AI text generation to handle flat '0's
        if trend > 0.05:
            trend_direction = "growing"
        elif trend < -0.05:
            trend_direction = "declining"
        else:
            trend_direction = "stable"

        # seasonality_impact = "a strong historical seasonal spike" if seasonality > 0 else "standard seasonal baseline"

        # Logic gate: will we completely run out of stock?
        if shortfall > 0:
            action = "Critical Reorder" if shortfall > (stock * 0.5) else "Reorder Soon"
            reasoning = (
                f"Predicted shortfall of {shortfall} units. "
                f"The model projects {predicted} sales driven by a {trend_direction} long-term trend "
                f"and {seasonality_impact}. Current stock ({stock}) will not cover the selected period."
            )

        # Logic gate: Are we within 20 units of running out of stock (the danger zone)?
        elif shortfall > -20:
            action = "Monitor Closely"
            reasoning = (
                f"Stock is cutting it close. You have {stock} units to cover a predicted demand of {predicted}. "
                f"Based on historical data, unexpected {seasonality_impact} variance could cause a stockout."
            )

        # Logic gate: Dead Stock Risk
        elif stock > upper:
            action = "Dead Stock Risk"
            excess = stock - upper
            reasoning = (
                f"Overstock Risk: Current stock ({stock}) exceeds the highest projected demand ({upper}). "
                f"Historical baseline trend is {trend_direction}, suggesting ~{excess} units of trapped capital."
            )

        # Logic gate: otherwise, we have plenty of stock left
        else:
            action = "Adequate Stock"
            reasoning = (
                f"No immediate action needed. Current stock ({stock}) safely covers the predicted demand ({predicted}). "
                f"Historical baseline trend is {trend_direction}, but you have sufficient buffer."
            )

        reliability = "High" if certainty_score > 80 else "Moderate" if certainty_score > 50 else "Low"

        # Final Payload
        results.append({
            "category": category,
            "current_stock": stock,
            "predicted_demand": predicted,
            "lower_bound": lower,
            "upper_bound": upper,
            "certainty_score": certainty_score,
            "action": action,
            "reasoning": f"{reasoning} Model reliability is {reliability} ({certainty_score}% certainty) based on prediction variance.",
            "trend_direction": trend_direction
        }) 

    return results

@app.get("/api/analytics/bookstore-insights")
def get_bookstore_insights(time_period: str = Query("1_quarter", description="Time horizon for forecast")):
    try:
        # This will be instant if the time_period was requested recently
        results = fetch_forecast_from_bigquery(time_period)
        return {"status": "success", "time_period": time_period, "data": results}
    except Exception as e:
        print(f"[ERROR] Bookstore Insights: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch ML insights from BigQuery.")
    
    
# Accepts and uploads CSVs for data projection
@app.post("/api/analytics/project")
async def project_csv_data(
    file: UploadFile = File(...),
    dataset: str = Form(...) 
):
    try:
        print(f"Starting in-memory staging for dataset: {dataset}")
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        # clean up column names immediately (strip whitespace)
        df.columns = [c.strip() for c in df.columns]
        
        # map columns (including date)
        dataset_lower = dataset.lower()

        # Helper to find a column even if the user didn't match case perfectly
        def find_col(possible_names):
            for name in possible_names:
                if name in df.columns: return name
            # Fallback to the first column if all else fails so it doesn't crash
            return df.columns[0]
        
        if dataset_lower == "amazon":
            item_col = find_col(["Title", "Item Name", "Product Name"])
            price_col = find_col(["Item Total", "Price", "Total"])
            vendor_col = find_col(["Seller", "Merchant"])
            date_col = find_col(["Order Date", "Date"])

        elif dataset_lower == "cruzbuy":
            item_col = find_col(["Product Description", "Description", "Item Description"])
            price_col = find_col(["Extended Price", "Total Price", "Amount"])
            vendor_col = find_col(["Supplier Name", "Supplier", "Vendor"])
            date_col = find_col(["PO Date", "Date", "Created Date"])

        elif dataset_lower == "onecard":
            item_col = find_col(["Transaction Description", "Description"])
            price_col = find_col(["Amount", "Transaction Amount"])
            vendor_col = find_col(["Merchant", "Vendor Name"])
            date_col = find_col(["Transaction Date", "Date"])
            
        else:
            raise ValueError(f"Unknown dataset type: {dataset}")

        # --- LOGGING FOR DEBUGGING ---
        # inside the /project_csv_data endpoint
        print(f"Detected columns - Item: {item_col}, Price: {price_col}, Date: {date_col}")

        projected_items = compute_top_items_detailed(df, item_col, price_col, vendor_col, date_col)
        
        # process Spend Over Time (Group by YYYY-MM)
        df_time = df.copy()
        df_time[price_col] = df_time[price_col].astype(str).str.replace(r'[\$,]', '', regex=True)
        df_time[price_col] = pd.to_numeric(df_time[price_col], errors='coerce').fillna(0.0)
        df_time['temp_date'] = pd.to_datetime(df_time[date_col], errors='coerce')
        
        # group into "YYYY-MM"
        df_time['period'] = df_time['temp_date'].dt.to_period("M").astype(str) 
        time_stats = df_time.groupby('period')[price_col].sum().reset_index()
        
        time_series_data = [{"period": row['period'], "pending_spend": row[price_col]} for _, row in time_stats.iterrows()]

        print(f"[OK] Successfully staged {len(projected_items)} items and {len(time_series_data)} months.")
        
        # return both arrays
        return {
            "status": "success",
            "dataset": dataset_lower,
            "data": projected_items,       # For the table
            "time_data": time_series_data  # For the chart
        }
        
    except Exception as e:
        print(f"[ERROR] Staging failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
# Entry point for running via 'py app/main.py' directly
if __name__ == "__main__":
    import uvicorn
    # reload=True allows auto-restart on code changes
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
