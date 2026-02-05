import os
import pandas as pd

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")

def clean_amazon():
    file_path = os.path.join(RAW_DIR, "amazon.csv")

    if not os.path.exists(file_path):
        print(f"[WARNING] File not found: {file_path}")
        return pd.DataFrame()  # return empty df

    df = pd.read_csv(file_path)

    # your cleaning logic...
    df_clean = df.copy()

    return df_clean
