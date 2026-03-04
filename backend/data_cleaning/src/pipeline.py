import os
from typing import Dict, Any

from backend.data_cleaning.src.clean_amazon import load_amazon
from backend.data_cleaning.src.clean_cruzbuy import load_cruzbuy
from backend.data_cleaning.src.clean_onecard import load_onecard


def _clean_csv_paths() -> Dict[str, str]:
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "clean"))
    return {
        "amazon": os.path.join(base, "amazon_clean.xlsx"),
        "cruzbuy": os.path.join(base, "cruzbuy_clean.xlsx"),
        "pcard": os.path.join(base, "onecard_clean.xlsx"),
        "bookstore": os.path.join(base, "bookstore_clean.csv"),
    }


def run_data_cleaning() -> Dict[str, Any]:
    """
    Runs cleaning for all datasets and returns cleaned DataFrames + local CSV paths.
    """
    amazon_df = load_amazon()
    cruzbuy_df = load_cruzbuy()
    pcard_df = load_onecard()
    bookstore_df = load_bookstore()

    return {
        "dataframes": {
            "amazon": amazon_df,
            "cruzbuy": cruzbuy_df,
            "pcard": onecard_df,
            "bookstore": bookstore_df,
        },
        "local_paths": _clean_csv_paths(),
    }
