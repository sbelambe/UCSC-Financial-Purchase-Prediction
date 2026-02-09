import os
import pandas as pd

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
CLEAN_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "clean")

# Used in clean_columns() to drop unnecessary columns
UNNECESSARY_COLUMNS = [
    # Order/payment metadata
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

    # Product identifiers/metadata
    "ASIN",
    "UNSPSC",
    "Segment",
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

    # Programs/discounts
    "Pricing Savings program",
    "Pricing Discount Applied",

    # Receiving/logistics
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

# Used in normalize_state() to change state initials to full names
STATE_MAP = {
    # United States
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "IA": "Iowa",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "MA": "Massachusetts",
    "MD": "Maryland",
    "ME": "Maine",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MO": "Missouri",
    "MS": "Mississippi",
    "MT": "Montana",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "NE": "Nebraska",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "N.J.": "New Jersey",
    "NM": "New Mexico",
    "NV": "Nevada",
    "NY": "New York",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VA": "Virginia",
    "VT": "Vermont",
    "WA": "Washington",
    "WI": "Wisconsin",
    "WV": "West Virginia",
    "WY": "Wyoming",

    # Canada
    "ON": "Ontario",
    "QC": "Quebec",
    "BC": "British Columbia",
    "AB": "Alberta",

    # Australia
    "NSW": "New South Wales",
    "VIC": "Victoria",

    # Other
    "ENG": "England",
    "PR": "Puerto Rico",
    "NT": "New Territories", # in Hong Kong
    "HK": "Hong Kong",
    "KL": "Kuala Lumpur"
}


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
        "Order Id": "Transaction Id",
        "Order Quantity": "Quantity",
        "Order Subtotal": "Unit Price",
        "Order Tax": "Sales Tax",
        "Order Net Total": "Total Price",
        "Amazon-Internal Product Category": "Category",
        "Commodity": "Subcategory",
        "Seller Name": "Merchant",
        "Seller City": "Merchant City",
        "Seller State": "Merchant State"
    })

    # Change date to datetime
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
        "Quantity",
        "Unit Price",
        "Sales Tax",
        "Total Price",
    ]

    # Convert to numeric types
    for col in price_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Quantity should be at least 1
    if "Quantity" in df.columns:
        df.loc[df["Quantity"] < 1, "Quantity"] = pd.NA

    # If sales tax is NaN, it usually means 0
    if "Sales Tax" in df.columns:
        df["Sales Tax"] = df["Sales Tax"].fillna(0.0)

    # Drop columns where total price is missing
    if "Total Price" in df.columns:
        df = df.dropna(subset=["Total Price"])

    return df


def clean_categories(df):
    text_cols = ["Category", "Subcategory", "Brand", "Merchant", "Merchant City"]

    # Clean up and title case category columns
    for col in text_cols:
        if col in df.columns:
            df[col] = (
                df[col]
                .astype(str)
                .str.strip()
                .str.title()
            )

    # If Merchant is "Amazon.Com" change to "Amazon.com"
    if "Merchant" in df.columns:
        df["Merchant"] = (
            df["Merchant"]
            .str.strip()
            .str.replace("Amazon.Com", "Amazon.com", regex=False)
        )

    # For Merchant State, convert initials to full city names
    if "Merchant State" in df.columns:
        df["Merchant State"] = df["Merchant State"].apply(normalize_state)

    return df


def normalize_state(value):        
    if pd.isna(value):
        return pd.NA

    value = str(value).strip().upper()

    # Convert initials to full name if known
    return STATE_MAP.get(value, value.title())


def clean_amazon(df):
    df = clean_columns(df)
    df = clean_prices(df)
    df = clean_categories(df)
    # Sort values by transaction date
    df = df.sort_values(by="Transaction Date")
    return df