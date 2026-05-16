import os
import sys


def _add_backend_to_python_path() -> None:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_root = os.path.abspath(os.path.join(current_dir, "..", ".."))

    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)


_add_backend_to_python_path()

from data_cleaning.src.pipeline import run_data_cleaning


def run_pipeline():
    result = run_data_cleaning()
    dataframes = result["dataframes"]

    row_counts = {
        dataset: len(dataframe)
        for dataset, dataframe in dataframes.items()
    }

    print("Cleaned CSV outputs:")
    for dataset, path in result["local_paths"].items():
        print(f"- {dataset}: {path}")

    print("\nRow counts:")
    for dataset, count in row_counts.items():
        print(f"- {dataset}: {count}")

    return result


if __name__ == "__main__":
    run_pipeline()