from __future__ import annotations

from dataclasses import asdict

from .src.load_data import load_all_data
from .src.clean_amazon import clean_amazon
from .src.clean_cruzbuy import clean_cruzbuy
from .src.clean_pcard import clean_pcard


def run_pipeline() -> dict:
    """
    Placeholder pipeline: load -> clean -> return row counts.

    Later: load from Drive, clean, write to Supabase.
    """
    bundle = load_all_data()

    amazon_clean = clean_amazon(bundle.amazon)
    cruzbuy_clean = clean_cruzbuy(bundle.cruzbuy)
    pcard_clean = clean_pcard(bundle.pcard)

    return {
        "amazon_rows": int(len(amazon_clean)),
        "cruzbuy_rows": int(len(cruzbuy_clean)),
        "pcard_rows": int(len(pcard_clean)),
        "bundle_keys": list(asdict(bundle).keys()),
    }
