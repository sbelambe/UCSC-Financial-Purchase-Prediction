# SlugSmart

## Project Overview

SlugSmart is a transaction analytics and financial decision support platform for the UCSC Financial Affairs Office. By consolidating purchasing data from Amazon, CruzBuy, OneCard, and Bay Tree Bookstore sales via an automated cleaning + upload pipeline, the platform provides a unified view of campus purchase/sales activity for tangible goods. Through transaction analytics, visualization tools, and AI-powered demand and inventory forecasting, SlugSmart helps identify external and internal purchasing trends and supports more informed bookstore stocking decisions. This contributes toward the financial team's goals of reducing external spending, increasing Bookstore revenue and foot traffic, and supporting sustainability efforts by lessening packaging waste and delivery emissions.

---

## Key Features

### Login

* Secure OAuth login

### Home Dashboard
High-level summary of purchasing and sales activity across all datasets.

* SlugSmart Overview and Key Metrics
* Amazon Demand Insights (with Purchase Plan and Insight Details Panel)
* Top Items Across Datasets
* Top External Vendors
* Transaction Analytics Graphs

  * Top Transaction Patterns
  * High Impact Items
  * Spend Over Time
  * Item Spend Trends

### Dataset Pages
Detailed analysis of individual datasets.

* BigQuery Top Items
* Transaction Analytics Graphs
* Amazon Demand Insights / Bookstore Inventory Insights

### Dataset Explorer
Search, filter, inspect, and export cleaned transaction records.

### Reports
Generate exportable summary reports for meetings, presentations, and periodic analysis.

### Help Page
Instructions for new Slugsmart users.

### About Page
About the project, acknowledgments, and terms of use.

---

## Setup

> **Note:** GitHub Codespaces is not currently supported due to application port configuration requirements. Run the application locally instead.

### 1. Install Prerequisites

```bash
# Node.js
node -v

# npm
npm -v

# Python 3.11+
python3 --version

# Git
git --version
```

### 2. Clone the Repository

```bash
git clone <repo-url>
cd UCSC-Financial-Purchase-Prediction
```

### 3. Add Environment Configuration and Credential Files

Place in the root directory:

```text
.env
serviceAccountKey.json
google-drive-service.json
```

Keep these files secret and uncommitted.

Ensure your files match the format of the example files in:
```text
docs/credential-file-examples/
```

### 4. Frontend Setup (Terminal A)

Install dependencies:

```bash
cd frontend
npm install
```

For macOS users, create a frontend environment file:

```bash
cat > .env <<'EOF'
VITE_FIREBASE_API_KEY=<API KEY>
VITE_FIREBASE_AUTH_DOMAIN=<project_id>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project_id>
FIREBASE_CREDENTIALS_PATH=backend/firebase-key.json
FIREBASE_STORAGE_BUCKET=<project_id>.appspot.com
EOF
```

### 5. Data Cleaning & Firebase Upload (Terminal B)

Navigate to:

```bash
cd backend/jobs
```

Run the cleaning pipeline:

```bash
python run_cleaning.py
```

Upload cleaned data to Firebase:

```bash
python run_firebase_uploads.py
```

### 6. Backend Setup (Terminal C)

Create a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install dependencies:

```bash
cd backend
pip install --upgrade pip
pip install -r requirements.txt
```

For macOS users:

```bash
cat > .env <<'EOF'
FIREBASE_CREDENTIALS_PATH=firebase-key.json
FIREBASE_STORAGE_BUCKET=<project_id>.appspot.com
EOF
```

### 7. Run the Application

Start the backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Start the frontend:

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

### Common Frontend Issues

#### Firebase `auth/invalid-api-key`

**Symptoms**

* Blank screen
* Login page stuck on "Connecting..."
* Firebase authentication errors

**Fix**

* Ensure `.env` is located in the project root
* Restart the frontend development server
* Verify Firebase credentials are correct

---

## Test Backend Endpoints

Verify backend functionality using:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/status
curl -X POST http://127.0.0.1:8000/refresh
```

---

## File Structure

### Where Do I Start?

For developers new to the project, the recommended reading order is:

1. App.tsx
2. Dashboard.tsx
3. main.py
4. bigquery_service.py
5. pipeline.py

For a detailed explanation of nearly every file with color-coded importance, see:
```text
docs/File Structure.pdf
```

---

## Architecture

```text
Raw CSV Files
        ↓
Cleaning Scripts
        ↓
Clean CSV Files
        ↓
Firebase Upload Pipeline
        ↓
Firestore / Storage
        ↓
Backend API
        ↓
React Dashboard
```

---

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Recharts
* Radix UI

### Backend

* Python
* FastAPI
* Uvicorn
* Firebase
* BigQuery ML

### Data Cleaning

* Python
* pandas
* openpyxl

---

## Testing

See the Component Testing Guide for detailed testing procedures. 

---

## Documentation

See `docs/` file for all of the current documentation files

Includes:
* Data Cleaning 
* Frontend Architecture Guide
* ML Architecture Guide
* File Structure
* Component Testing Guide

---

## User Guide

1. Visit the SlugSmart web application.
2. Log in using your `@ucsc.edu` account.
3. View and read the "Help" page.
4. Explore dashboards, datasets, reports, and forecasting insights.

---

## Known Issues

* Refresh functionality is currently not working.
* Chatbot is in a limited functional state
* Inventory forecasting certainty is often low (likely due to limited historical training data.)
  * There is a large spread between the low and high purchase counts in the amazon/bookstore demand insights
* Some text overflow on certain screen sizes in UI
* CSS inconsistencies in some of the tables
* Loading for the `RefreshModal.tsx` is noticably slow
* `Favicon.ico` is missing from the backend as a route (shows as a 404 Not Found error) but is visible on the frontend
* Concerning the Refresh Data button: 
  * There is an issue where trying to start the ETL pipeline via the "Start Refresh" button will keep infinitely loading and potentially soft-locking the user due to the pipeline taking too long to execute and finish
  * The default behavior of Vercel caps the max duration of API routes to 10-15s on the Free tier and about a minute on the Paid tier
  * May need to consider porting the ETL pipeline over to more suited platform like Google Cloud
  * Current bandaid fix is to set the duration for 60s
  * This error doesn't seem to occur on a local environment.
---

## Future Enhancements

### Data Cleaning

* Shared configuration system for all dataset cleaners (`clean_amazon.py`, `clean_onecard.py`, `clean_cruzbuy.py`, `clean_bookstore.py`)
* Further modularization of cleaning logic 
* More advanced cleaning rules
* Excluded-row audit reporting

### Analytics & Visualization

* Top subcategory analysis
* Improved grouped-category filtering
* Enhanced search accuracy for item trends
* Pivot-table style dataset exploration

### User Interface

* Improved UI consistency
* UI Style Guide
* Enhanced loading experiences
* Improved UI for information descriotions

### Machine Learning

* Improved forecasting models
* Multi-year training datasets
* Feedback-driven model refinement
* Token usage analysis
* Improve Chatbot functionality
* Integrate automated tests into ML pipeline

### Testing

* Automated testing framework via playwright, pytest, etc.

### Performance

* Faster querying of large datasets in areas like Dataset Explorer and Reports
* Improved Dashboard modularization
* Direct web uploads instead of Google Drive uploads
* Better edge case testing for upload process
* Expanded report export formats (.xlsx, etc.)
* Switching to a relational database (if possible)

---

## Contributors

Developed by the UCSC SlugSmart Capstone Team for CSE 115B/115C.

Additional contributors include:

* Project Sponsors: Douglas Lang, Nicholas Jellison, Gregg Edgar
* CSE 115B/115C Team: Richard Jullig, Mathis Aubert, Diego Ortiz Barbosa
