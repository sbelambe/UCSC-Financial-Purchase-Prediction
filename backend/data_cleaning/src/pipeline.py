import os
from typing import Dict, Any

from data_cleaning.src.clean_amazon import load_amazon
from data_cleaning.src.clean_cruzbuy import load_cruzbuy
from data_cleaning.src.clean_pcard import load_pcard


def _clean_csv_paths() -> Dict[str, str]:
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "clean"))
    return {
        "amazon": os.path.join(base, "amazon_clean.csv"),
        "cruzbuy": os.path.join(base, "cruzbuy_clean.csv"),
        "pcard": os.path.join(base, "procard_clean.csv"),
    }


def run_data_cleaning() -> Dict[str, Any]:
    """
    Runs cleaning for all datasets and returns cleaned DataFrames + local CSV paths.
    """
    amazon_df = load_amazon()
    cruzbuy_df = load_cruzbuy()
    pcard_df = load_pcard()

    return {
        "dataframes": {
            "amazon": amazon_df,
            "cruzbuy": cruzbuy_df,
            "pcard": pcard_df,
        },
        "local_paths": _clean_csv_paths(),
    }
