# Holds lists and dictionaries used in clean_procard.py

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
    "AB": "Alberta"
}

# used in normalize_merchant to remove name inconsistencies
MERCHANT_MAP = {
    # Amazon
    "AMAZON": "Amazon",
    "AMZN": "Amazon",
    "AMAZON MKTPL": "Amazon",
    "AMAZON MARKETPLACE": "Amazon",
    "AMZNMKTPLACE": "Amazon",
    "AMAZON RETA": "Amazon",

    # 2Co.com
    "2COCOM": "2Co.com",
    "2CO.COM": "2Co.com",

    # Apple
    "APPLE STORE": "Apple",
    "APPLE": "Apple",

    # Best Buy
    "BESTBUYCOM": "Best Buy",
    "BEST BUY": "Best Buy",

    # Chili's
    "CHILI'S SEASIDE": "Chili's",
    "CHILI'S CAPITOLA MALL": "Chili's",
}