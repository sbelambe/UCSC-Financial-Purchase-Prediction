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
|       ├── clean/         # Stores clean csv files
        ├── raw/           # Stores raw csv files (pre cleaning)
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

### 2. Add Required Credential Files

Place the following files in the **repository root directory**:

```
firebase-key.json
google-key.json
```

These files are required for backend authentication and are **not committed to GitHub**.

Your root directory should look like:

```
UCSC-Financial-Purchase-Prediction/
├── backend/
├── frontend/
├── firebase-key.json
├── google-key.json
└── README.md
```

---

### 3) Frontend Setup (Terminal A)

```bash
cat > .env <<'EOF'
VITE_FIREBASE_API_KEY=AIzaSyCHLJgMezo3p741p26VP8nphKZPERKuYdY
VITE_FIREBASE_AUTH_DOMAIN=slugsmart-d7363.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=slugsmart-d7363
FIREBASE_CREDENTIALS_PATH=backend/firebase-key.json
FIREBASE_STORAGE_BUCKET=slugsmart-d7363.appspot.com
EOF
```

Install dependencies:

```bash
cd frontend
npm install
```

---

### 4. Backend Setup (Terminal B)

Create and activate the Python virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install backend dependencies:

```bash
cd backend
pip install --upgrade pip
pip install -r requirements.txt
```

Create backend environment file:

```bash
cat > .env <<'EOF'
FIREBASE_CREDENTIALS_PATH=firebase-key.json
FIREBASE_STORAGE_BUCKET=slugsmart-d7363.appspot.com
EOF
```

---

### 5. Deploying onto local host

Start the backend API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Start the frontend development server:

```bash
npm run dev -- --host 0.0.0.0 --port 5173
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

