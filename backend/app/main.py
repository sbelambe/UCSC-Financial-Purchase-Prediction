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
    
# This caches the last 30 unique (time_period, dev_mode, lookback) combos in server RAM.
@lru_cache(maxsize=30)
def fetch_forecast_from_bigquery(time_period: str, dev_mode: bool = False, lookback: str = "2_year"):
    """
    Retrieves inventory health insights by comparing current stock against BQML demand forecasts.

    Key fixes vs. original:
    - Filters ML.EXPLAIN_FORECAST to time_series_type = 'forecast' only (historical rows were
      being summed in, inflating predictions by 10-30x).
    - Uses a rolling 6-month window for stock depletion instead of all-time sales.
    - Adds a HistoricalContext CTE that computes the average sales for the same calendar
      period (the months being forecast) across the past N years, giving a reality-check
      baseline alongside the ML prediction.
    """
    import datetime
    bq_project = os.getenv("VITE_FIREBASE_PROJECT_ID", "")
    bq_dataset = os.getenv("BIGQUERY_DATASET", "")
    model_suffix = "_dev" if dev_mode else ""
    model_path = f"{bq_project}.{bq_dataset}.bookstore_inventory_forecast{model_suffix}"
    data_table = f"{bq_project}.{bq_dataset}.bookstore_cleaned{model_suffix}"

    horizon_map = {"1_month": 1, "1_quarter": 3, "6_months": 6, "1_year": 12}
    months_to_forecast = horizon_map.get(time_period, 3)

    lookback_map = {"1_year": 1, "2_year": 2, "3_year": 3}
    lookback_years = lookback_map.get(lookback, 2)

    # Compute which calendar months we are forecasting (starting next month from today)
    today = datetime.date.today()
    forecast_months = [((today.month - 1 + i + 1) % 12) + 1 for i in range(months_to_forecast)]
    month_list_sql = ", ".join(str(m) for m in forecast_months)

    # Year range for historical comparison: the past N complete years before the current one
    hist_end_year   = today.year - 1
    hist_start_year = today.year - lookback_years

    sql = f"""
    -- Only sum FORECAST rows (not 'history' fitted rows).
    -- Without this filter, ML.EXPLAIN_FORECAST returns historical fitted values too,
    -- and summing all of them inflates predicted_qty by the full length of the training set.
    WITH Explanations AS (
        SELECT
            item_name,
            SUM(time_series_data)                  AS predicted_qty,
            SUM(prediction_interval_lower_bound)   AS lower_bound,
            SUM(prediction_interval_upper_bound)   AS upper_bound,
            AVG(trend)                             AS avg_trend,
            AVG(seasonal_period_yearly)            AS yearly_seasonality
        FROM ML.EXPLAIN_FORECAST(
            MODEL `{model_path}`,
            STRUCT({months_to_forecast} AS horizon)
        )
        WHERE time_series_type = 'forecast'
        GROUP BY item_name
    ),

    -- AllTimeSales builds the item universe; not used directly for stock depletion.
    AllTimeSales AS (
        SELECT `Item Description` AS item_name, SUM(Quantity) AS total_sold
        FROM `{data_table}`
        GROUP BY item_name
    ),

    -- RecentSales: only the past 6 months deplete current shelf stock.
    -- Using all-time sales would always exceed a fixed baseline and show 0 for everything.
    RecentSales AS (
        SELECT `Item Description` AS item_name, SUM(Quantity) AS recent_sold
        FROM `{data_table}`
        WHERE CAST(`Transaction Date` AS DATE) >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        GROUP BY item_name
    ),

    InventoryBaseline AS (
        SELECT item_name, 500 AS starting_stock FROM AllTimeSales
    ),

    CurrentStock AS (
        SELECT
            b.item_name,
            (b.starting_stock - COALESCE(r.recent_sold, 0)) AS stock
        FROM InventoryBaseline b
        LEFT JOIN RecentSales r ON b.item_name = r.item_name
    ),

    -- HistoricalContext: average sales for the SAME calendar months we are forecasting,
    -- measured over the past {lookback_years} year(s). This grounds the ML prediction
    -- in observed same-period demand from prior years.
    HistoricalContext AS (
        SELECT item_name, AVG(period_qty) AS historical_avg
        FROM (
            SELECT
                `Item Description`                                    AS item_name,
                EXTRACT(YEAR FROM CAST(`Transaction Date` AS DATE))   AS yr,
                SUM(Quantity)                                         AS period_qty
            FROM `{data_table}`
            WHERE
                EXTRACT(MONTH FROM CAST(`Transaction Date` AS DATE)) IN ({month_list_sql})
                AND EXTRACT(YEAR FROM CAST(`Transaction Date` AS DATE))
                    BETWEEN {hist_start_year} AND {hist_end_year}
            GROUP BY item_name, yr
        )
        GROUP BY item_name
    )

    SELECT
        e.item_name,
        CAST(e.predicted_qty   AS INT64)                    AS predicted_qty,
        CAST(e.lower_bound     AS INT64)                    AS lower_bound,
        CAST(e.upper_bound     AS INT64)                    AS upper_bound,
        e.avg_trend,
        e.yearly_seasonality,
        COALESCE(CAST(c.stock  AS INT64), 0)                AS current_stock,
        CAST(COALESCE(h.historical_avg, 0) AS INT64)        AS historical_avg
    FROM Explanations e
    LEFT JOIN CurrentStock      c ON e.item_name = c.item_name
    LEFT JOIN HistoricalContext h ON e.item_name = h.item_name
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
        stock = int(row["current_stock"] or 0)
        trend = row["avg_trend"] or 0
        seasonality = row["yearly_seasonality"] or 0
        upper = int(row["upper_bound"] or 0)
        lower = int(row["lower_bound"] or 0)
        historical_avg = int(row["historical_avg"] or 0)

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

        # Historical context string for reasoning
        hist_note = (
            f" Same-period {lookback_years}yr avg: {historical_avg} units."
            if historical_avg > 0 else ""
        )

        # Logic gate: will we completely run out of stock?
        if shortfall > 0:
            action = "Critical Reorder" if shortfall > (stock * 0.5) else "Reorder Soon"
            reasoning = (
                f"Predicted shortfall of {shortfall} units. "
                f"The model projects {predicted} sales driven by a {trend_direction} long-term trend "
                f"and {seasonality_impact}. Current stock ({stock}) will not cover the selected period."
                f"{hist_note}"
            )

        # Logic gate: Are we within 20 units of running out of stock (the danger zone)?
        elif shortfall > -20:
            action = "Monitor Closely"
            reasoning = (
                f"Stock is cutting it close. You have {stock} units to cover a predicted demand of {predicted}. "
                f"Based on historical data, unexpected {seasonality_impact} variance could cause a stockout."
                f"{hist_note}"
            )

        # Logic gate: Dead Stock Risk
        elif stock > upper:
            action = "Dead Stock Risk"
            excess = stock - upper
            reasoning = (
                f"Overstock Risk: Current stock ({stock}) exceeds the highest projected demand ({upper}). "
                f"Historical baseline trend is {trend_direction}, suggesting ~{excess} units of trapped capital."
                f"{hist_note}"
            )

        # Logic gate: otherwise, we have plenty of stock left
        else:
            action = "Adequate Stock"
            reasoning = (
                f"No immediate action needed. Current stock ({stock}) safely covers the predicted demand ({predicted}). "
                f"Historical baseline trend is {trend_direction}, but you have sufficient buffer."
                f"{hist_note}"
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
            "historical_avg": historical_avg,
            "reasoning": f"{reasoning} Model reliability is {reliability} ({certainty_score}% certainty) based on prediction variance.",
            "trend_direction": trend_direction
        })

    return results

@app.get("/api/analytics/bookstore-insights")
def get_bookstore_insights(
    time_period: str = Query("1_quarter", description="Time horizon for forecast"),
    dev_mode: bool = Query(False, description="Use synthetic dev data and dev model"),
    lookback: str = Query("2_year", description="How many years of same-period history to average (1_year, 2_year, 3_year)"),
):
    try:
        results = fetch_forecast_from_bigquery(time_period, dev_mode, lookback)
        return {"status": "success", "time_period": time_period, "dev_mode": dev_mode, "lookback": lookback, "data": results}
    except Exception as e:
        print(f"[ERROR] Bookstore Insights: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch ML insights from BigQuery.")


@lru_cache(maxsize=5)
def fetch_amazon_bookstore_recommendations():
    """
    Returns top Amazon items grouped by category and flags which ones are
    bookstore-adjacent so the UI can surface purchase signals.
    """
    bq_project = os.getenv("VITE_FIREBASE_PROJECT_ID", "")
    bq_dataset = os.getenv("BIGQUERY_DATASET", "")

    BOOKSTORE_ADJACENT = {
        "book", "books", "office product", "office products",
        "apparel", "clothing", "electronics", "computer",
        "printed publications", "educational", "art", "craft",
    }

    sql = f"""
    WITH AmazonTop AS (
        SELECT
            `Item Description` AS item_name,
            `Category`         AS category,
            SUM(Quantity)      AS amazon_count
        FROM `{bq_project}.{bq_dataset}.amazon_cleaned`
        WHERE `Item Description` IS NOT NULL
          AND `Category`         IS NOT NULL
        GROUP BY item_name, category
        ORDER BY amazon_count DESC
        LIMIT 50
    ),
    BookstoreItems AS (
        SELECT DISTINCT LOWER(`Item Description`) AS item_name_lower
        FROM `{bq_project}.{bq_dataset}.bookstore_cleaned`
        WHERE `Item Description` IS NOT NULL
    )
    SELECT
        a.item_name,
        a.category,
        a.amazon_count,
        b.item_name_lower IS NOT NULL AS in_bookstore
    FROM AmazonTop a
    LEFT JOIN BookstoreItems b ON LOWER(a.item_name) = b.item_name_lower
    ORDER BY a.amazon_count DESC
    """

    bq_client = _bigquery_client()
    rows = list(bq_client.query(sql).result())

    overlap, gaps = [], []
    for row in rows:
        category_lower = (row["category"] or "").lower()
        is_adjacent = any(k in category_lower for k in BOOKSTORE_ADJACENT)
        in_bookstore = bool(row["in_bookstore"])
        count = int(row["amazon_count"] or 0)
        item = {
            "item_name": row["item_name"],
            "category": row["category"],
            "amazon_count": count,
        }
        if in_bookstore:
            item["suggested_reason"] = f"High Amazon demand ({count:,} orders) confirms this is popular. Keep well-stocked."
            overlap.append(item)
        elif is_adjacent:
            item["suggested_reason"] = f"{count:,} Amazon orders in '{row['category']}'. Consider stocking in the bookstore."
            gaps.append(item)

    return {"overlap": overlap[:15], "gaps": gaps[:15]}


@app.get("/api/analytics/amazon-bookstore-recommendations")
def get_amazon_bookstore_recommendations():
    try:
        return fetch_amazon_bookstore_recommendations()
    except Exception as e:
        print(f"[ERROR] Amazon-Bookstore Recommendations: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch Amazon purchase signals.")
    
    
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
