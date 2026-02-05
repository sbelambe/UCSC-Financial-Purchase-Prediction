# UCSC Financial Purchase Prediction Dashboard

This repository contains a full-stack data dashboard for analyzing UCSC purchasing data across multiple sources, including Amazon, CruzBuy, and ProCard.

The frontend never reads raw spreadsheets directly. All data is processed by the backend and a Python data-cleaning pipeline before being served to the UI.

---

## Tech Stack

Frontend:
- React
- Vite
- TypeScript
- Tailwind CSS
- Radix UI
- Recharts

Backend:
- Python
- FastAPI
- Uvicorn

Data Cleaning:
- Python
- pandas
- openpyxl

---

## Repository Structure

```
.
├── frontend/              # React + Vite frontend app
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── backend/
│   ├── app/               # FastAPI APIs
│   ├── data_cleaning/     # Python cleaning pipeline
│   ├── requirements.txt   # Python dependencies
│   └── .venv/             # Python virtual environment (not committed)
├── .vscode/               # VS Code settings
└── README.md
```

---

## Prerequisites

Install these before proceeding:

```bash
# Node.js
node -v

# npm
npm -v

# Python 3.11 or newer
python3 --version

# Git
git --version
```

---

## One-Page Setup Guide

### 1. Clone the Repository

```bash
git clone <repo-url>
cd UCSC-Financial-Purchase-Prediction
```

---

### 2. Frontend Setup (Terminal A)

```bash
cd frontend
npm install
npm run dev
```

---

### 3. Backend Setup (Terminal B)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

### 4. Run the Backend API

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Test Backend Endpoints

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/status
curl -X POST http://127.0.0.1:8000/refresh
```

---

## Data Flow Overview

```
Raw spreadsheets (Drive)
        ↓
Admin hits POST /refresh
        ↓
Backend runs Python cleaning pipeline
        ↓
Cleaned data processed/stored
        ↓
Frontend fetches cleaned results
```

---

## Notes for Teammates

- Run `npm install` (frontend) and `pip install -r requirements.txt` (backend).
- `node_modules/` and `backend/.venv/` are not committed.
- VS Code is configured to use `backend/.venv` for Python IntelliSense.
- The data-cleaning pipeline currently contains placeholder functions and will be expanded later.
- `/refresh` is a manual trigger for data cleanup.

---

## Common Commands

```bash
cd frontend
npm run dev

cd backend
source .venv/bin/activate
uvicorn app.main:app --reload

cd frontend
npx tsc --noEmit
```

---

## Troubleshooting

- If Python imports (FastAPI/pandas) show errors:
  - Ensure VS Code uses the `backend/.venv/bin/python` interpreter
  - Reload the VS Code window

- If frontend shows type errors:
  - Ensure `@types/react` and `@types/react-dom` are installed
  - Ensure `tsconfig.json` and `vite-env.d.ts` are present

- If backend endpoints don’t respond:
  - Confirm the backend server is running

---

## Current Status

- Frontend runs with no TypeScript errors
- Backend FastAPI endpoints are live
- `/refresh` triggers the cleaning pipeline stub
- Ready for:
  - Google Drive ingestion
  - Supabase integration
  - Authentication + analytics implementation
