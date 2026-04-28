"""
Generates fake multi-year bookstore and Amazon CSVs by applying 10-30% random
noise to the real cleaned data, then uploads each file to Firebase Storage.

Output files (local): backend/data_cleaning/data/fake/
  fake_bookstore_25.csv, fake_bookstore_24.csv, fake_bookstore_23.csv
  fake_amazon_25.csv,    fake_amazon_24.csv,    fake_amazon_23.csv

Firebase Storage paths:
  fake/bookstore/fake_bookstore_25.csv  (and _24, _23)
  fake/amazon/fake_amazon_25.csv        (and _24, _23)

Usage:
  python backend/jobs/generate_mock_data.py
"""

import os
import sys
import numpy as np
import pandas as pd
import firebase_admin
from firebase_admin import credentials, storage
from dotenv import load_dotenv

load_dotenv()

# --- Credentials Setup ---
script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, "..", ".."))

firebase_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
if firebase_path:
    absolute_key_path = os.path.join(root_dir, firebase_path)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = absolute_key_path
    print(f"Loaded credentials from: {absolute_key_path}")
else:
    print("[WARN] FIREBASE_CREDENTIALS_PATH not found in .env — skipping Firebase upload.")

# --- Firebase Init ---
bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
_bucket = None
if firebase_path and bucket_name:
    if not firebase_admin._apps:
        cred = credentials.Certificate(os.environ["GOOGLE_APPLICATION_CREDENTIALS"])
        firebase_admin.initialize_app(cred, {"storageBucket": bucket_name})
    _bucket = storage.bucket(bucket_name)

PRICE_COLS = ["Subtotal", "Sales Tax", "Total Price"]
TARGET_YEARS = [2025, 2024, 2023]
YEAR_SUFFIX  = {2025: "25", 2024: "24", 2023: "23"}


def _parse_price(val) -> float:
    """Strip $ and commas, convert to float. Return 0.0 on failure."""
    try:
        return float(str(val).replace("$", "").replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0


def _shift_year(date_series: pd.Series, target_year: int) -> pd.Series:
    """Replace the year component in a date string column (YYYY-MM-DD)."""
    parsed = pd.to_datetime(date_series, errors="coerce")
    shifted = parsed.apply(
        lambda d: d.replace(year=target_year) if pd.notna(d) else pd.NaT
    )
    return shifted.dt.strftime("%Y-%m-%d")


def _apply_noise(qty_series: pd.Series, rng: np.random.Generator) -> pd.Series:
    """Multiply each quantity by a random factor in [0.70, 1.30], round to int >= 1."""
    factors = rng.uniform(0.70, 1.30, size=len(qty_series))
    noisy = (qty_series.fillna(1).astype(float) * factors).round().astype(int)
    return noisy.clip(lower=1)


def generate_bookstore(source_path: str, out_dir: str, rng: np.random.Generator):
    print(f"\nReading bookstore source: {source_path}")
    df = pd.read_csv(source_path)
    print(f"  {len(df):,} rows loaded. Columns: {list(df.columns)}")

    paths = []
    for year in TARGET_YEARS:
        fake = df.copy()
        fake["Transaction Date"] = _shift_year(fake["Transaction Date"], year)
        fake["Quantity"] = _apply_noise(fake["Quantity"], rng)

        suffix = YEAR_SUFFIX[year]
        out_name = f"fake_bookstore_{suffix}.csv"
        out_path = os.path.join(out_dir, out_name)
        fake.to_csv(out_path, index=False)
        print(f"  Saved {out_path}  ({len(fake):,} rows)")
        paths.append(("bookstore", suffix, out_path, out_name))

    return paths


def generate_amazon(source_path: str, out_dir: str, rng: np.random.Generator):
    print(f"\nReading Amazon source: {source_path}")
    df = pd.read_csv(source_path)
    print(f"  {len(df):,} rows loaded. Columns: {list(df.columns)}")

    paths = []
    for year in TARGET_YEARS:
        fake = df.copy()
        fake["Transaction Date"] = _shift_year(fake["Transaction Date"], year)

        original_qty = fake["Quantity"].fillna(1).astype(float)
        fake["Quantity"] = _apply_noise(fake["Quantity"], rng)

        # Scale monetary columns proportionally with the quantity change
        if original_qty.sum() > 0:
            qty_ratio = fake["Quantity"].astype(float) / original_qty.replace(0, 1)
            for col in PRICE_COLS:
                if col in fake.columns:
                    numeric = fake[col].apply(_parse_price)
                    scaled = (numeric * qty_ratio).round(2)
                    fake[col] = scaled.apply(lambda v: f"${v:,.2f}")

        suffix = YEAR_SUFFIX[year]
        out_name = f"fake_amazon_{suffix}.csv"
        out_path = os.path.join(out_dir, out_name)
        fake.to_csv(out_path, index=False)
        print(f"  Saved {out_path}  ({len(fake):,} rows)")
        paths.append(("amazon", suffix, out_path, out_name))

    return paths


def upload_to_firebase(dataset: str, suffix: str, local_path: str, filename: str):
    if _bucket is None:
        print(f"  [SKIP] Firebase not initialized — skipping upload of {filename}")
        return
    storage_path = f"fake/{dataset}/{filename}"
    blob = _bucket.blob(storage_path)
    blob.upload_from_filename(local_path, content_type="text/csv")
    print(f"  Uploaded → gs://{bucket_name}/{storage_path}")


def main():
    base_dir = os.path.abspath(os.path.join(script_dir, "..", "data_cleaning", "data"))
    clean_dir = os.path.join(base_dir, "clean")
    out_dir   = os.path.join(base_dir, "fake")
    os.makedirs(out_dir, exist_ok=True)

    rng = np.random.default_rng(seed=42)

    bookstore_src = os.path.join(clean_dir, "bookstore_clean.csv")
    amazon_src    = os.path.join(clean_dir, "amazon_clean.csv")

    all_paths = []

    if os.path.exists(bookstore_src):
        all_paths += generate_bookstore(bookstore_src, out_dir, rng)
    else:
        print(f"[SKIP] {bookstore_src} not found.")

    if os.path.exists(amazon_src):
        all_paths += generate_amazon(amazon_src, out_dir, rng)
    else:
        print(f"[SKIP] {amazon_src} not found.")

    print("\n--- Uploading to Firebase Storage ---")
    for dataset, suffix, local_path, filename in all_paths:
        upload_to_firebase(dataset, suffix, local_path, filename)

    print(f"\nDone. Generated {len(all_paths)} files in {out_dir}")
    print("\nNext steps:")
    print("  1. python backend/jobs/run_bigquery_upload.py --dev")
    print("  2. In BigQuery console, run the ARIMA_PLUS SQL pointing to bookstore_cleaned_dev")
    print("     and save the model as bookstore_inventory_forecast_dev")
    print("  3. Toggle 'Dev Mode' in the Inventory Insights UI")


if __name__ == "__main__":
    main()
