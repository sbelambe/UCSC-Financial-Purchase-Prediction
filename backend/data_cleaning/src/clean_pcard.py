import os
import pandas as pd

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
CLEAN_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "clean")

# Used in clean_columns() to drop unnecessary columns
UNNECESSARY_COLUMNS = [
    "Posting Date",
    "Cycle Close Date",
    "Source Currency Amount",
    "Source Currency",
    "Merchant Category Code",
    "DISCOUNT_AMT",
    "ITEM_COMDT_CDE",
    "UNIT_MEAS_TYP_DSC",
    "UNIT_PRICE_AMT"
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

def load_pcard():
    # Load the data into the Pandas dataframe
    file_path = os.path.join(RAW_DIR, "procard.csv")

    if not os.path.exists(file_path):
        print(f"[WARNING] File not found: {file_path}")
        return pd.DataFrame()  # return empty df

    df = pd.read_csv(file_path)

    df = clean_pcard(df)

    output_path = os.path.join(CLEAN_DIR, "procard_clean.csv")
    os.makedirs(CLEAN_DIR, exist_ok=True)
    df.to_csv(output_path, index=False)

    return df


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

    # Change Transaction Date to datetime
    df["Transaction Date"] = pd.to_datetime(df["Transaction Date"], errors="coerce")

        # Clean column names
    df.columns = (
        df.columns
        .str.strip()
        .str.title()
    )

    return df


def clean_prices(df):
    price_cols = ["Unit Price", "Sales Tax"]
    qty_col = "Quantity"

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

    # Quantity should be numeric and >= 1
    if qty_col in df.columns:
        df[qty_col] = pd.to_numeric(df[qty_col], errors="coerce")
        df.loc[df[qty_col] < 1, qty_col] = pd.NA

    return df


def clean_categories(df):
    text_cols = ["Category",
                 "Merchant Name",
                 "Merchant City",
                 "Merchant State",
                 "Item Name",
    ]

    # For Merchant State, convert initials to full city names
    if "Merchant State" in df.columns:
        df["Merchant State"] = df["Merchant State"].apply(normalize_state)

    # Clean up and title case category columns
    for col in text_cols:
        if col in df.columns:
            df[col] = (
                df[col]
                .astype(str)
                .str.strip()
                .str.title()
            )

    return df

def normalize_state(value):        
    if pd.isna(value):
        return pd.NA

    value = str(value).strip().upper()

    # Convert initials to full name if known
    return STATE_MAP.get(value, value.title())


def clean_pcard(df):
    df = clean_columns(df)
    df = clean_prices(df)
    df = clean_categories(df)
    # Sort values by transaction date
    # df = df.sort_values(by="Transaction Date")
    return df
