# Holds lists and dictionaries used in clean_onecard.py

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

NON_ITEM_DESCRIPTIONS = {
    "Order Summary",
    "Business Services",
    "Claude Pro",
    "Generic Item", # this one is so funny
    "Financial Services",
    "Medical Lab",
    "Payment On Account",
    "Carryover Balance: Accrued",
    "Miscellaneous",
    "Misc/Specialty Retail",
    "Parts",
    "Product",
    "Utility Bill",
    "Invoice",
    "Payment",
    "Payment On Account",
    "Adjustment",
    "Credit",
    "Refund",
    "Discount",
    "Subtotal",
    "Order Total",
    "Sales Tax",
    "Use Tax",
    "Shipping Charge",
    "Delivery Charge",
    "Service Charge",
    "Convenience Fee",
    "Processing Fee",
    "Transaction Fee",
    "Membership",
    "Subscription",
    "Software License"
    "Renewal",
    "Maintenance",
    "Support",
    "Professional Services",
    "Consulting Services",
    "Installation",
    # Lower-frequency known non-item entries
    "2024.2 Essentials Scheduli",
    "Telecom Surcharge",
    "Openart Infinite",
    "Avery Customizable Name Ba",
    "Sweet Business",
    "Sgfsclrheavyweightcoatedsq",
    "Plastiqprincipal",
}

NON_ITEM_DESCRIPTION_PATTERNS = [
    r"\bamusement parks\b",
    r"\bamazon\b",
    r"\bannual plan\b",
    r"\bbuilding project\b",
    r"\bcomcast\b",
    r"\bdna\b",
    r"\bdomain\b",
    r"\begift\b",
    r"\bgift card\b",
    r"\bgoogle\b",
    r"\bfacebook ads\b",
    r"\bfedex",
    r"\bfreight\b",
    r"\bhousehold appliance\b",
    r"\bplan start\b",
    r"\bmonthly\b",
    r"\bnote taking\b",
    r"\bperformance month to month\b",
    r"\bpersonal care\b",
    r"\bsubscription\b",
    r"\bsubscriptio",
    r"\bsuperhuman\b",
    r"\bweb hosting\b",
    r"\bwix",
    r"\bstreaming\b",
    r"\buniverity and colleges\b",
    r"\b(service|administrative|convenience|processing|transaction)\s*(fee|charge|surcharge)\b",
    r"\bshipping(?: and handling)?\b",
    r"\bdelivery fee\b",
    r"\bsales tax\b",
    r"\bgeneric item\b",
    r"\bmiscellaneous\b",
    r"\bmisc\b",
    r"\bretail\b",
    r"\bbusiness services\b",
    r"\bfinancial services\b",
    r"\butility bill\b",
    r"\btelecom\b",
    r"\binternet service\b",
    r"\bmobile service\b",
    r"\bwireless\b",
    r"\badvertising\b",
    r"\bads\b",
    r"\bmeta ads\b",
    r"\blinkedin ads\b",
    r"\bopenai\b",
    r"\bchatgpt\b",
    r"\bclaude\b",
    r"\bnotion\b",
    r"\bcanva\b",
    r"\bzoom\b",
    r"\bslack\b",
    r"\bdropbox\b",
    r"\bgithub\b",
    r"\baws\b",
    r"\bazure\b"
    # Remove purely numeric item descriptions (just digits/spaces/hyphens)
    r"^[\d\s\-]+$",
    # Remove items starting with long numeric merchant codes (10+ consecutive digits)
    r"^\d{10,}",
]