import os
import sys
from typing import Dict, Any

current_dir = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(current_dir, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from data_cleaning.src.pipeline import run_data_cleaning


def run_cleaning() -> Dict[str, Any]:
    """
    Runs the data cleaning pipeline only.
    """
    cleaning_result = run_data_cleaning()
    dataframes = cleaning_result["dataframes"]

    return {
        "dataframes": dataframes,
        "local_paths": cleaning_result["local_paths"],
        "row_counts": {
            "amazon": len(dataframes["amazon"]),
            "cruzbuy": len(dataframes["cruzbuy"]),
            "pcard": len(dataframes["pcard"]),
        },
    }


if __name__ == "__main__":
    print(run_cleaning()["row_counts"])
