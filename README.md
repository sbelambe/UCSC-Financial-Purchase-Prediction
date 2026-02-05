# UCSC Financial Purchase Prediction Dashboard

This project is a full-stack data dashboard for analyzing UCSC purchasing data across multiple sources (Amazon, CruzBuy, ProCard).

It consists of:
- **Frontend**: React + Vite + TypeScript (initial UI generated from Figma, then normalized)
- **Backend**: FastAPI (Python)
- **Data Cleaning Pipeline**: Python (pandas-based), triggered by the backend

The frontend **never reads raw spreadsheets directly**. All raw data flows through the backend and a data-cleaning layer before being displayed.

---

## Repository Structure
.
├── frontend/
│ ├── src/
│ ├── package.json
│ └── tsconfig.json
├── backend/
│ ├── app/ # FastAPI application
│ ├── data_cleaning/ # Data cleaning + parsing logic
│ ├── requirements.txt
│ └── .venv/ # Local Python virtual environment (not committed)
└── .vscode/ # Workspace config (points VS Code to backend venv)


---

## Prerequisites (Install Locally)

Every developer working on this repo needs:

- **Node.js** (LTS recommended)
- **Python 3.11+** (Python 3.12 works in Codespaces)
- **Git**

---

## One-Page Setup Summary

### 1) Clone the repo
git clone <repo-url>
cd UCSC-Financial-Purchase-Prediction


---

### 2) Frontend Setup (Terminal A)

cd frontend
npm install
npm run dev


This starts the frontend at the Vite dev URL (shown in the terminal).

---

### 3) Backend Setup (Terminal B)
Create and activate a Python virtual environment, then install dependencies:

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt


---

### 4) Run the Backend API

cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


The API runs at:
http://127.0.0.1:8000


---

### 5) Test Backend Endpoints

From any terminal:

curl http://127.0.0.1:8000/health

curl http://127.0.0.1:8000/status

curl -X POST http://127.0.0.1:8000/refresh


- `/health` → basic liveness check  
- `/status` → backend state info  
- `/refresh` → manually triggers the data-cleaning pipeline  

---

## Data Flow Overview

1. Raw spreadsheets live in a shared Google Drive (not accessed by frontend)
2. Admin triggers `/refresh`
3. Backend runs the data-cleaning pipeline
4. Data is cleaned and normalized using pandas
5. Cleaned data is stored (Supabase later)
6. Frontend fetches **only cleaned data** via API endpoints

---

## Notes for Teammates

- Frontend and backend run in **separate terminals**
- Backend **must** use the virtual environment
- Data cleaning logic currently contains placeholders and will be expanded
- `.vscode/settings.json` ensures VS Code uses the backend venv for Pylance
- TypeScript config and imports have been normalized from Figma-generated code

---

## Current Status

- Frontend builds cleanly with TypeScript
- Backend runs with FastAPI + Uvicorn
- `/refresh` endpoint successfully triggers the pipeline stub
- Ready for Supabase integration and real data ingestion

