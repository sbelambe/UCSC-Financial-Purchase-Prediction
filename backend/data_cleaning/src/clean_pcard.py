import os
import pandas as pd
import re
from config.procard_config import STATE_MAP, UNNECESSARY_COLUMNS, MERCHANT_MAP

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
CLEAN_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "clean")
# Regexes used in cleaninggit Merchant City
PHONE_PATTERN = re.compile(r"\d{3}[\-\s\.]?\d{3}[\-\s\.]?\d{4}")
URL_PATTERN = re.compile(r"(http|www|\.com|\.net|\.org)", re.IGNORECASE)


# ------------------------------- STEP 1: LOAD -------------------------------
# Read the dataset file and load into a Pandas dataframe
def load_pcard():
    file_path = os.path.join(RAW_DIR, "procard.csv")

    if not os.path.exists(file_path):
        print(f"[WARNING] File not found: {file_path}")
        return pd.DataFrame()

    df = pd.read_csv(file_path)
    df = clean_pcard(df)

    save_clean_data(df)
    return df
# ----------------------------------------------------------------------------


# ------------------------------- STEP 2: CLEAN ------------------------------
# Clean the columns, numeric data, and categorical data in any ways appropriate
def clean_pcard(df):
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

    # Change column names (for consistency)
    df = df.rename(columns={
        "Transaction Amount": "Unit Price",
        "Merchant Category Code Description": "Category",
        "Merchant State/Province": "Merchant State",
        "ITEM_DSC": "Item Name",
        "ITEM_QTY": "Quantity"
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
    price_cols = ["Unit Price", "Sales Tax"]

    # Remove currency symbols and commas
    for col in price_cols:
        if col in df.columns:
            df[col] = (
                df[col]
                .astype(str)
                .str.replace(r"[\$,]", "", regex=True)
                .str.strip()
            )
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # For Unit Price (zero values), drop rows where Unit Price = 0
    if "Unit Price" in df.columns:
        df = df[df["Unit Price"] != 0]

    # For Unit Price (negative values), create a new column called
    # 'Transaction Type' that classifies negative values as 'Refund' and
    # positive values as 'Purchase'
    df["Transaction Type"] = df["Unit Price"].apply(
        lambda price: "Refund" if price < 0 else "Purchase"
    )

    # For Quantity, should be numeric and >= 1
    if "Quantity" in df.columns:
        df["Quantity"] = pd.to_numeric(df["Quantity"], errors="coerce")
        df = df[df["Quantity"] > 0]

    return df


# STEP 2.3 - CLEAN CATEGORIES
# ---------------------------
def clean_categories(df):
    text_cols = ["Category",
                 "Merchant Name",
                 "Merchant City",
                 "Merchant State",
                 "Item Name",
    ]
 
    # For Merchant Name, remove number/letter weirdness to make names consistent
    # Ex: Safeway #0640, Safeway #1929 -> Safeway
    if "Merchant Name" in df.columns:
            df["Merchant Name"] = (
        df["Merchant Name"]
        .astype(str)
        # Remove anything after *
        .str.replace(r"\*.*", "", regex=True)
        # Remove trailing long alphanumeric codes (6+ chars)
        .str.replace(r"\s+[A-Za-z0-9]{6,}$", "", regex=True)
        # Remove trailing long digit strings
        .str.replace(r"\s*\d{6,}$", "", regex=True)
        # Separate words stuck to digits (Bestbuycom8070266)
        .str.replace(r"(\D)(\d{6,})$", r"\1", regex=True)
        # Normalize .com
        .str.replace(r"\.com", ".com", regex=True)
        # Remove extra whitespace
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
    )
            
    # For Merchant Name, remove inconsistencies in names
    if "Merchant Name" in df.columns:
        df["Merchant Name"] = df["Merchant Name"].apply(normalize_merchant_name)

    # For Merchant State, convert initials to full city names
    if "Merchant State" in df.columns:
        df["Merchant State"] = df["Merchant State"].apply(normalize_state)

    # Item Name fixes
    if "Item Name" in df.columns:
        # For Item Name (blank), change to 'Unknown Item'
        df["Item Name"] = df["Item Name"].fillna("Unknown Item")

    # Clean up and title case category columns
    for col in text_cols:
        if col in df.columns:
            df[col] = (
                normalize_whitespace(df[col])
                .str.title()
            )

    # For Merchant City, simple clean using clean_merchant_city helper function
    if "Merchant City" in df.columns:
        df["Merchant City"] = df["Merchant City"].apply(clean_merchant_city)

    return df

def normalize_merchant_name(value):
    if pd.isna(value):
        return pd.NA

    value = str(value).strip()
    upper_value = value.upper()

    return MERCHANT_MAP.get(upper_value, value)

def normalize_state(value):        
    if pd.isna(value):
        return pd.NA

    value = str(value).strip().upper()

    # Convert initials to full name if known
    return STATE_MAP.get(value, value.title())

def normalize_whitespace(series):
    return (
        series
        .astype(str)
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
    )

def clean_merchant_city(value):
    if pd.isna(value):
        return pd.NA

    value = str(value).strip()

    # If Merchant City is a phone number, remove
    if PHONE_PATTERN.search(value):
        return pd.NA

    # If Merchant City is a website, lowercase it
    if URL_PATTERN.search(value):
        return value.lower()

    return value
# ----------------------------------------------------------------------------


# ------------------------------ STEP 3: FINALIZE ----------------------------
# Any final touches to clean the dataframe
def finalize_dataframe(df):
    if "Transaction Date" in df.columns:
        df = df.sort_values(by="Transaction Date")

    price_cols = ["Unit Price", "Sales Tax"]
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
    output_path = os.path.join(CLEAN_DIR, "procard_clean.csv")
    os.makedirs(CLEAN_DIR, exist_ok=True)
    df.to_csv(output_path, index=False)
# ----------------------------------------------------------------------------

# Future ideas:
# - Clean item names
# - Possibly create a column called "Merchant Type" that labels "External" for
# external purchases and "Campus" for campus purchases (could be helpful)
# - Create a "Total Price" column that is Unit Price * Quantity + Sales Tax
# - Possible product normalization- find ways to detect products that are the same
# and combine them
# - Turn smaller categories 
# into "Other"
# - "Chili'S -> Chili's"