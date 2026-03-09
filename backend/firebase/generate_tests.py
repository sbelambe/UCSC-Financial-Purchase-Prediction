import pandas as pd
import random
import json
from datetime import datetime, timedelta
from collections import defaultdict

# --- Expanded & Categorized Seed Data ---
# --- Generic Corporate Seed Data ---
CATEGORIES = {
    "IT Hardware & Software": {
        "items": [
            "Wireless Mouse", "USB-C Hub", "27-inch Monitor",
            "Laptop Stand", "Mechanical Keyboard", "Cloud Server Hosting - Monthly",
            "CRM Enterprise License", "Noise Cancelling Headphones", "Server Rack Mount",
            "Fiber Optic Cable (50ft)", "Cybersecurity Audit Service"
        ],
        "price_range": (15.0, 4500.0),
        "vendors": ["Tech Data", "CDW", "Amazon Business", "Dell EMC", "Microsoft"]
    },
    "Office & Furniture": {
        "items": [
            "Printer Paper (10 Reams)", "Ergonomic Mesh Chair", "Standing Desk",
            "Ballpoint Pens (50ct)", "Dry Erase Markers", "Sticky Notes Bulk",
            "Filing Cabinet", "Stapler", "Paper Shredder", "Manila Folders (100ct)"
        ],
        "price_range": (5.0, 800.0),
        "vendors": ["Staples", "Office Depot", "Uline", "Amazon Business"]
    },
    "Facilities & Maintenance": {
        "items": [
            "LED Light Bulbs (12pk)", "Industrial Floor Cleaner", "Trash Receptacle",
            "HVAC Filters", "Tool Kit (130 Piece)", "Extension Cord (100ft)",
            "Safety Cones", "Hand Sanitizer Station", "Plumbing Repair Kit"
        ],
        "price_range": (12.0, 400.0),
        "vendors": ["Grainger", "Home Depot Pro", "Fastenal", "McMaster-Carr"]
    },
    "Travel & Expenses": {
        "items": [
            "Ride Share - Airport", "Hotel Accommodation (2 Nights)", "Client Dinner",
            "Flight - Economy Class", "Rental Car - Midsize", "Conference Pass",
            "Baggage Fee", "In-Flight Wi-Fi"
        ],
        "price_range": (8.0, 1200.0),
        "vendors": ["Uber", "Marriott", "Delta Airlines", "Hertz", "Local Restaurant"]
    },
    "Marketing & Events": {
        "items": [
            "Trade Show Banner", "Promotional Tote Bags (500ct)", "Social Media Ad Spend",
            "Catering - Sandwich Platter", "Event Space Rental", "Business Cards (1000ct)"
        ],
        "price_range": (45.0, 5000.0),
        "vendors": ["Vistaprint", "Facebook Ads", "Panera Bread", "Local Venue"]
    },
    "Company Store": { 
        "items": [
            "Corporate Logo Hoodie", "Branded YETI Tumbler", "Employee Anniversary Plaque",
            "Company Polo Shirt", "Branded Lanyard", "Welcome Kit Bundle"
        ],
        "price_range": (10.0, 150.0),
        "vendors": ["CustomInk", "SwagUp", "Internal POS"]
    },
    "Edge Cases": {
        "items": ["Freight Charge", "Late Fee", "Miscellaneous", "Tax Adjustment", ""],
        "price_range": (1.0, 85.0),
        "vendors": ["FedEx", "UPS", "USPS", "Unknown"]
    }
}

def random_date(days_back=800):
    """
    Generates a random date within a specified window.
    Expanded to 800 days to ensure data populates 2024, 2025, and 2026 for dashboard year filters.
    """
    start = datetime.now() - timedelta(days=days_back)
    random_days = random.randrange(days_back)
    return (start + timedelta(days=random_days)).strftime("%Y-%m-%d")

def generate_messy_price(base_price):
    """Adds realistic CSV messiness: leading/trailing spaces and varying formats."""
    formats = [
        lambda p: f"${p:,.2f}",       # $1,234.56
        lambda p: float(p),           # 1234.56
        lambda p: f" {p:,.2f} ",      #  1234.56  (with spaces)
        lambda p: f"{p:,.2f} USD"     # 1234.56 USD
    ]
    return random.choice(formats)(base_price)

def generate_rows(num_rows=10000, specific_category=None):
    """
    Generates a list of dictionaries simulating raw procurement rows.
    Supports targeting a specific category.
    Uses a Zipf-like probability distribution to create massive variance in item frequencies
    (e.g., standard copy paper is bought 100x more often than a 6ft ladder).
    """
    rows = []
    cat_names = list(CATEGORIES.keys())
    # Category weights
    weights = [0.20, 0.25, 0.15, 0.15, 0.10, 0.10, 0.05]
    
    for _ in range(num_rows):
        if specific_category and specific_category in CATEGORIES:
            category = CATEGORIES[specific_category]
        else:
            cat_name = random.choices(cat_names, weights=weights, k=1)[0]
            category = CATEGORIES[cat_name]
        
        # Create a sharp drop-off in probability for items (1st item = highest freq, last item = lowest freq)
        item_weights = [1.0 / (i + 1) for i in range(len(category["items"]))]
        item = random.choices(category["items"], weights=item_weights, k=1)[0]
        
        # Create a similar variance for vendors
        vendor_weights = [1.0 / (i + 1) for i in range(len(category["vendors"]))]
        vendor = random.choices(category["vendors"], weights=vendor_weights, k=1)[0]
        
        low, high = category["price_range"]
        price = round(random.uniform(low, high), 2)
        
        # Add massive quantity spikes to lower-priced items to further skew frequency counts
        if price < 50:
            qty = random.randint(1, 150) # Bulk buying cheap things
        else:
            qty = random.randint(1, 5)   # Buying expensive things normally
        
        # Add extra character "messiness" to item names occasionally
        if random.random() < 0.1 and item: 
            item = item.upper() if random.random() > 0.5 else f"  {item}  "

        total_price = price * qty

        rows.append({
            "item": item,
            "vendor": vendor,
            "qty": qty,
            "price": generate_messy_price(total_price),
            "clean_price": total_price, # Hidden field specifically for precise JSON generation
            "date": random_date()
        })
    return rows

def create_amazon_csv():
    """Generates a messy Amazon Business export and returns the raw data."""
    data = generate_rows(5000)
    df = pd.DataFrame({
        "Order Date": [r["date"] for r in data],
        "Title": [r["item"] for r in data],
        "Seller": [r["vendor"] for r in data],
        "Quantity": [r["qty"] for r in data],
        "Item Total": [r["price"] for r in data],
    })
    df.to_csv("test_amazon.csv", index=False)
    print("[OK] Generated test_amazon.csv with 5,000 rows")
    return data

def create_cruzbuy_csv():
    """Generates a standard CruzBuy e-procurement export and returns the raw data."""
    data = generate_rows(8000)
    df = pd.DataFrame({
        "PO Date": [r["date"] for r in data],
        "Product Description": [r["item"] for r in data],
        "Supplier Name": [r["vendor"] for r in data],
        "Qty": [r["qty"] for r in data],
        "Extended Price": [r["price"] for r in data],
    })
    df.to_csv("test_cruzbuy.csv", index=False)
    print("[OK] Generated test_cruzbuy.csv with 8,000 rows")
    return data

def create_onecard_csv():
    """Generates a generic OneCard corporate banking export and returns the raw data."""
    data = generate_rows(3000)

    df = pd.DataFrame({
        "Transaction Date": [r["date"] for r in data],
        "Transaction Description": [r["item"] for r in data],
        "Merchant": [r["vendor"] for r in data],
        "Amount": [r["price"] for r in data],
    })
    df.to_csv("test_onecard.csv", index=False)
    print("[OK] Generated test_onecard.csv with 3,000 rows")
    return data

def create_bookstore_csv():
    """Generates POS data (swag/merch), intentionally simulating missing prices, returning raw data."""
    # Changed specific_category to target the new generic corporate swag list
    data = generate_rows(2000, specific_category="Company Store")
    
    csv_data = []
    for row in data:
        row_copy = row.copy()
        # Introduce the "Missing Price" error for Pandas to handle in the CSV
        if random.random() < 0.2: 
            row_copy["price"] = ""
        csv_data.append(row_copy)

    df = pd.DataFrame({
        "Date": [r["date"] for r in csv_data],
        "SKU Desc": [r["item"] for r in csv_data],
        "Register Vendor": [r["vendor"] for r in csv_data],
        "Units": [r["qty"] for r in csv_data],
        "Line Total": [r["price"] for r in csv_data],
    })
    df.to_csv("test_bookstore.csv", index=False)
    print("[OK] Generated test_bookstore.csv with 2,000 rows")
    return data

def generate_demo_json(datasets):
    """
    Aggregates the raw generated data and converts it into the structured JSON formats
    expected by the React frontend (preview_top_20_data.json and preview_spend_over_time_data.json).
    This allows for full UI demoing without needing a live database connection.
    """
    top_items_json = {}
    spend_over_time_json = {}

    for dataset_key, data in datasets.items():
        item_map = {}
        monthly_spend = defaultdict(float)

        for row in data:
            # Clean up the name string for the top-items grouping
            item_name = row["item"].strip().upper() 
            if not item_name:
                item_name = "MISCELLANEOUS"
                
            clean_price = row["clean_price"]
            qty = row["qty"]
            vendor = row["vendor"]
            month = row["date"][:7] # Extract YYYY-MM

            # 1. Build Top Items Aggregation
            if item_name not in item_map:
                item_map[item_name] = {
                    "clean_item_name": item_name, 
                    "count": 0, 
                    "total_spent": 0.0, 
                    "vendors": {}
                }
            
            item_map[item_name]["count"] += qty
            item_map[item_name]["total_spent"] += clean_price
            
            # Vendor Breakdown
            if vendor not in item_map[item_name]["vendors"]:
                item_map[item_name]["vendors"][vendor] = {"name": vendor, "count": 0, "spend": 0.0}
            item_map[item_name]["vendors"][vendor]["count"] += qty
            item_map[item_name]["vendors"][vendor]["spend"] += clean_price

            # 2. Build Spend Over Time Aggregation
            monthly_spend[month] += clean_price

        # Format Top Items for React
        formatted_top_items = []
        for item in item_map.values():
            item["vendors"] = list(item["vendors"].values())
            # Round the float to keep the JSON clean
            item["total_spent"] = round(item["total_spent"], 2) 
            formatted_top_items.append(item)
        
        # Sort by most frequent and grab the top 100 to give the frontend filters room to work
        formatted_top_items.sort(key=lambda x: x["count"], reverse=True)
        top_items_json[dataset_key] = formatted_top_items[:100]

        # Format Spend Over Time for React
        formatted_spend = []
        for month_key, spend in sorted(monthly_spend.items()):
            formatted_spend.append({
                "period": month_key, 
                "spend": round(spend, 2), 
                "pending_spend": 0
            })
        
        spend_over_time_json[dataset_key] = {"month": formatted_spend}

    # Output the JSON files
    with open("preview_top_20_data.json", "w") as f:
        json.dump(top_items_json, f, indent=2)
    print("[OK] Generated preview_top_20_data.json (Aggregated Top Items)")

    with open("preview_spend_over_time_data.json", "w") as f:
        json.dump(spend_over_time_json, f, indent=2)
    print("[OK] Generated preview_spend_over_time_data.json (Aggregated Monthly Spend)")

if __name__ == "__main__":
    print("🚀 Generating high-variance campus procurement data...")
    
    amazon_data = create_amazon_csv()
    cruzbuy_data = create_cruzbuy_csv()
    onecard_data = create_onecard_csv()
    bookstore_data = create_bookstore_csv()
    
    print("\n📦 Aggregating raw data into frontend-ready JSON for Preview Mode...")
    datasets = {
        "amazon": amazon_data,
        "cruzbuy": cruzbuy_data,
        "onecard": onecard_data,
        "bookstore": bookstore_data
    }
    
    generate_demo_json(datasets)
    
    print("\n✨ Done! Your sandbox and JSON demo files are ready.")