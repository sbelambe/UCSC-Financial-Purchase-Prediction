import os
import pandas as pd

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")

def clean_pcard():
    file_path = os.path.join(RAW_DIR, "procard.csv")

    if not os.path.exists(file_path):
        print(f"[WARNING] File not found: {file_path}")
        return pd.DataFrame()  # return empty df
    
    df = pd.read_csv(file_path)

    # TODO: actual cleaning
    df_clean = df.copy()

    return df_clean
