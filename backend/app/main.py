import sys, os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# --- Path Configuration ---
# Add the parent directory (backend/) to sys.path so we can import 'data_cleaning'
# This allows the app to find the sibling folder structure.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_cleaning.src.main import run_pipeline

app = FastAPI(title="UCSC Financial Dashboard API")

# --- CORS Middleware ---
# Allows the frontend (running on port 5173) to communicate with this backend (port 8000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
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
    
    1. Calls run_pipeline() from the data_cleaning module.
    2. Returns the summary of processed rows.
    3. Handles any errors that occur during the pipeline execution.
    """
    try:
        result = run_pipeline()
        return {"status": "ok", "result": result}
    except Exception as e:
        # If the pipeline crashes, tell the frontend why
        raise HTTPException(status_code=500, detail=str(e))
    
# Entry point for running via 'py app/main.py' directly
if __name__ == "__main__":
    import uvicorn
    # reload=True allows auto-restart on code changes
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

