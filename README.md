# UCSC Financial Purchase Prediction Dashboard

This repository contains a full-stack data dashboard for analyzing UCSC purchasing data across multiple sources, including Amazon, CruzBuy, and OneCard.

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
├── backend
│   ├── app                    # FastAPI backend (serves data to frontend)
│   │   ├── main.py            # API endpoints
│   │   ├── analytics.py       # Dashboard summaries from Firestore
│   │   ├── analytics_bookstore.py
│   │   ├── drive.py           # Pulls Google Drive source files
│   │   └── firebase.py        # Firebase setup
│   │
│   ├── data_cleaning          # Raw → cleaned data pipeline
│   │   ├── config             # Cleaning configs (column maps, etc.)
│   │   │   ├── amazon_config.py
│   │   │   ├── cruzbuy_config.py
│   │   │   └── onecard_config.py
│   │   │
│   │   ├── data
│   │   │   ├── raw            # Original datasets (CSV)
│   │   │   ├── clean          # Cleaned datasets (CSV)
│   │   │   └── drive_metadata.json
│   │   │
│   │   └── src                # Cleaning logic
│   │       ├── pipeline.py
│   │       ├── clean_amazon.py
│   │       ├── clean_cruzbuy.py
│   │       ├── clean_onecard.py
│   │       └── clean_bookstore.py
│   │
│   ├── firebase               # Clean data → Firebase
│   │   ├── pipeline.py        # Orchestrates upload + summaries
│   │   ├── storage.py         # Uploads CSVs to Firebase Storage
│   │   ├── firestore.py       # Writes structured records into Firestore
│   │   ├── summaries.py       # Computes aggregations (top items, trends)
│   │   ├── generate_test_csvs.py
│   │   └── test_firestore.py  # Local Firestore tester
│   │
│   ├── jobs                   # Pipeline runners
│   │   ├── run_cleaning.py             # Raw data → Clean data
│   │   ├── run_firebase_uploads.py     # Clean data → Firestore
│   │   └── run_full_pipeline.py        # Both cleaning + Firestore uploads
│   │
│   └── requirements.txt       # Python dependencies
│
├── frontend
│   ├── src
│   │   ├── components         # UI + dashboard components
│   │   │   ├── ui             # Generic reusable UI elements
│   │   │   ├── figma          # Design assets
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ChartGrid.tsx
│   │   │   ├── MetricsGrid.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   ├── FilterPanel.tsx
│   │   │   ├── TabNavigation.tsx
│   │   │   ├── TopItemsChart.tsx
│   │   │   ├── TopItemsTable.tsx
│   │   │   ├── TransactionsOverTimeChart.tsx
│   │   │   ├── VendorAnalysis.tsx
│   │   │   ├── ProductAnalysis.tsx
│   │   │   ├── ProjectionUploader.tsx
│   │   │   ├── SalesOverview.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── Chatbot.tsx
│   │   │
│   │   ├── context            # Global state (e.g., auth)
│   │   │   └── AuthContext.tsx
│   │   │
│   │   ├── App.tsx            # App layout + routing
│   │   └── main.tsx           # Entry point
│   │
│   └── package.json
│
├── .env                      # Root environment variables (shared)
├── .gitignore
└── README.md
└── README.md
```
Almost every file has documentation comments as well. Please refer to those if you are having trouble understanding a file.

---

## Setup 
### 1. Install Prerequisites

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



### 2. Clone the Repository

```bash
git clone <repo-url>
cd UCSC-Financial-Purchase-Prediction
```

---

### 3. Add Required Credential Files and Other Uncommitted Files

Place the following files in the **repository root directory**:

```
serviceAccountKey.json
google-drive-service.json
.env
```

Ensure your .env file has the following format:
```
FIREBASE_CREDENTIALS_PATH=serviceAccountKey.json
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
BIGQUERY_PROJECT_ID=your-project-id
MOCK_FIRESTORE=True
GOOGLE_DRIVE_CREDENTIALS=google-drive-service.json
GOOGLE_DRIVE_FOLDER_ID=your-google-drive-folder-id
```

These files are required for backend authentication and are **not committed to GitHub**. They should not be shared publically.


If ```dashboard.tsx``` is highlighted red, you will also need:

```
frontend/src/data/preview_spend_over_time_all_periods.json
frontend/src/data/preview_spend_over_time_data.json
frontend/src/data/preview_top_20_data.json

```

These can be generated by running ```python test_firestore.py``` in ```backend/firestore```. If that does not work, you may need to add the files manually. Consult your teammates for the files.

---

### 4. Frontend Setup (Terminal A)

If you are on a Mac (not required for Windows), run:

```bash
cat > .env <<'EOF'
VITE_FIREBASE_API_KEY=<API KEY>
VITE_FIREBASE_AUTH_DOMAIN=<projext_id>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project_id>
FIREBASE_CREDENTIALS_PATH=backend/firebase-key.json
FIREBASE_STORAGE_BUCKET=<project_id>.appspot.com
EOF
```

Install dependencies:

```bash
cd frontend
npm install
```

---

### 4.1 Data Cleaning/Firebase Upload(Terminal B)
Navigate to the data cleaning repo and run command for data cleaning pipeline
```bash
cd backend/jobs
```
To data clean run:
```bash
python run_cleaning.py
```
To upload to Firebase Storage and Firestore (including summaries), run:
```bash
python run_firebase_uploads.py
```

### 4.2 Backend Setup (Terminal C)

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

If you are on a Mac (not required for Windows), run this to create backend environment file:

```bash
cat > .env <<'EOF'
FIREBASE_CREDENTIALS_PATH=firebase-key.json
FIREBASE_STORAGE_BUCKET=<project_id>.appspot.com
EOF
```

---

### 5. Deploying onto local host

In one terminal, start the backend API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In another terminal, start the frontend development server:

```bash
npm run dev
```

### Common Frontend Issues & Fixes

### 1. Firebase `auth/invalid-api-key` Error

**Symptoms:**

* White screen, OR
* Login screen shows but stuck on **“Connecting…”**, OR
* Error:

  ```
  Uncaught FirebaseError: Firebase: Error (auth/invalid-api-key)
  ```

**Cause:**
Vite is not properly reading the Firebase API key.

**Fix:**

* Make sure your `.env` file is in the **root directory** (not inside `frontend/` or `backend/`)
* Restart the frontend dev server after updating `.env`

---

### 2. Firebase `auth/unauthorized-domain` Error

**Symptoms:**

* White screen
* Error:

  ```
  FirebaseError: auth/unauthorized-domain
  ```

**Cause:**
Your app is running on a domain that Firebase does not recognize (e.g., GitHub Codespaces, custom dev URLs).

**Fix:**

1. Go to **Firebase Console**
2. Navigate to:

   ```
   Authentication → Settings → Authorized domains
   ```
3. Click **“Add domain”**
4. Paste your app’s URL (e.g., Codespaces or local dev URL)

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
[ Google Drive (Raw Excel Files) ]
                │
                ▼
      backend/app/drive.py
  (Detect changes, download, convert → CSV)
                │
                ▼
   backend/data_cleaning/src/
   (Clean + normalize datasets)
                │
                ▼
   Cleaned DataFrames + CSVs
                │
                ▼
   backend/firebase/pipeline.py
   (Orchestrates upload + processing)
                │
        ┌───────┴────────┐
        ▼                ▼
 Firebase Storage    Firestore
 (optional CSVs)     (structured data + summaries)
                          │
                          ▼
            backend/app/analytics.py
        (Fetch dashboard-ready summaries)
                          │
                          ▼
        FastAPI Endpoints (main.py)
                          │
                          ▼
        frontend/src/components/
            Dashboard.tsx
      (Fetch + render visualizations)
```
