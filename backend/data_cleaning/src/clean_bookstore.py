import os
import re
import glob
import pandas as pd

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
CLEAN_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "clean")

def extract_year_from_filename(file_path):
    filename = os.path.basename(file_path)
    match = re.search(r"(19\d{2}|20\d{2})", filename)
    if match:
        return int(match.group(1))
    return None
# ------------------------------- STEP 1: LOAD -------------------------------
# Read the dataset file and load into a Pandas dataframe
def load_bookstore():
    file_paths = sorted(glob.glob(os.path.join(RAW_DIR, "bookstore_*.csv")))

    if not file_paths:
        print(f"[WARNING] No Bookstore files found in {RAW_DIR}")
        return pd.DataFrame()

    dfs = []

    for file_path in file_paths:
        df = pd.read_csv(file_path, low_memory=False)

        df = clean_bookstore(df)

        year = extract_year_from_filename(file_path)
        if year is not None:
            df["Year"] = year

        dfs.append(df)

    combined_df = pd.concat(dfs, ignore_index=True)

    save_clean_data(combined_df)
    return combined_df

# ----------------------------------------------------------------------------


# ------------------------------- STEP 2: CLEAN ------------------------------
# Clean the columns, numeric data, and categorical data in any ways appropriate
def clean_bookstore(df):
    df = clean_columns(df)
    df = clean_numbers(df)
    df = clean_categories(df)
    df = finalize_dataframe(df)
    return df

# STEP 2.1 - CLEAN COLUMNS
# ------------------------
def clean_columns(df):
    # Drop unnecessary columns
    df.drop(columns=["Account", "UPC Code"], inplace=True, errors="ignore")

    # Normalize missing values
    missing_vals = ["N/A", "n/a", "NULL", "None", "?", "", "<NA>"]
    df.replace(missing_vals, pd.NA, inplace=True)

    # Change column names (for consistency)
    df = df.rename(columns={
        "Product Category": "Category",
        "Item": "Item Description",
        "Date": "Transaction Date"
    })

    # For Transaction Date, change to datetime
    if "Transaction Date" in df.columns:
        df["Transaction Date"] = pd.to_datetime(df["Transaction Date"], errors="coerce")
    
    # Clean column names
    df.columns = (
        df.columns
        .str.strip()
        .str.title()
    )

    return df


# STEP 2.2 - CLEAN NUMERIC DATA
# -----------------------------
def clean_numbers(df):
    # For Quantity, should be numeric and >= 1
    if "Quantity" in df.columns:
        df["Quantity"] = pd.to_numeric(df["Quantity"], errors="coerce")
        df = df[df["Quantity"] > 0]

    return df


# STEP 2.3 - CLEAN CATEGORIES
# ---------------------------
def clean_categories(df):
    text_cols = ["Category",
                 "Item Description"
    ]

    # Clean up and title case category columns
    for col in text_cols:
        if col in df.columns:
            df[col] = (
                normalize_whitespace(df[col])
                .str.title()
        ) 
    
    return df

def normalize_whitespace(series):
    return (
        series
        .astype(str)
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
    )

# ----------------------------------------------------------------------------


# ------------------------------ STEP 3: FINALIZE ----------------------------
# Any final touches to clean the dataframe
def finalize_dataframe(df): 
    # Sort rows by date
    if "Transaction Date" in df.columns:
        df = df.sort_values(by="Transaction Date")

    return df
# ----------------------------------------------------------------------------


# -------------------------------- STEP 4: SAVE ------------------------------
# Save the cleaned dataset
def save_clean_data(df):
    output_path = os.path.join(CLEAN_DIR, "bookstore_clean.csv")
    os.makedirs(CLEAN_DIR, exist_ok=True)
    df.to_csv(output_path, index=False)
# ----------------------------------------------------------------------------