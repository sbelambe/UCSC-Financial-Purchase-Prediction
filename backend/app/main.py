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

from app.drive import sync_drive_folder, list_available_years
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

@app.get("/api/drive/available-years")
def get_available_years():
    try:
        folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")

        if not folder_id:
            raise ValueError("GOOGLE_DRIVE_FOLDER_ID is missing in .env")

        years = list_available_years(folder_id)

        return {
            "status": "success",
            "data": {
                "years": years
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

        sync_result = sync_drive_folder(folder_id, raw_dir)

        if not sync_result["changed"]:
            return {
                "status": "ok",
                "message": "No changes made to the data.",
                "changed_files": []
            }

        result = run_full_pipeline()

        return {
            "status": "ok",
            "message": "Refresh completed.",
            "changed_files": sync_result["files"],
            "result": result
        }

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
    category_filter: str = "",
):
    try:
        category_originals = [c.strip() for c in category_filter.split("|") if c.strip()] if category_filter else []
        data = query_top_items_from_bigquery(
            dataset=dataset,
            search_query=search_query,
            selected_year=selected_year,
            selected_quarter=selected_quarter,
            min_spend=min_spend,
            limit=limit,
            sort_mode=sort_mode,
            category_originals=category_originals,
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
    
# ML / Inventory Insight routes, do not delete

@lru_cache(maxsize=30)
def fetch_forecast_from_bigquery(time_period: str, dev_mode: bool = False, lookback: str = "2_year"):
    """
    Retrieves inventory health insights by comparing current stock against BQML demand forecasts.
    Filters ML.EXPLAIN_FORECAST to forecast rows only (avoids inflating predictions 10-30x).
    """
    import datetime
    bq_project = os.getenv("VITE_FIREBASE_PROJECT_ID", "")
    bq_dataset  = os.getenv("BIGQUERY_DATASET", "")
    model_suffix = "_dev" if dev_mode else ""
    model_path  = f"{bq_project}.{bq_dataset}.bookstore_inventory_forecast{model_suffix}"
    data_table  = f"{bq_project}.{bq_dataset}.bookstore_cleaned{model_suffix}"

    horizon_map = {"1_month": 1, "1_quarter": 3, "6_months": 6, "1_year": 12}
    months_to_forecast = horizon_map.get(time_period, 3)

    lookback_map = {"1_year": 1, "2_year": 2, "3_year": 3}
    lookback_years = lookback_map.get(lookback, 2)

    today = datetime.date.today()
    forecast_months = [((today.month - 1 + i + 1) % 12) + 1 for i in range(months_to_forecast)]
    month_list_sql  = ", ".join(str(m) for m in forecast_months)

    sql = f"""
    WITH Explanations AS (
        SELECT
            item_name,
            SUM(time_series_data)                AS predicted_qty,
            SUM(prediction_interval_lower_bound) AS lower_bound,
            SUM(prediction_interval_upper_bound) AS upper_bound,
            AVG(trend)                           AS avg_trend,
            AVG(seasonal_period_yearly)          AS yearly_seasonality
        FROM ML.EXPLAIN_FORECAST(
            MODEL `{model_path}`,
            STRUCT({months_to_forecast} AS horizon)
        )
        WHERE time_series_type = 'forecast'
        GROUP BY item_name
    ),
    DataBounds AS (
        SELECT MAX(CAST(`Transaction Date` AS DATE)) AS latest_date
        FROM `{data_table}`
    ),
    CurrentStock AS (
        SELECT `Item Description` AS item_name, SUM(Quantity) AS stock
        FROM `{data_table}`, DataBounds
        WHERE CAST(`Transaction Date` AS DATE) >= DATE_SUB(DataBounds.latest_date, INTERVAL 3 MONTH)
        GROUP BY item_name
    ),
    HistoricalContext AS (
        SELECT item_name, AVG(period_qty) AS historical_avg
        FROM (
            SELECT
                `Item Description` AS item_name,
                EXTRACT(YEAR FROM CAST(`Transaction Date` AS DATE)) AS yr,
                SUM(Quantity) AS period_qty
            FROM `{data_table}`, DataBounds
            WHERE
                EXTRACT(MONTH FROM CAST(`Transaction Date` AS DATE)) IN ({month_list_sql})
                AND EXTRACT(YEAR FROM CAST(`Transaction Date` AS DATE))
                    BETWEEN EXTRACT(YEAR FROM DataBounds.latest_date) - {lookback_years}
                        AND EXTRACT(YEAR FROM DataBounds.latest_date) - 1
            GROUP BY item_name, yr
        )
        GROUP BY item_name
    )
    SELECT
        e.item_name,
        CAST(e.predicted_qty AS INT64)                AS predicted_qty,
        CAST(e.lower_bound   AS INT64)                AS lower_bound,
        CAST(e.upper_bound   AS INT64)                AS upper_bound,
        e.avg_trend,
        e.yearly_seasonality,
        COALESCE(CAST(c.stock AS INT64), 0)           AS current_stock,
        CAST(COALESCE(h.historical_avg, 0) AS INT64)  AS historical_avg
    FROM Explanations e
    LEFT JOIN CurrentStock      c ON e.item_name = c.item_name
    LEFT JOIN HistoricalContext h ON e.item_name = h.item_name
    WHERE e.item_name IS NOT NULL AND CAST(e.predicted_qty AS INT64) > 0
    ORDER BY ABS(CAST(c.stock AS INT64) - CAST(e.predicted_qty AS INT64)) DESC
    LIMIT 25
    """

    bq_client = _bigquery_client()
    results   = []
    for row in bq_client.query(sql).result():
        predicted     = int(row["predicted_qty"] or 0)
        stock         = int(row["current_stock"]  or 0)
        trend         = row["avg_trend"] or 0
        seasonality   = row["yearly_seasonality"] or 0
        upper         = int(row["upper_bound"]    or 0)
        lower         = int(row["lower_bound"]    or 0)
        historical_avg= int(row["historical_avg"] or 0)

        if predicted > 0:
            error_margin   = (upper - lower) / (predicted * 2)
            certainty_score = max(5, min(99, int((1 - error_margin) * 100)))
        else:
            certainty_score = 50

        trend_direction = "growing" if trend > 0.05 else "declining" if trend < -0.05 else "stable"
        seasonality_impact = "a stable, non-seasonal baseline" if seasonality == 0 else (
            "historical seasonal spikes" if seasonality > 0 else "standard seasonal baseline"
        )
        hist_note = f" Same-period {lookback_years}yr avg: {historical_avg} units." if historical_avg > 0 else ""
        shortfall  = predicted - stock

        if shortfall > 0:
            action = "Critical Reorder" if shortfall > (stock * 0.5) else "Reorder Soon"
            reasoning = (
                f"Predicted shortfall of {shortfall} units. "
                f"The model projects {predicted} sales driven by a {trend_direction} long-term trend "
                f"and {seasonality_impact}. Current stock ({stock}) will not cover the selected period.{hist_note}"
            )
        elif shortfall > -20:
            action = "Monitor Closely"
            reasoning = (
                f"Stock is cutting it close. You have {stock} units to cover a predicted demand of {predicted}. "
                f"Unexpected {seasonality_impact} variance could cause a stockout.{hist_note}"
            )
        elif stock > upper:
            action    = "Dead Stock Risk"
            reasoning = (
                f"Overstock Risk: Current stock ({stock}) exceeds highest projected demand ({upper}). "
                f"Trend is {trend_direction}, suggesting ~{stock - upper} units of trapped capital.{hist_note}"
            )
        else:
            action    = "Adequate Stock"
            reasoning = (
                f"No immediate action needed. Current stock ({stock}) safely covers predicted demand ({predicted}). "
                f"Historical baseline trend is {trend_direction}.{hist_note}"
            )

        reliability = "High" if certainty_score > 80 else "Moderate" if certainty_score > 50 else "Low"
        results.append({
            "category": row["item_name"], "current_stock": stock, "predicted_demand": predicted,
            "lower_bound": lower, "upper_bound": upper, "certainty_score": certainty_score,
            "action": action, "historical_avg": historical_avg,
            "reasoning": f"{reasoning} Model reliability is {reliability} ({certainty_score}% certainty).",
            "trend_direction": trend_direction,
        })
    return results


@lru_cache(maxsize=50)
def fetch_item_history(item_name: str, dev_mode: bool = False):
    """Returns monthly purchase history for a single bookstore item."""
    bq_project  = os.getenv("VITE_FIREBASE_PROJECT_ID", "")
    bq_dataset  = os.getenv("BIGQUERY_DATASET", "")
    data_table  = f"{bq_project}.{bq_dataset}.bookstore_cleaned{'_dev' if dev_mode else ''}"
    sql = f"""
    SELECT
        FORMAT_DATE('%Y-%m', CAST(`Transaction Date` AS DATE)) AS month,
        SUM(Quantity) AS quantity
    FROM `{data_table}`
    WHERE `Item Description` = @item_name
    GROUP BY month
    ORDER BY month
    """
    bq_client = _bigquery_client()
    job_config = __import__('google.cloud.bigquery', fromlist=['QueryJobConfig', 'ScalarQueryParameter']).QueryJobConfig(
        query_parameters=[
            __import__('google.cloud.bigquery', fromlist=['ScalarQueryParameter']).ScalarQueryParameter("item_name", "STRING", item_name)
        ]
    )
    rows = list(bq_client.query(sql, job_config=job_config).result())
    return {"item_name": item_name, "history": [{"month": r["month"], "quantity": int(r["quantity"])} for r in rows]}


@lru_cache(maxsize=5)
def fetch_amazon_bookstore_recommendations():
    bq_project = os.getenv("VITE_FIREBASE_PROJECT_ID", "")
    bq_dataset  = os.getenv("BIGQUERY_DATASET", "")
    BOOKSTORE_ADJACENT = {"book","books","office product","office products","apparel","clothing",
                          "electronics","computer","printed publications","educational","art","craft"}
    sql = f"""
    WITH AmazonTop AS (
        SELECT `Item Description` AS item_name, `Category` AS category, SUM(Quantity) AS amazon_count
        FROM `{bq_project}.{bq_dataset}.amazon_cleaned`
        WHERE `Item Description` IS NOT NULL AND `Category` IS NOT NULL
        GROUP BY item_name, category
        ORDER BY amazon_count DESC
        LIMIT 50
    ),
    BookstoreItems AS (
        SELECT DISTINCT LOWER(`Item Description`) AS item_name_lower
        FROM `{bq_project}.{bq_dataset}.bookstore_cleaned`
        WHERE `Item Description` IS NOT NULL
    )
    SELECT a.item_name, a.category, a.amazon_count, b.item_name_lower IS NOT NULL AS in_bookstore
    FROM AmazonTop a
    LEFT JOIN BookstoreItems b ON LOWER(a.item_name) = b.item_name_lower
    ORDER BY a.amazon_count DESC
    """
    bq_client = _bigquery_client()
    overlap, gaps = [], []
    for row in bq_client.query(sql).result():
        cat_lower = (row["category"] or "").lower()
        is_adjacent = any(kw in cat_lower for kw in BOOKSTORE_ADJACENT)
        entry = {
            "item_name": row["item_name"], "category": row["category"],
            "amazon_count": int(row["amazon_count"]),
            "suggested_reason": (
                f"High Amazon demand ({int(row['amazon_count'])} orders). Already carried — keep well stocked."
                if row["in_bookstore"]
                else f"High Amazon demand ({int(row['amazon_count'])} orders) in a bookstore-adjacent category. Consider stocking."
            ),
        }
        if row["in_bookstore"]:
            overlap.append(entry)
        elif is_adjacent:
            gaps.append(entry)
    return {"overlap": overlap[:15], "gaps": gaps[:15]}


@lru_cache(maxsize=30)
def fetch_amazon_forecast_from_bigquery(time_period: str, dev_mode: bool = False, lookback: str = "2_year"):
    """
    Retrieves Amazon demand forecasts per item name using BQML ARIMA+.
    current_stock = recent 3-month Amazon order volume; predicted_demand = ML forecast.
    """
    import datetime
    bq_project = os.getenv("VITE_FIREBASE_PROJECT_ID", "")
    bq_dataset  = os.getenv("BIGQUERY_DATASET", "")
    model_suffix = "_dev" if dev_mode else ""
    model_path   = f"{bq_project}.{bq_dataset}.amazon_demand_forecast{model_suffix}"
    amazon_table = f"{bq_project}.{bq_dataset}.amazon_cleaned{model_suffix}"

    horizon_map = {"1_month": 1, "1_quarter": 3, "6_months": 6, "1_year": 12}
    months_to_forecast = horizon_map.get(time_period, 3)
    lookback_map = {"1_year": 1, "2_year": 2, "3_year": 3}
    lookback_years = lookback_map.get(lookback, 2)

    today = datetime.date.today()
    forecast_months = [((today.month - 1 + i + 1) % 12) + 1 for i in range(months_to_forecast)]
    month_list_sql  = ", ".join(str(m) for m in forecast_months)

    sql = f"""
    WITH Explanations AS (
        SELECT
            item_name,
            SUM(time_series_data)                AS predicted_qty,
            SUM(prediction_interval_lower_bound) AS lower_bound,
            SUM(prediction_interval_upper_bound) AS upper_bound,
            AVG(trend)                           AS avg_trend,
            AVG(seasonal_period_yearly)          AS yearly_seasonality
        FROM ML.EXPLAIN_FORECAST(
            MODEL `{model_path}`,
            STRUCT({months_to_forecast} AS horizon)
        )
        WHERE time_series_type = 'forecast'
        GROUP BY item_name
    ),
    RecentOrders AS (
        SELECT `Item Description` AS item_name, SUM(Quantity) AS recent_qty
        FROM `{amazon_table}`
        WHERE CAST(`Transaction Date` AS DATE) >= DATE_SUB(
            (SELECT MAX(CAST(`Transaction Date` AS DATE)) FROM `{amazon_table}`),
            INTERVAL 3 MONTH
        ) AND `Item Description` IS NOT NULL
        GROUP BY `Item Description`
    ),
    HistoricalContext AS (
        SELECT item_name, AVG(period_qty) AS historical_avg
        FROM (
            SELECT
                `Item Description` AS item_name,
                EXTRACT(YEAR FROM CAST(`Transaction Date` AS DATE)) AS yr,
                SUM(Quantity) AS period_qty
            FROM `{amazon_table}`
            WHERE
                EXTRACT(MONTH FROM CAST(`Transaction Date` AS DATE)) IN ({month_list_sql})
                AND EXTRACT(YEAR FROM CAST(`Transaction Date` AS DATE))
                    BETWEEN (SELECT EXTRACT(YEAR FROM MAX(CAST(`Transaction Date` AS DATE))) FROM `{amazon_table}`) - {lookback_years}
                        AND (SELECT EXTRACT(YEAR FROM MAX(CAST(`Transaction Date` AS DATE))) FROM `{amazon_table}`) - 1
                AND `Item Description` IS NOT NULL
            GROUP BY item_name, yr
        )
        GROUP BY item_name
    )
    SELECT
        e.item_name,
        CAST(e.predicted_qty AS INT64)               AS predicted_qty,
        CAST(e.lower_bound   AS INT64)               AS lower_bound,
        CAST(e.upper_bound   AS INT64)               AS upper_bound,
        e.avg_trend,
        e.yearly_seasonality,
        COALESCE(CAST(r.recent_qty AS INT64), 0)     AS recent_orders,
        CAST(COALESCE(h.historical_avg, 0) AS INT64) AS historical_avg
    FROM Explanations e
    LEFT JOIN RecentOrders      r ON e.item_name = r.item_name
    LEFT JOIN HistoricalContext h ON e.item_name = h.item_name
    WHERE e.item_name IS NOT NULL AND CAST(e.predicted_qty AS INT64) > 0
    ORDER BY CAST(e.predicted_qty AS INT64) DESC
    LIMIT 25
    """

    bq_client = _bigquery_client()
    results   = []
    for row in bq_client.query(sql).result():
        predicted      = int(row["predicted_qty"] or 0)
        recent         = int(row["recent_orders"]  or 0)
        trend          = row["avg_trend"] or 0
        seasonality    = row["yearly_seasonality"] or 0
        upper          = int(row["upper_bound"]    or 0)
        lower          = int(row["lower_bound"]    or 0)
        historical_avg = int(row["historical_avg"] or 0)

        if predicted > 0:
            error_margin    = (upper - lower) / (predicted * 2)
            certainty_score = max(5, min(99, int((1 - error_margin) * 100)))
        else:
            certainty_score = 50

        trend_direction    = "growing" if trend > 0.05 else "declining" if trend < -0.05 else "stable"
        seasonality_impact = "a stable, non-seasonal baseline" if seasonality == 0 else (
            "historical seasonal spikes" if seasonality > 0 else "standard seasonal baseline"
        )
        hist_note = f" Same-period {lookback_years}yr avg: {historical_avg} orders." if historical_avg > 0 else ""
        shortfall  = predicted - recent

        if shortfall > 0 and shortfall > (recent * 0.5):
            action    = "Critical Reorder"
            reasoning = (
                f"Amazon demand is surging — forecast of {predicted} orders vs. only {recent} recent. "
                f"Shortfall of {shortfall} driven by a {trend_direction} trend and {seasonality_impact}.{hist_note}"
            )
        elif shortfall > 0:
            action    = "Reorder Soon"
            reasoning = (
                f"Demand is climbing — {predicted} orders forecast vs. {recent} recently. "
                f"A {trend_direction} trend suggests continued growth.{hist_note}"
            )
        elif shortfall > -20:
            action    = "Monitor Closely"
            reasoning = (
                f"Demand is near recent volume ({recent} orders vs. {predicted} forecast). "
                f"Variance from {seasonality_impact} could push this higher.{hist_note}"
            )
        elif recent > upper:
            action    = "Dead Stock Risk"
            reasoning = (
                f"Recent orders ({recent}) exceed the high-end forecast ({upper}), suggesting demand is cooling. "
                f"The {trend_direction} trend supports lower activity ahead.{hist_note}"
            )
        else:
            action    = "Adequate Stock"
            reasoning = (
                f"Demand is stable. Forecast of {predicted} orders aligns with recent volume ({recent}). "
                f"Baseline is {trend_direction} with {seasonality_impact}.{hist_note}"
            )

        reliability = "High" if certainty_score > 80 else "Moderate" if certainty_score > 50 else "Low"
        results.append({
            "category": row["item_name"], "current_stock": recent, "predicted_demand": predicted,
            "lower_bound": lower, "upper_bound": upper, "certainty_score": certainty_score,
            "action": action, "historical_avg": historical_avg,
            "reasoning": f"{reasoning} Model reliability is {reliability} ({certainty_score}% certainty).",
            "trend_direction": trend_direction,
        })
    return results


@app.get("/api/analytics/cache/clear")
def clear_cache():
    fetch_forecast_from_bigquery.cache_clear()
    fetch_amazon_forecast_from_bigquery.cache_clear()
    fetch_item_history.cache_clear()
    fetch_amazon_bookstore_recommendations.cache_clear()
    return {"status": "ok", "message": "All caches cleared."}


@app.get("/api/analytics/bookstore-insights")
def get_bookstore_insights(
    time_period: str = Query("1_quarter"),
    dev_mode:    bool = Query(False),
    lookback:    str  = Query("2_year"),
):
    try:
        results = fetch_forecast_from_bigquery(time_period, dev_mode, lookback)
        return {"status": "success", "time_period": time_period, "dev_mode": dev_mode, "lookback": lookback, "data": results}
    except Exception as e:
        print(f"[ERROR] Bookstore Insights: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch ML insights from BigQuery.")


@app.get("/api/analytics/amazon-insights")
def get_amazon_insights(
    time_period: str = Query("1_quarter"),
    dev_mode:    bool = Query(False),
    lookback:    str  = Query("2_year"),
):
    try:
        results = fetch_amazon_forecast_from_bigquery(time_period, dev_mode, lookback)
        return {"status": "success", "time_period": time_period, "dev_mode": dev_mode, "lookback": lookback, "data": results}
    except Exception as e:
        print(f"[ERROR] Amazon Insights: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch Amazon ML insights from BigQuery.")


@app.get("/api/analytics/amazon-bookstore-recommendations")
def get_amazon_bookstore_recommendations():
    try:
        return fetch_amazon_bookstore_recommendations()
    except Exception as e:
        print(f"[ERROR] Amazon-Bookstore Recommendations: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch recommendations.")


@app.get("/api/analytics/item-history")
def get_item_history(
    item_name: str  = Query(...),
    dev_mode:  bool = Query(False),
):
    try:
        return fetch_item_history(item_name, dev_mode)
    except Exception as e:
        print(f"[ERROR] Item History: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch item history.")


# Entry point for running via 'py app/main.py' directly
if __name__ == "__main__":
    import uvicorn
    # reload=True allows auto-restart on code changes
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
