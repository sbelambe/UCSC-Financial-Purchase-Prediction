import os
import pandas as pd
from backend.data_cleaning.config.amazon_config import STATE_MAP, UNNECESSARY_COLUMNS

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
CLEAN_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "clean")


def load_amazon():
    # Load the data into the Pandas dataframe
    file_path = os.path.join(RAW_DIR, "amazon.csv")

    if not os.path.exists(file_path):
        print(f"[WARNING] File not found: {file_path}")
        return pd.DataFrame()  # return empty df

    df = pd.read_csv(file_path)

    df = clean_amazon(df)

    output_path = os.path.join(CLEAN_DIR, "amazon_clean.csv")
    os.makedirs(CLEAN_DIR, exist_ok=True)
    df.to_csv(output_path, index=False)

    return df


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
        "Order Date": "Transaction Date",
        "Order Quantity": "Quantity",
        "Order Subtotal": "Subtotal",
        "Order Tax": "Sales Tax",
        "Order Net Total": "Total Price",
        "Amazon-Internal Product Category": "Category",
        "Title": "Item Name",
        "Commodity": "Subcategory",
        "Seller Name": "Merchant Name",
        "Seller City": "Merchant City",
        "Seller State": "Merchant State"
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


def clean_prices(df):
    price_cols = [
        "Subtotal",
        "Sales Tax",
        "Total Price",
    ]

    # Convert to numeric types
    for col in price_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # For Subtotal (zero values), drop rows where Subtotal = 0
    df = df[df["Subtotal"] != 0]

    # For Quantity, should be numeric and >= 1
    if "Quantitiy" in df.columns:
        df["Quantity"] = pd.to_numeric(df["Quantity"], errors="coerce")
        df = df[df["Quantity"] > 0]

    # For Sales Tax, if NaN, it usually means 0
    if "Sales Tax" in df.columns:
        df["Sales Tax"] = df["Sales Tax"].fillna(0.0)

    # For Total Price, drop missing columns
    if "Total Price" in df.columns:
        df = df.dropna(subset=["Total Price"])

    return df


def clean_categories(df):
    text_cols = ["Item Name", 
                 "Category", 
                 "Subcategory", 
                 "Merchant Name", 
                 "Merchant City"
    ]

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

    # For Merchant Name, if "Amazon.Com" change to "Amazon.com"
    if "Merchant Name" in df.columns:
        df["Merchant Name"] = (
            df["Merchant Name"]
            .str.strip()
            .str.replace("Amazon.Com", "Amazon.com", regex=False)
        )

    return df


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


def clean_amazon(df):
    price_cols = ["Subtotal",
                  "Sales Tax",
                  "Total Price"
    ]

    df = clean_columns(df)
    df = clean_prices(df)
    df = clean_categories(df)

    # Sort values by transaction date
    df = df.sort_values(by="Transaction Date")

    # Add dollar signs back to price categories
    df = format_currency(df, price_cols)

    return df

def format_currency(df, cols):
    for col in cols:
        if col in df.columns:
            df[col] = df[col].apply(
                lambda x: f"${x:,.2f}" if pd.notna(x) else x
            )
    return df

# Future Ideas:
# - Possible product normalization- find ways to detect products that are the same
# and combine them
# - Clean item names more thoroughly
# - Any Google Suggestions
# - "Chili'S -> Chili's"
# Category cleans - drop random number categories,
# - Deeper cleaning on every column 