# Runs all cleaning scripts and returns structured clean data and where
# it should be stored in the codebase
import os
from typing import Dict, Any

# Import cleaning script files
from .clean_amazon import load_amazon
from .clean_cruzbuy import load_cruzbuy
from .clean_onecard import load_onecard
from .clean_bookstore import load_bookstore


# Save each cleaned dataset under backend/data_cleaning/data/clean
def _clean_csv_paths() -> Dict[str, str]:
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "clean"))
    return {
        "amazon": os.path.join(base, "amazon_clean.csv"),
        "cruzbuy": os.path.join(base, "cruzbuy_clean.csv"),
        "onecard": os.path.join(base, "onecard_clean.csv"),
        "bookstore": os.path.join(base, "bookstore_clean.csv"),
    }


# Run cleaning scripts and return cleaned dataframes and local CSVs
def run_data_cleaning() -> Dict[str, Any]:
    amazon_df = load_amazon()
    cruzbuy_df = load_cruzbuy()
    onecard_df = load_onecard()
    bookstore_df = load_bookstore()

    return {
        "dataframes": {
            "amazon": amazon_df,
            "cruzbuy": cruzbuy_df,
            "onecard": onecard_df,
            "bookstore": bookstore_df,
        },
        "local_paths": _clean_csv_paths(),
    }
