import os
import pandas as pd

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")
CLEAN_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "clean")

def clean_cruzbuy():
    file_path = os.path.join(RAW_DIR, "cruzbuy.csv")

    if not os.path.exists(file_path):
        print(f"[WARNING] File not found: {file_path}")
        return pd.DataFrame()  # return empty df
    
    df = pd.read_csv(file_path)
    df_clean = df.copy()
    
    # Drop unnecessary columns
    df_clean.drop(columns=['PO #', 'Supplier Number', 'PO Line #', 'SKU/Catalog #', 'Mfr Catalog #', 'Amount/UOM & UOM'], inplace=True)
    
    # Condense category levels and name into a single cleaned category column
    df_clean['Category Cleaned'] = df_clean.apply(create_category_cleaned, axis=1)
    
    # Drop Category columns
    df_clean.drop(columns=['Category Level 1', 'Category Level 2', 'Category Level 3', 'Category Level 4', 'Category Level 5', 'Category Name'], inplace=True)
    
    output_path = os.path.join(CLEAN_DIR, "cruzbuy_clean.csv")
    df_clean.to_csv(output_path, index=False)
    return df_clean

# Concatenates all levels into single column while removing NAN values and duplicates
def create_category_cleaned(row):
    categories = [
        row['Category Level 1'],
        row['Category Level 2'],
        row['Category Level 3'],
        row['Category Level 4'],
        row['Category Level 5'],
        row['Category Name']
    ]

    cleaned_parts = []
    prev_norm = None

    for cat in categories:
        if pd.isna(cat):
            continue

        cat_str = str(cat).strip()
        norm = cat_str.lower()

        if norm != prev_norm:
            cleaned_parts.append(cat_str)
            prev_norm = norm

    return " > ".join(cleaned_parts) if cleaned_parts else None
