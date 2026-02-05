from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from data_cleaning.main import run_pipeline

app = FastAPI(title="UCSC Financial Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/status")
def status():
    return {
        "job_running": False,
        "last_updated": None,
        "last_result": None,
        "message": "Backend is up",
    }

@app.post("/refresh")
def refresh():
    try:
        result = run_pipeline()
        return {
            "status": "ok",
            "result": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Refresh failed: {e}")
