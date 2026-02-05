from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import pandas as pd


@dataclass
class RawDataBundle:
    amazon: Optional[pd.DataFrame] = None
    cruzbuy: Optional[pd.DataFrame] = None
    pcard: Optional[pd.DataFrame] = None


def load_all_data() -> RawDataBundle:
    """
    Placeholder loader.

    Later: this will read raw spreadsheets downloaded from Google Drive.
    For now: returns empty dataframes so imports and pipeline wiring work.
    """
    return RawDataBundle(
        amazon=pd.DataFrame(),
        cruzbuy=pd.DataFrame(),
        pcard=pd.DataFrame(),
    )
