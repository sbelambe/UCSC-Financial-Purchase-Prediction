# Backend entry point and API router; connects frontend actions to backend
# behavior (ex: user clicks "Refresh Data"). Includes creating the FastAPI
# app, frontend/backend port communication through CORS Middleware, health
# and status checks, refresh data, and returning dashboard data
import sys, os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# --- Path Configuration ---
# Add backend/ to sys.path so app, jobs, firebase, and data_cleaning packages can be imported.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# --- Router Imports ---
from .routes.feedback import router as feedback_router
from .routes.insights import router as insights_router
from .routes.system import router as system_router
from .routes.analytics import router as analytics_router
from .routes.explorer import router as explorer_router
from .routes.upload import router as upload_router

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


# --- Attach Routers ---
# FEEDBACK ROUTER
# Captures user corrections for ML model forecasts from the frontend 
# and safely inserts them into the BigQuery prediction_feedback table.
# Key Routes: 
#   - POST /api/analytics/feedback
app.include_router(feedback_router)


# INSIGHTS ROUTER
# Handles heavy-lifting queries that execute BigQuery ML models (ARIMA+) 
# to forecast future demand, evaluate stock health, and return item histories.
# Key Routes: 
#   - GET /api/analytics/bookstore-insights
#   - GET /api/analytics/amazon-insights
#   - GET /api/analytics/item-history
app.include_router(insights_router)


# SYSTEM ROUTER
# Acts as the control panel for the backend server. Handles health checks, 
# Google Drive syncing, and triggering the ML retraining pipeline.
# Key Routes: 
#   - GET  /health, /status
#   - POST /refresh
#   - GET  /api/drive/available-years
app.include_router(system_router)


# ANALYTICS ROUTER
# General-purpose data router for standard SQL aggregations. Populates 
# the main charts, top-item lists, and general spend-over-time metrics.
# Key Routes: 
#   - GET /api/analytics/top-items
#   - GET /api/analytics/spend-over-time
#   - GET /api/analytics/dataset-config
app.include_router(analytics_router)


# DATASET EXPLORER ROUTER
# Encapsulates the Dataset Explorer feature. Handles the searching, 
# sorting, pagination, and file generation for raw BigQuery rows.
# Key Routes: 
#   - GET /api/dataset-explorer
#   - GET /api/dataset-explorer/export (Returns .csv, .xlsx, .json)
app.include_router(explorer_router)


# UPLOAD ROUTER (PROJECTION MODE)
# Isolates heavy file-upload operations from standard API traffic. 
# Parses massive CSVs into memory using Pandas and returns projected data.
# Key Routes: 
#   - POST /api/analytics/project (Accepts multipart/form-data for projection mode)
app.include_router(upload_router)



    
# Entry point for running via 'py app/main.py' directly
if __name__ == "__main__":
    import uvicorn
    # reload=True allows auto-restart on code changes
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)