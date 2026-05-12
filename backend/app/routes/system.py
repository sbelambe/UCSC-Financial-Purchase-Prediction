import os, asyncio
from fastapi import APIRouter, HTTPException, status
from app.drive import sync_drive_folder, list_available_years
from jobs.run_full_pipeline import run_full_pipeline
from jobs.retrain_models import retrain_arima_model

router = APIRouter(tags=["system"])

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

@router.get("/api/drive/available-years")
def get_available_years():
    try:
        folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
        if not folder_id:
            raise ValueError("GOOGLE_DRIVE_FOLDER_ID is missing in .env")
        years = list_available_years(folder_id)
        return {"status": "success", "data": {"years": years}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/refresh")
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

            return {
                "status": "ok", 
                "message": "New Drive updates detected and prediction models retrained.", 
                "changed_files": sync_result["files"], 
                "result": result
                }
    
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
