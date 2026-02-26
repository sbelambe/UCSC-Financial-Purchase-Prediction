import os
import pandas as pd

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
CLEAN_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "clean")


def load_bookstore():
    file_path = os.path.join(RAW_DIR, "bookstore.csv")

    if not os.path.exists(file_path):
        print(f"[WARNING] File not found: {file_path}")
        return pd.DataFrame()

    df = pd.read_csv(file_path)
    df = clean_bookstore(df)

    save_clean_data(df)
    return df


def clean_bookstore(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df

    df = clean_columns(df)
    df = clean_numbers(df)
    df = clean_categories(df)
    df = finalize_dataframe(df)
    return df


def clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    missing_vals = ["N/A", "n/a", "NULL", "None", "?", "", "<NA>"]
    df.replace(missing_vals, pd.NA, inplace=True)

    rename_candidates = {
        "Transaction Date": ["Transaction Date", "Date", "Creation Date", "Order Date", "Posting Date"],
        "Merchant Name": ["Merchant Name", "Supplier Name", "Vendor", "Store Name"],
        "Item Description": ["Item Description", "Product Description", "Description", "Item Name", "Product Name"],
        "Category": ["Category", "Category Level 1", "Department"],
        "Subcategory": ["Subcategory", "Category Level 2", "Sub Department", "Class"],
        "Quantity": ["Quantity", "Qty", "Order Quantity"],
        "Subtotal": ["Subtotal", "Extended Price", "Transaction Amount", "Amount", "Net Amount", "Price"],
        "Sales Tax": ["Sales Tax", "Tax", "Order Tax"],
        "Total Price": ["Total Price", "Order Net Total", "Total", "Total Amount"],
    }

    selected_renames = {}
    existing_cols = set(df.columns)
    for canonical, candidates in rename_candidates.items():
        for candidate in candidates:
            if candidate in existing_cols:
                selected_renames[candidate] = canonical
                break

    if selected_renames:
        df = df.rename(columns=selected_renames)

    if "Merchant Name" not in df.columns:
        df["Merchant Name"] = "Campus Store"

    if "Transaction Date" in df.columns:
        df["Transaction Date"] = pd.to_datetime(df["Transaction Date"], errors="coerce")

    df.columns = df.columns.str.strip().str.title()
    return df


def clean_numbers(df: pd.DataFrame) -> pd.DataFrame:
    number_cols = ["Quantity", "Subtotal", "Sales Tax", "Total Price"]

    for col in number_cols:
        if col in df.columns:
            df[col] = (
                df[col]
                .astype(str)
                .str.replace(r"[\$,]", "", regex=True)
                .str.strip()
            )
            df[col] = pd.to_numeric(df[col], errors="coerce")

    if "Subtotal" in df.columns:
        df = df[df["Subtotal"] != 0]

    if "Quantity" in df.columns:
        df = df[df["Quantity"].fillna(1) > 0]

    if "Total Price" not in df.columns:
        if "Subtotal" in df.columns and "Sales Tax" in df.columns:
            df["Total Price"] = df["Subtotal"].fillna(0) + df["Sales Tax"].fillna(0)
        elif "Subtotal" in df.columns:
            df["Total Price"] = df["Subtotal"]

    return df


def clean_categories(df: pd.DataFrame) -> pd.DataFrame:
    text_cols = [
        "Merchant Name",
        "Item Description",
        "Category",
        "Subcategory",
    ]

    for col in text_cols:
        if col in df.columns:
            df[col] = (
                df[col]
                .astype(str)
                .str.replace(r"\s+", " ", regex=True)
                .str.strip()
                .str.title()
            )

    return df


def finalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if "Transaction Date" in df.columns:
        df = df.sort_values(by="Transaction Date")

    price_cols = ["Subtotal", "Sales Tax", "Total Price"]
    for col in price_cols:
        if col in df.columns:
            df[col] = df[col].apply(lambda x: f"${x:,.2f}" if pd.notna(x) else x)

    return df


def save_clean_data(df: pd.DataFrame) -> None:
    output_path = os.path.join(CLEAN_DIR, "bookstore_clean.csv")
    os.makedirs(CLEAN_DIR, exist_ok=True)
    df.to_csv(output_path, index=False)
