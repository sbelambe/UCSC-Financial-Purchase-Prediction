# Holds lists and dictionaries used in clean_amazon.py

# Used in clean_columns() to drop unnecessary columns
UNNECESSARY_COLUMNS = [
    # Order/payment metadata
    "Order ID",
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
    "Brand",
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

    # China
    # Anhui
    "安徽": "Anhui",
    "安徽省": "Anhui",
    "ANHUI": "Anhui",
    "AN HUI SHENG": "Anhui",
    # Beijing
    "北京": "Beijing",
    "北京市": "Beijing",
    "BEIJING": "Beijing",
    # Chongqing
    "重庆": "Chongqing",
    "重庆市": "Chongqing",
    "CHONGQING": "Chongqing",
    # Fujian
    "福建": "Fujian",
    "福建省": "Fujian",
    "FUJIANSHENG": "Fujian",
    "FUJIAN PROVINCE": "Fujian",
    "FUJIAN": "Fujian",
    # Guangdong
    "广东": "Guangdong",
    "广东省": "Guangdong",
    "中国广东": "Guangdong",
    "GUANGDONG": "Guangdong",
    "GUANGDONGSHENG": "Guangdong",
    "GUANGDONG PROVINCE": "Guangdong",
    "GUANG DONG": "Guangdong",
    "GUANG DONG SHENG": "Guangdong",
    "GUANG DONG SHEN": "Guangdong",
    # Guangxi
    "广西": "Guangxi",
    "广西壮族自治区": "Guangxi",
    "GUANGXI": "Guangxi",
    # Hainan
    "海南": "Hainan",
    "海南省": "Hainan",
    "HAINAN": "Hainan",
    # Hebei
    "河北": "Hebei",
    "河北省": "Hebei",
    "HEBEI": "Hebei",
    "HE BEI": "Hebei",
    # Henan
    "河南": "Henan",
    "河南省": "Henan",
    "HENAN": "Henan",
    "HENAN PROVINCE": "Henan",
    "HENANSHENG": "Henan",
    "HENANSHENGG": "Henan",
    # Heilongjiang
    "黑龙江": "Heilongjiang",
    "HEI LONG JIANG": "Heilongjiang",
    "HEI LONG JIANG PROVINCE": "Heilongjiang",
    # Hong Kong
    "HK": "Hong Kong", 
    "香港": "Hong Kong",
    "HONGKONG": "Hong Kong", 
    "HONG KONG SAR": "Hong Kong", 
    "NT": "New Territories", 
    "新界": "New Territories", 
    "KL": "Kuala Lumpur",
    "九龍": "Kowloon",
    # Hubei 
    "湖北": "Hubei",
    "湖北省": "Hubei",
    "HUBEI": "Hubei",
    "HUBEI PROVINCE": "Hubei",
    # Hunan
    "湖南": "Hunan",
    "湖南省": "Hunan",
    "HUNAN": "Hunan",
    "HUNANSHENG": "Hunan",
    # Jiangsu
    "江苏": "Jiangsu",
    "江苏省": "Jiangsu",
    "JIANGSU": "Jiangsu",
    "JIANGSUSHENG": "Jiangsu",
    # Jiangxi
    "江西": "Jiangxi",
    "江西省": "Jiangxi",
    "JIANG XI SHENG": "Jiangxi",
    "JIANGXI": "Jiangxi",
    # Liaoning
    "辽宁": "Liaoning",
    "辽宁省": "Liaoning",
    "LIAONING": "Liaoning",
    "LIAONINGSHNEG": "Liaoning",
    # Shaanxi
    "陕西": "Shaanxi",
    "陕西省": "Shaanxi",
    "SHAANXI": "Shaanxi",
    # Shandong
    "山东": "Shandong",
    "山东省": "Shandong",
    "SHANDONG": "Shandong",
    "SHANDONGSHENG": "Shandong",
    # Shanxi
    "山西": "Shanxi",
    "山西省": "Shanxi",
    "SHANXI": "Shanxi",
    "SHANXISHENG": "Shanxi",
    # Shanghai
    "上海": "Shanghai",
    "上海市": "Shanghai",
    "SHANGHAI": "Shanghai",
    # Sichuan
    "四川": "Sichuan",
    "四川省": "Sichuan",
    "SICHUAN": "Sichuan",
    # Tianjin
    "天津": "Tianjin",
    "天津市": "Tianjin",
    "TIANJIN": "Tianjin",
    "TIAN JIN": "Tianjin",
    # Zhejiang
    "浙江": "Zhejiang",
    "浙江省": "Zhejiang",
    "ZHEJIANG": "Zhejiang",
    "ZHEJIANG PROVINCE": "Zhejiang",
    "ZHE JIANG SHENG": "Zhejiang",
    # Major Cities
    "深圳": "Shenzhen",
    "深圳市": "Shenzhen",
    "广州市": "Guangzhou",
    "番禺区": "Guangzhou",
    "广州市番禺区": "Guangzhou",
    "Panyu": "Guangzhou",
    "广东省深圳市": "Shenzhen",
    "杭州": "Hangzhou",

    # Other
    "ENG": "England",
    "PR": "Puerto Rico",
    "神奈川県": "Kanagawa",
    "Youngdeungpo Gu": "Yeongdeungpo Gu",
    "Yeongdeungpo-Gu": "Yeongdeungpo Gu",
    "TINH QUANG BINH": "Quang Binh",
    "THANH PHO HA NOI": "Ha Noi",
    "TP HO CHI MINH": "Ho Chi Minh",
    "HO CHI MINH CITY": "Ho Chi Minh"
}

# Ty Google data cleaning suggestions for spotting most of these inconsistencies