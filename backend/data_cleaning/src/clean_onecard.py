import os
import pandas as pd
import re
import glob
from ..config.onecard_config import (
    MERCHANT_MAP,
    NON_ITEM_DESCRIPTION_PATTERNS,
    NON_ITEM_DESCRIPTIONS,
    STATE_MAP,
    UNNECESSARY_COLUMNS,
)

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
CLEAN_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "clean")

# Regexes used in cleaning Merchant City
PHONE_PATTERN = re.compile(r"\d{3}[\-\s\.]?\d{3}[\-\s\.]?\d{4}")
URL_PATTERN = re.compile(r"(http|www|\.com|\.net|\.org)", re.IGNORECASE)

# For filtering out non-items in the Item Description column
MISSING_ITEM_VALUES = {"", "N/A", "NA", "NAN", "NONE", "NULL", "<NA>"}

def extract_year_from_filename(file_path):
    filename = os.path.basename(file_path)
    match = re.search(r"(19\d{2}|20\d{2})", filename)
    if match:
        return int(match.group(1))
    return None

# ------------------------------- STEP 1: LOAD -------------------------------
# Read the dataset file and load into a Pandas dataframe
def load_onecard():
    clean_file_path = os.path.join(CLEAN_DIR, "onecard_clean.csv")

    if not os.path.exists(RAW_DIR):
        os.makedirs(RAW_DIR, exist_ok=True)
        
    all_files = os.listdir(RAW_DIR)

    file_paths = []

    for file in all_files:
        if "onecard" in file.lower() and file.lower().endswith(".csv") or file.lower().endswith('.xlsx'):
            file_paths.append(os.path.join(RAW_DIR, file))

    file_paths = sorted(file_paths)  # Sort files alphabetically (oldest to newest)

    if not file_paths:
        if os.path.exists(clean_file_path):
            print(f"[INFO] No new Onecard raw files. Loading historical clean data.")
            return pd.read_csv(clean_file_path, low_memory=False)
            
        print(f"[WARNING] No Onecard files found in {RAW_DIR} and no history exists.")
        return pd.DataFrame()

    dfs = []

    for file_path in file_paths:
        df = pd.read_csv(file_path, low_memory=False)

        df = clean_onecard(df)

        year = extract_year_from_filename(file_path)
        if year is not None:
            df["Year"] = year

        dfs.append(df)

    combined_df = pd.concat(dfs, ignore_index=True)

    return save_clean_data(combined_df, clean_file_path)
# ----------------------------------------------------------------------------


# ------------------------------- STEP 2: CLEAN ------------------------------
# Clean the columns, numeric data, and categorical data in any ways appropriate
def clean_onecard(df):
    df = clean_columns(df)
    df = clean_numbers(df)
    df = clean_categories(df)
    df = clean_non_items(df)
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
        "Transaction Amount": "Subtotal",
        "Merchant Category Code Description": "Category",
        "Merchant State/Province": "Merchant State",
        "ITEM_DSC": "Item Description",
        "ITEM_QTY": "Quantity"
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
    price_cols = ["Subtotal", "Sales Tax"]

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

    # For Subtotal (zero values), drop rows where Subtotal = 0
    if "Subtotal" in df.columns:
        df = df[df["Subtotal"] != 0]

    # For Subtotal (negative values), create a new column called
    # 'Transaction Type' that classifies negative values as 'Refund' and
    # positive values as 'Purchase'
    df["Transaction Type"] = df["Subtotal"].apply(
        lambda price: "Refund" if price < 0 else "Purchase"
    )

    # For Quantity, should be numeric and > 0
    if "Quantity" in df.columns:
        df["Quantity"] = pd.to_numeric(df["Quantity"], errors="coerce")
        df = df[df["Quantity"] > 0]

    # Create a new column called Total Price
    df["Total Price"] = df["Subtotal"] + df["Sales Tax"]

    return df


# STEP 2.3 - CLEAN CATEGORIES
# ---------------------------
def clean_categories(df):
    text_cols = ["Category",
                 "Merchant Name",
                 "Merchant City",
                 "Merchant State",
                 "Item Description",
    ]
 
    # For Merchant Name, remove number/letter weirdness to make names consistent
    # Ex: Safeway #0640, Safeway #1929 -> Safeway
    df["Merchant Name"] = (
        df["Merchant Name"]
        .astype(str)
        # Remove anything after *
        .str.replace(r"\*.*", "", regex=True)
        # Remove anything after #
        .str.replace(r"#.*", "", regex=True)
        # Remove phone numbers
        .str.replace(r"\b\d{3}[- ]?\d{3}[- ]?\d{3,4}\b", "", regex=True)
        # Remove dates YYYY-MM-DD
        .str.replace(r"\b\d{4}-\d{2}-\d{2}\b", "", regex=True)
        # Remove long numeric sequences (5+ digits)
        .str.replace(r"\d{5,}", "", regex=True)
        # Remove long trailing alphanumeric tokens (6+ chars)
        .str.replace(r"\b[A-Za-z0-9]{6,}\b$", "", regex=True)
        # Remove digits glued to words at end (Fedex37928331)
        .str.replace(r"(\D)\d+$", r"\1", regex=True)
        # Remove trailing slash
        .str.replace(r"/$", "", regex=True)
        # Collapse whitespace
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
    )
            
    # For Merchant Name, remove inconsistencies in names
    if "Merchant Name" in df.columns:
        df["Merchant Name"] = df["Merchant Name"].apply(normalize_merchant_name)

    # For Merchant State, convert initials to full city names
    if "Merchant State" in df.columns:
        df["Merchant State"] = df["Merchant State"].apply(normalize_state)

    # Clean up and title case category columns
    for col in text_cols:
        if col in df.columns:
            df[col] = (
                normalize_whitespace(df[col])
                .str.title()
            )
    
    # For Merchant Name, combine all "Sp ___" Merchant Names into a single bucket
    df["Merchant Name"] = df["Merchant Name"].str.replace(
        r"^Sp\s.*",
        "Special Purchase",
        regex=True
    )

    # For Merchant City, simple clean using clean_merchant_city helper function
    if "Merchant City" in df.columns:
        df["Merchant City"] = df["Merchant City"].apply(clean_merchant_city)

    return df


# STEP 2.4 - CLEAN NON-ITEMS
# ---------------------------
def clean_non_items(df):
    if "Item Description" not in df.columns:
        return df

    item_description = normalize_whitespace(df["Item Description"])
    item_upper = item_description.str.upper()

    # Filter out missing item descriptions
    has_item_description = item_description.notna() & ~item_upper.isin(MISSING_ITEM_VALUES)
    df = df[has_item_description].copy()

    # Filter out non-item descriptions based on exact matches and regex patterns
    item_description = normalize_whitespace(df["Item Description"])
    non_item_mask = item_description.isin(NON_ITEM_DESCRIPTIONS)

    for pattern in NON_ITEM_DESCRIPTION_PATTERNS:
        non_item_mask |= item_description.str.contains(pattern, case=False, regex=True, na=False)

    return df[~non_item_mask].copy()


# HELPER FUNCTIONS
# -----------------
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
        .astype("string")
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
    # Sort rows by date
    if "Transaction Date" in df.columns:
        df = df.sort_values(by="Transaction Date")

    # Create a new column called Merchant Type, labels a row as "Campus" if
    # the purchase comes from the campus store, else "External"
    df["Merchant Type"] = df["Merchant Name"].apply(
        lambda x: "Campus" if "Ucsc Bay Tree Bkstore" in str(x) else "External"
    )

    return df
# ----------------------------------------------------------------------------


# -------------------------------- STEP 4: SAVE ------------------------------
# Save the cleaned dataset
def save_clean_data(new_df, output_path):
    os.makedirs(CLEAN_DIR, exist_ok=True)
    
    if os.path.exists(output_path):
        existing_df = pd.read_csv(output_path, low_memory=False)
        
        # Append the brand new rows to the historical rows
        combined_df = pd.concat([existing_df, new_df], ignore_index=True)
        
        # Drop exact duplicates so re-running the script doesn't bloat the CSV/Database
        combined_df = combined_df.drop_duplicates(ignore_index=True)
    else:
        # If no history exists, the new data becomes the baseline
        combined_df = new_df

    combined_df.to_csv(output_path, index=False)
    
    # Return the combined master dataframe back up the chain to Firestore
    return combined_df
# ----------------------------------------------------------------------------

# Note: the removed item descriptions are based on high-frequency items from the
# 2025 dataset and may not catch high frequency non-items in future years. This
# data cleaning script may need to be updated in the future if new non-item 
# descriptions are noticed on the website/in the data.