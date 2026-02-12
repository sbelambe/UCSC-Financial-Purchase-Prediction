import os
import pandas as pd

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "raw")
CLEAN_DIR = os.path.join(os.path.dirname(__file__), "..", "clean")

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

    # TODO: actual cleaning
    df_clean = df.copy()

    return df_clean
