import os
import pandas as pd
from backend.data_cleaning.config.cruzbuy_config import UNNECESSARY_COLUMNS

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
CLEAN_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "clean")

# ------------------------------- STEP 1: LOAD -------------------------------
# Read the dataset file and load into a Pandas dataframe
def load_cruzbuy():
    file_path = os.path.join(RAW_DIR, "cruzbuy.csv")

    if not os.path.exists(file_path):
        print(f"[WARNING] File not found: {file_path}")
        return pd.DataFrame()  # return empty df

    df = pd.read_csv(file_path)
    df = clean_cruzbuy(df)

    save_clean_data(df)
    return df

# ----------------------------------------------------------------------------


# ------------------------------- STEP 2: CLEAN ------------------------------
# Clean the columns, numeric data, and categorical data in any ways appropriate
def clean_cruzbuy(df):
    df = clean_columns(df)
    df = clean_numbers(df)
    df = clean_categories(df)
    df = finalize_dataframe(df)
    return df

# STEP 2.1 - CLEAN COLUMNS
# ------------------------
def clean_columns(df):
    # Drop unnecessary columns
    df.drop(columns=UNNECESSARY_COLUMNS, inplace=True, errors="ignore")

    # Normalize missing values
    missing_vals = ["N/A", "n/a", "NULL", "None", "?", "", "<NA>"]
    df.replace(missing_vals, pd.NA, inplace=True)

    # Drop sparse columns (90% NaN values)
    threshold = 0.9
    sparse_cols = df.columns[df.isna().mean() > threshold]
    df.drop(columns=sparse_cols, inplace=True)

    # Change column names (for consistency)
    df = df.rename(columns={
        "Creation Date": "Transaction Date",
        "Supplier Name": "Merchant Name",
        "Product Description": "Item Description",
        "Category Level 1": "Category",
        "Category Level 2": "Subcategory",
        "Category Name": "Item Name",
        "Extended Price": "Subtotal"
    })

    # For Transaction Date, change to datetime
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
    number_cols = ["Quantity", "Subtotal"]

    # Convert to numeric types
    for col in number_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    
    # For Subtotal (zero values), drop rows where Subtotal = 0
    if "Subtotal" in df.columns:
        df = df[df["Subtotal"] != 0]

    # For Quantity, should be numeric and >= 1
    if "Quantity" in df.columns:
        df = df[df["Quantity"] > 0]

    return df

# STEP 2.3 - CLEAN CATEGORIES
# ---------------------------
def clean_categories(df):
    text_cols = ["Merchant Name",
                 "Item Description",
                 "Category",
                 "Subcategory",
                 "Item Name"]


    # Clean up and title case category columns
    for col in text_cols:
        if col in df.columns:
            df[col] = (
                normalize_whitespace(df[col])
                .str.title()
            )

    # Clean up this common Category inconsistency
    old_name = "Musical Instruments And Games And Toys And Arts And Crafts And Educational Equipment And Materials A"
    new_name = "Musical Instruments And Games And Toys And Arts And Crafts And Educational Equipment And Materials And Accessories And Supplies"

    if "Category" in df.columns:
        df.loc[df["Category"] == old_name, "Category"] = new_name

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
    if "Subtotal" in df.columns:
        # Create "Total Price" by copying "Subtotal"
        df["Total Price"] = df["Subtotal"]

    # Sort rows by date
    df = df.sort_values(by="Transaction Date")

    # Add dollar signs back to price categories
    price_cols = ["Subtotal", "Total Price"]
    df = format_currency(df, price_cols)

    return df

def format_currency(df, cols):
    for col in cols:
        if col in df.columns:
            df[col] = df[col].apply(
                lambda x: f"${x:,.2f}" if pd.notna(x) else x
            )
    return df
# ----------------------------------------------------------------------------


# -------------------------------- STEP 4: SAVE ------------------------------
# Save the cleaned dataset
def save_clean_data(df):
    output_path = os.path.join(CLEAN_DIR, "cruzbuy_clean.csv")
    os.makedirs(CLEAN_DIR, exist_ok=True)
    df.to_csv(output_path, index=False)

# ----------------------------------------------------------------------------