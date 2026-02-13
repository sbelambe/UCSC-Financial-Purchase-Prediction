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

# Used in normalize_merchant to remove name inconsistencies
# Only included vendors with decent to high frequencies 
MERCHANT_MAP = {
    # Ace Hardware
    "ACE HARDWARE": "Ace Hardware",
    "ACE HARDWARE CORPORATION": "Ace Hardware",
    
    # Adobe
    "ADOBE": "Adobe",
    "ADOBE INC.": "Adobe",

    # Amazon
    "AMAZON": "Amazon",
    "AMZN": "Amazon",
    "AMAZON MKTPL": "Amazon",
    "AMAZON MARKETPLACE": "Amazon",
    "AMZNMKTPLACE": "Amazon",
    "AMAZON RETA": "Amazon",
    "AMAZON MARK": "Amazon",
    "AMAZON PRIME": "Amazon",
    "AMAZON.COM": "Amazon",
    "AMAZON MKTPLACE PMTS": "Amazon",
    "AMAZON PRIME PMTS": "Amazon",
    "AMAZON WEB SERVICES": "Amazon",
    "AMZ": "Amazon",
    "AMZN MKTP US": "Amazon",
    "AMAZON WEB": "Amazon",

    # Apple
    "APPLE STORE": "Apple",
    "APPLE": "Apple",
    "APPLE.COM/US": "Apple",
    "APPLE.COM/BILL": "Apple",

    # AT&T
    "AT&T": "AT&T",
    "AT&T BILL": "AT&T",
    "ATT": "AT&T",
    "AT&T BILL PAYMENT": "AT&T",
    "AT&T PAYMENT": "AT&T",

    # Best Buy
    "BESTBUYCOM": "Best Buy",
    "BEST BUY": "Best Buy",

    # Big Creek Lumber
    "BIG CREEK LUMBER": "Big Creek Lumber",
    "BIG CREEK LUMBER-SANTA C": "Big Creek Lumber",
    "BIG CREEK LUMBER-WATSONV": "Big Creek Lumber",
    "BIG CREEK LUMBER COMPANY": "Big Creek Lumber",

    # Boardwalk
    "BOARDWALK GROUP SALES": "Boardwalk",
    "BOARDWALK ONLINE SALES": "Boardwalk",

    # Bookshop Santa Cruz
    "BOOKSHOP SANTA CRUZ": "Bookshop Santa Cruz",
    "BOOKSHOPSANTACRUZ.COM": "Bookshop Santa Cruz",

    # City of Santa Cruz
    "CITY OF SANTA CRUZ": "CITY OF SANTA CRUZ",
    "CITY OF SANTA CRUZ PARKS": "CITY OF SANTA CRUZ",
    "CITY OF SANTA CRUZ FIN": "CITY OF SANTA CRUZ",
    "CITY OF SANTA CRUZ RES": "CITY OF SANTA CRUZ",

    # Costco
    "COSTCO WHSE": "Costco",
    "COSTCO ONLINE RX": "Costco",
    "COSTCO GAS": "Costco",
    "COSTCO DELIVERY": "Costco",
    "COSTCO BY INSTACART": "Costco",
    "WWW COSTCO COM": "Costco",

    # Crystal Springs
    "CRYSTAL SPRINGS": "Crystal Springs",
    "CRYSTAL SPRINGS WATER": "Crystal Springs",

    # Dollar Tree
    "DOLLAR TREE": "Dollar Tree",
    "DOLLAR TREE, INC.": "Dollar Tree",

    # Etsy
    "ETSY": "Etsy",
    "ETSY, INC.": "Etsy",
    "ETSY.COM": "Etsy",

    # Fedex
    "FEDEX": "Fedex",
    "FEDEX FREIGHT INC": "Fedex",
    "FEDEX OFFICE": "Fedex",
    "FEDEX OFFIC": "Fedex",

    # Ferguson
    "FERGUSON ENT": "Ferguson",
    "FERGUSON FAC&SPLY": "Ferguson",

    # Google
    "GOOGLE": "Google",
    "GOOGLE ADS": "Google",
    "GOOGLE CLOUD": "Google",
    "GOOGLE GSUITE": "Google",
    "GOOGLE ONE": "Google",
    "GOOGLE PLAY": "Google",

    # Home Depot
    "HOMEDEPOT.COM": "Home Depot",
    "THE HOME DEPOT": "Home Depot",

    # LinkedIn
    "LINKEDIN": "Linkedin",
    "LINKEDIN ADS": "Linkedin",
    "LINKEDINPRE": "Linkedin",
    "LINKEDINPRED": "Linkedin",
    "LINKEDIN P": "Linkedin",

    # Michaels
    "MICHAELS": "Michaels",
    "MICHAELS STORES": "Michaels",
    "MICHAELS.COM": "Michaels",

    # Newegg
    "NEWEGG": "Newegg",
    "NEWEGG INC.": "Newegg",

    # Office Depot
    "OFFICE DEPOT": "Office Depot",
    "OFFICEMAX/DEPOT": "Office Depot",

    # PG&E
    "PG&E": "PG&E",
    "PG&E/EZ-PAY": "PG&E",
    "PG&E/EZ-PAY FEE": "PG&E",
    "PG&E WEBRECURRING": "PG&E",

    # Safeway
    "SAFEWAY": "Safeway",
    "SAFEWAY.COM": "Safeway",

    # San Lorenzo
    "SAN LORENZO 63 S CRUZ": "San Lorenzo",
    "SAN LORENZO 56 GARDEN": "San Lorenzo",
    "SAN LORENZO 55 SOQUEL": "San Lorenzo",

    # Staples
    "STAPLES": "Staples",
    "STAPLES INC": "Staples",
    "STAPLS": "Staples",

    # Target
    "TARGET": "Target",
    "TARGET PLUS": "Target",
    "TARGET.COM": "Target"
}