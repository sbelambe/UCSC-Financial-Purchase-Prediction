# Generates fake CSV files that mimic the real datasets (Amazon, CruzBuy, 
# OneCard) with realistic messiness
import pandas as pd
import random
from datetime import datetime, timedelta

# Defines item names, vendors, price ranges, categories, and edge cases
# (intentional messiness)
CATEGORIES = {
    "Technology": {
        "items": [
            "Dell Precision Workstation", "MacBook Pro 14-inch M3", "iPad Air 64GB",
            "Logitech MX Master 3S Mouse", "USB-C to HDMI Adapter", "Samsung 27\" Monitor",
            "Cisco Network Switch", "External Hard Drive 2TB", "Laptop Battery Replacement"
        ],
        "price_range": (25.0, 3500.0),
        "vendors": ["Dell", "Apple Inc.", "CDW-G", "B&H Photo Video", "Amazon.com"]
    },
    "Lab Supplies": {
        "items": [
            "Centrifuge Tubes 50mL Sterile", "Nitril Gloves Case (Size M)", "Pipette Tips 1000uL",
            "Pyrex Beaker Set", "DNA Polymerase Kit", "Eppendorf Microcentrifuge",
            "Glass Microscope Slides (72ct)", "Laboratory Safety Goggles", "Parafilm M Roll"
        ],
        "price_range": (15.0, 1200.0),
        "vendors": ["Fisher Scientific", "VWR International", "Sigma-Aldrich", "Bio-Rad"]
    },
    "Office/Classroom": {
        "items": [
            "Copy Paper 8.5 x 11 Case", "Sharpie Permanent Markers (12ct)", "Dry Erase Board 4x3ft",
            "Ergonomic Mesh Task Chair", "Stapler Full Strip", "Legal Pad Yellow (12 pack)",
            "Post-it Notes Bulk Pack", "Heavy Duty 3-Ring Binder", "Toner Cartridge Black High Yield"
        ],
        "price_range": (5.0, 450.0),
        "vendors": ["Office Depot", "Staples", "Amazon.com", "Uline"]
    },
    "Facilities/Maintenance": {
        "items": [
            "LED Light Bulb (10 pack)", "HVAC Filter 20x20x1", "Industrial Trash Bags (50gal)",
            "Step Ladder 6ft", "Safety Vest High-Vis", "Locking Door Handle Set",
            "Anti-Bacterial Hand Soap Refill", "Disinfectant Wipes Bulk"
        ],
        "price_range": (10.0, 300.0),
        "vendors": ["Home Depot", "Grainger", "Fastenal", "HD Supply"]
    },
    "Edge Cases": {
        "items": ["freight", "Shipping & Handling", "", "Service Fee", "Miscellaneous Purchase"],
        "price_range": (2.0, 150.0),
        "vendors": ["UPS", "FedEx", "Unknown Vendor"]
    }
}

# Generates a random date within the last about 120 days
def random_date(days_back=120):
    start = datetime.now() - timedelta(days=days_back)
    random_days = random.randrange(days_back)
    return (start + timedelta(days=random_days)).strftime("%Y-%m-%d")


# Adds realistic CSV messiness: leading/trailing spaces and varying formats
def generate_messy_price(base_price):
    formats = [
        lambda p: f"${p:,.2f}",       # $1,234.56
        lambda p: float(p),           # 1234.56
        lambda p: f" {p:,.2f} ",      #  1234.56  (with spaces)
        lambda p: f"{p:,.2f} USD"     # 1234.56 USD
    ]
    return random.choice(formats)(base_price)


# For each row, pick a category, item, vendor, price, and date. Add
# messiness
def generate_rows(num_rows=10000):
    rows = []
    # Convert category names to a list for selection
    cat_names = list(CATEGORIES.keys())
    # Weights make Office and Lab more common than Tech or Edge Cases
    weights = [0.15, 0.35, 0.35, 0.10, 0.05] 
    
    for _ in range(num_rows):
        cat_name = random.choices(cat_names, weights=weights, k=1)[0]
        category = CATEGORIES[cat_name]
        
        item = random.choice(category["items"])
        vendor = random.choice(category["vendors"])
        
        low, high = category["price_range"]
        price = round(random.uniform(low, high), 2)
        
        # Add extra character "messiness" to item names occasionally
        if random.random() < 0.1 and item: 
            item = item.upper() if random.random() > 0.5 else f"  {item}  "

        rows.append({
            "item": item,
            "vendor": vendor,
            "price": generate_messy_price(price),
            "date": random_date()
        })
    return rows

# Create test datasets
def create_amazon_csv():
    data = generate_rows(5000)
    df = pd.DataFrame({
        "Order Date": [r["date"] for r in data],
        "Title": [r["item"] for r in data],
        "Seller": [r["vendor"] for r in data],
        "Item Total": [r["price"] for r in data],
    })
    df.to_csv("test_amazon.csv", index=False)
    print("[OK] Generated test_amazon.csv with 5,000 rows")

def create_cruzbuy_csv():
    data = generate_rows(8000)
    df = pd.DataFrame({
        "PO Date": [r["date"] for r in data],
        "Product Description": [r["item"] for r in data],
        "Supplier Name": [r["vendor"] for r in data],
        "Extended Price": [r["price"] for r in data],
    })
    df.to_csv("test_cruzbuy.csv", index=False)
    print("[OK] Generated test_cruzbuy.csv with 8,000 rows")

def create_onecard_csv():
    data = generate_rows(3000)
    df = pd.DataFrame({
        "Transaction Date": [r["date"] for r in data],
        "Transaction Description": [r["item"] for r in data],
        "Merchant": [r["vendor"] for r in data],
        "Amount": [r["price"] for r in data],
    })
    df.to_csv("test_onecard.csv", index=False)
    print("[OK] Generated test_onecard.csv with 3,000 rows")

# Execute the creation of the test data. Generates 5,000 Amazon rows,
# 8,000 CruzBuy rows, and 3,000 OneCard rows
if __name__ == "__main__":
    print("🚀 Generating high-variance campus procurement data...")
    create_amazon_csv()
    create_cruzbuy_csv()
    create_onecard_csv()
    print("\n✨ Done! Your sandbox is ready for high-volume testing.")