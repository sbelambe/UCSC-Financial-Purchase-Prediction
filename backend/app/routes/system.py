import os
from fastapi import APIRouter, HTTPException
from app.drive import sync_drive_folder, list_available_years
from jobs.run_full_pipeline import run_full_pipeline

router = APIRouter(tags=["system"])

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

@router.post("/refresh")
# Runs the data cleaning pipeline to sync new files from Google Drive.
def refresh_data():
    try:
        folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
        raw_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "data_cleaning", "data", "raw"
        )
        sync_result = sync_drive_folder(folder_id, raw_dir)

        if not sync_result["changed"]:
            return {"status": "ok", "message": "No changes made to the data.", "changed_files": []}

        result = run_full_pipeline()
        return {"status": "ok", "message": "New Drive updates detected.", "changed_files": sync_result["files"], "result": result}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))