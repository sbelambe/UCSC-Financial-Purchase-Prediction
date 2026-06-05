import os, asyncio
from fastapi import APIRouter, HTTPException, status
from app.drive import sync_drive_folder, list_available_years
from jobs.run_full_pipeline import run_full_pipeline
from jobs.retrain_models import retrain_arima_model
from app.drive import list_files_recursive
from app.firebase import db
from app.bigquery_service import (
    query_top_items_from_bigquery,
    query_spend_over_time_from_bigquery,
    query_period_summary_from_bigquery,
    query_item_spend_over_time_from_bigquery
)

router = APIRouter(
    prefix="/api/system",
    tags=["system"]
)

# global lock to ensure synchronous task execution
refresh_lock = asyncio.Lock()

@router.get("/health")
# Simple health check endpoint to verify the backend is running.
def health():
    return {"ok": True}

@router.get("/status")
# Simple backend status check.
def status():
    return {
        "job_running": False,
        "last_updated": None,
        "last_result": None,
        "message": "Backend is up",
    }



@router.get("/sync-status")
def get_sync_status():
    """
    Performs a check across the google drive folder, local file server, and firestore server
    to get the sync status of all required datasets
    Also returns a status label for each dataset to indicate its current state in the processing pipeline
    """
    datasets = ["amazon", "cruzbuy", "onecard", "bookstore"]
    status_report = []
    actual_drive_files = []
    actual_db_docs = []

    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(current_dir))
    clean_dir = os.path.join(project_root, "data_cleaning", "data", "clean")

    # get files currently in google drive
    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")

    # get all documents in the uploads collection to cross-reference with the drive files
    try:
        if folder_id:
            # combine path and name for accurate matching
            drive_files = list_files_recursive(folder_id)
            drive_filenames = [f"{f.get('path', '')} {f.get('name', '')}".lower() for f in drive_files]

            # Build the list of actual drive files with their paths for the response, while also populating drive_filenames for matching
            for f in drive_files:
                mime_type = f.get('mimeType', '')
                if mime_type != 'application/vnd.google-apps.folder':
                    name = f.get('name', '')
                    path = f.get('path', '')
                    full_path = f"{path}/{name}".strip("/") if path else name
                    actual_drive_files.append(full_path)

            drive_connected = True
        else:
            print("[WARN] GOOGLE_DRIVE_FOLDER_ID not set. Skipping Drive check.")
            drive_filenames = []
            drive_connected = False
    except Exception as e:
        print(f"[ERROR] Failed to contact Google Drive in status check: {e}")
        drive_filenames = []
        drive_connected = False


    # dynamically fetch all firestore db uploads
    all_upload_docs = {}
    try:
        docs = db.collection("uploads").stream()
        for doc in docs:
            all_upload_docs[doc.id] = doc.to_dict()
            # only show dataset names (e.g. "amazon") instead of full doc ids in the response
            if doc.id in datasets:
                actual_db_docs.append(doc.id)
    except Exception as e:
        print(f"[ERROR] Failed to fetch Firestore docs: {e}")

    # compile status report
    for ds in datasets:
        # only evaluate if successfully connected
        if drive_connected:
            in_drive = any(ds in fname for fname in drive_filenames)
        else:
            in_drive = None

        # check local filesystem to see if its cleaned
        clean_file_path = os.path.join(clean_dir, f"{ds}_clean.csv")
        is_cleaned = os.path.exists(clean_file_path)

        # check against our dict of all upload docs to see if it's been pushed
        is_pushed = ds in all_upload_docs

        # # get all drive files for THIS specific dataset
        # dataset_drive_files = [f for f in actual_drive_files if ds in f.lower()]
        # pushed_files = all_upload_docs.get(ds, {}).get("processed_files", []) if is_pushed else []
        
        # # Check if the Drive file (or its basename) is missing from the DB tracked files
        # pending_files = [f for f in dataset_drive_files if f.split('/')[-1] not in pushed_files and f not in pushed_files]

        if is_pushed:
            state = "Pushed and Synced"
        elif is_cleaned and not is_pushed:
            state = "Cleaned, Pending Push"
        elif in_drive and not is_cleaned:
            state = "In Drive, Needs Cleaning"
        elif not drive_connected:
            state = "Awaiting Processing" 
        else:
            state = "Missing completely"
            
        status_report.append({
            "dataset": ds.capitalize(),
            "in_drive": in_drive,
            "is_cleaned": is_cleaned,
            "is_pushed": is_pushed,
            "status_label": state,
            "pending_files": []
        })

    return {
        "status": "success", 
        "datasets": status_report,
        "raw_drive_files": actual_drive_files,
        "raw_db_docs": actual_db_docs
    }



@router.get("/drive/available-years")
def get_available_years():
    try:
        folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
        if not folder_id:
            raise ValueError("GOOGLE_DRIVE_FOLDER_ID is missing in .env")
        years = list_available_years(folder_id)
        return {"status": "success", "data": {"years": years}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/refresh")
async def refresh_data():
    """
    Triggers the global data refresh pipeline safely.
    
    Checks the global refresh_lock. If the system is currently processing a refresh,
    it returns a 409 Conflict to prevent concurrent executions. If free, it sequentially
    pulls new data from Google Drive and retrains the BigQuery prediction models.
    """
    # check if a task is already running
    if refresh_lock.locked():
        print("[WARNING] Refresh requested but a task is already ongoing!")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A refresh task is already ongoing. Please wait for it to complete before requesting another one."
        )


    # acquire lock and execute tasks
    async with refresh_lock:
        print("[INFO] Refresh lock acquired. Starting background tasks.")
        try:
            folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")

            # If Vercel is detected, route all file writes to the temporary /tmp directory
            is_vercel = os.environ.get("VERCEL") == "1"
            base_write_dir = "/tmp" if is_vercel else os.path.dirname(os.path.dirname(__file__))
            raw_dir = os.path.join(base_write_dir, "data_cleaning", "data", "raw")

            # Ensure the directories actually exist before downloading
            os.makedirs(raw_dir, exist_ok=True)
            sync_result = sync_drive_folder(folder_id, raw_dir)

            # if no files changed, skip ML retraining and exit early
            if not sync_result["changed"]:
                return {"status": "ok", "message": "No changes made to the data. Skipped ML retraining.", "changed_files": []}

            # process new data
            result = run_full_pipeline(base_dir=base_write_dir)

            # trigger ML retraining only because new data was processed successfully
            print("[INFO] New data processed. Executing ML model retraining.")
            retrain_arima_model()

            # Clear BigQuery query caches to ensure insights reflect the newly updated data and models
            query_top_items_from_bigquery.cache_clear()
            query_spend_over_time_from_bigquery.cache_clear()
            query_period_summary_from_bigquery.cache_clear()
            query_item_spend_over_time_from_bigquery.cache_clear()

            return {
                "status": "ok", 
                "message": "New Drive updates detected and prediction models retrained.", 
                "changed_files": sync_result["files"], 
                "result": result
                }
    
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
