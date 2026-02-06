import os
import pandas as pd

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
    df.to_csv(output_path, index=False)

    return df


def clean_columns(df):
    # Drop unnecessary columns
    UNNECESSARY_COLUMNS = [
        # Order / payment metadata
        "Account Group",
        "PO Number",
        "Currency",
        "Order Shipping & Handling",
        "Order Promotion",
        "Order Status",
        "Invoice Status",
        "Payment Reference ID",
        "Payment Date",
        "Payment Amount",
        "Payment Instrument Type",

        # Product identifiers / metadata
        "ASIN",
        "UNSPSC",
        "Family",
        "Class",
        "Brand Code",
        "Manufacturer",
        "National Stock Number",
        "Item model number",
        "Part number",
        "Product Condition",
        "Company Compliance",

        # Pricing details (redundant)
        "Listed PPU",
        "Purchase PPU",
        "Item Quantity",
        "Item Subtotal",
        "Item Shipping & Handling",
        "Item Tax",
        "Item Net Total",
        "PO Line Item Id",

        # Tax fields
        "Tax Exemption Applied",
        "Tax Exemption Type",
        "Tax Exemption Opt Out",

        # Programs / discounts
        "Pricing Savings program",
        "Pricing Discount Applied",

        # Receiving / logistics
        "Receiving Status",
        "Received Date",
        "Receiver Name",
        "Receiver Email",

        # Accounting fields
        "GL Code",
        "Department",
        "Cost Center",
        "Project Code",
        "Location",

        # Misc
        "Custom Field 1",
        "Seller Credentials",
        "Seller ZipCode",
    ]
    df.drop(columns=UNNECESSARY_COLUMNS, inplace=True, errors="ignore")

    # Normalize missing values
    missing_vals = ["N/A", "n/a", "NULL", "None", "?", "", "<NA>"]
    df.replace(missing_vals, pd.NA, inplace=True)

    # Drop sparse columns (80% NaN values)
    threshold = 0.8
    sparse_cols = df.columns[df.isna().mean() > threshold]
    df.drop(columns=sparse_cols, inplace=True)

    # Change column names
    df = df.rename(columns={'Amazon-Internal Product Category': 'Category'})

    # Change date to datetime
    df["Order Date"] = pd.to_datetime(df["Order Date"], errors="coerce")

    # Clean column names
    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(" ", "_")
    )

    return df


def clean_prices(df):
    price_cols = [
        "order_quantity",
        "order_subtotal",
        "order_tax",
        "order_net_total",
    ]

    # Convert to numeric types
    for col in price_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Quantity should be at least 1
    if "order_quantity" in df.columns:
        df.loc[df["order_quantity"] < 1, "order_quantity"] = pd.NA

    # Missing tax usually means no tax
    if "order_tax" in df.columns:
        df["order_tax"] = df["order_tax"].fillna(0.0)

    # Drop rows where net total is missing
    if "order_net_total" in df.columns:
        df = df.dropna(subset=["order_net_total"])

    return df

def clean_categories(df):
    text_cols = ["category", "segment", "commodity", "brand", "seller_city", "seller_state"]

    for col in text_cols:
        if col in df.columns:
            df[col] = (
                df[col]
                .astype(str)
                .str.strip()
                .str.lower()
            )
    return df

def clean_amazon(df):
    df = clean_columns(df)
    df = clean_prices(df)
    df = clean_categories(df)
    return df

# Future ideas:
# - Break dates into month, day, and year
# - Clean item names
# - Change more column names/make each dataset consistent in naming
# - Prevent potential errors with changing column names