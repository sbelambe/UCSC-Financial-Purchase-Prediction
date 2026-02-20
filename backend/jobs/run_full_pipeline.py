import os
import sys
from typing import Dict, Any

current_dir = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.abspath(os.path.join(current_dir, ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from jobs.run_firebase_uploads import run_firebase_uploads


def run_full_pipeline() -> Dict[str, Any]:
    """
    Runs end-to-end pipeline: cleaning + Firebase uploads.
    """
    return run_firebase_uploads()


if __name__ == "__main__":
    print(run_full_pipeline())
