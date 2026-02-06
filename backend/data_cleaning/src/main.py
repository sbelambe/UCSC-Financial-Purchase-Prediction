# program entry point - runs the program
from clean_amazon import load_amazon
from clean_cruzbuy import clean_cruzbuy
# from .clean_pcard import clean_pcard

def run_pipeline():
    """
    Runs all cleaning functions and returns summary information.
    """

    # Clean each dataset
    amazon_df = load_amazon()
    cruzbuy_df = clean_cruzbuy()
    # pcard_df = clean_pcard()

    # Create summary
    result = {
        "amazon_rows": len(amazon_df),
        "cruzbuy_rows": len(cruzbuy_df),
        "pcard_rows": len(pcard_df),
        "bundle_keys": ["amazon", "cruzbuy", "pcard"]
    }

    return result

if __name__ == "__main__":
    print(run_pipeline())