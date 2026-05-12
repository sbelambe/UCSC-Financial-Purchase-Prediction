import io
import pandas as pd
from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from firebase_client.summaries import compute_top_items_detailed

router = APIRouter(tags=["upload"])

# Accepts and uploads CSVs for data projection
@router.post("/api/analytics/project")
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