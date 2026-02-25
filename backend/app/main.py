import sys, os, io
import pandas as pd
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from .analytics import get_item_freq, get_spend_over_time
from firebase.summaries import compute_top_items_detailed
# from backend.app.drive import sync_drive_folder
# from backend.jobs.run_full_pipeline import run_full_pipeline
from dotenv import load_dotenv

load_dotenv()

# --- Path Configuration ---
# Add backend/ to sys.path so app, jobs, firebase, and data_cleaning packages can be imported.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from jobs.run_firebase_uploads import run_firebase_uploads

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
def health():
    """
    Simple health check endpoint to verify the server is running.
    """
    return {"ok": True}

@app.get("/status")
def status():
    """
    Returns the current status of the data pipeline job.
    """
    return {
        "job_running": False,
        "last_updated": None,
        "last_result": None,
        "message": "Backend is up",
    }

@app.post("/refresh")
def refresh_data():
    """
    Triggers the data cleaning pipeline.
    
    1. Runs cleaning and Firebase uploads via jobs.
    2. Returns the summary of processed rows.
    3. Handles any errors that occur during the pipeline execution.
    """
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
    

@app.get("/api/analytics/top-items")
def get_top_items(user_id: str):
    try:
        data = get_item_freq(user_id)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/spend-over-time")
def spend_over_time(
    interval: str = "month",
    include_refunds: bool = True,
    amazon_upload_id: Optional[str] = None,
    cruzbuy_upload_id: Optional[str] = None,
    pcard_upload_id: Optional[str] = None,
):
    try:
        upload_ids = None
        if amazon_upload_id or cruzbuy_upload_id or pcard_upload_id:
            upload_ids = {
                "amazon": amazon_upload_id,
                "cruzbuy": cruzbuy_upload_id,
                "pcard": pcard_upload_id,
            }

        data = get_spend_over_time(
            upload_ids=upload_ids,
            interval=interval,
            include_refunds=include_refunds,
        )
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

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
            # Looking for variations of Product Description
            item_col = find_col(["Product Description", "Description", "Item Description"])
            price_col = find_col(["Extended Price", "Total Price", "Amount"])
            vendor_col = find_col(["Supplier Name", "Supplier", "Vendor"])
            date_col = find_col(["PO Date", "Date", "Created Date"])
        elif dataset_lower == "pcard":
            item_col = find_col(["Transaction Description", "Description"])
            price_col = find_col(["Amount", "Transaction Amount"])
            vendor_col = find_col(["Merchant", "Vendor Name"])
            date_col = find_col(["Transaction Date", "Date"])
        else:
            raise ValueError(f"Unknown dataset type: {dataset}")

        # --- LOGGING FOR DEBUGGING ---
        print(f"Detected columns - Item: {item_col}, Price: {price_col}, Date: {date_col}")

        # process Top Items
        projected_items = compute_top_items_detailed(
            df=df, item_col=item_col, price_col=price_col, vendor_col=vendor_col, n=100 
        )
        
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
