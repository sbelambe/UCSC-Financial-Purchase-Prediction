from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import uuid, os
from datetime import datetime, timezone
from google.cloud import bigquery
from dotenv import load_dotenv

router = APIRouter(
    prefix="/api/analytics",
    tags=["feedback"]
)

class FeedbackSubmission(BaseModel):
    item_category: str
    predicted_demand: int
    current_stock: int
    user_comment: str


@router.post("/feedback")
def submit_feedback(feedback: FeedbackSubmission):
    """
    Processes and stores user feedback regarding inventory predictions into BigQuery.

    Route: POST /api/analytics/feedback

    This endpoint receives user corrections for ML model forecasts. It dynamically 
    resolves the absolute path to the Google Cloud credentials using `__file__` 
    to ensure reliable execution regardless of the terminal's working directory, 
    and inserts the record into the BigQuery `prediction_feedback` table.

    Args:
        feedback (FeedbackSubmission): A Pydantic model containing:
            - item_category (str): The name/category of the flagged item.
            - predicted_demand (int): The ML model's forecasted demand.
            - current_stock (int): The actual current stock level.
            - user_comment (str): The user's explanation for the inaccuracy.

    Returns:
        dict: A status dictionary containing a success message.

    Raises:
        ValueError: If the `serviceAccountKey.json` or `BIGQUERY_DATASET` cannot be found.
        HTTPException (500): If the BigQuery insertion fails or an unexpected error occurs.
    """
    try:
        load_dotenv()
        
        current_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
        actual_path = os.path.join(root_dir, "serviceAccountKey.json")
        if not os.path.exists(actual_path):
            print(f"[DEBUG] File not found. Looked in exact location:\n{actual_path}")
            raise ValueError(f"CRITICAL: Could not find serviceAccountKey.json at project root ({actual_path})!")

        
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = actual_path
 
        client = bigquery.Client()
        dataset_id = os.getenv("BIGQUERY_DATASET")
        
        if not dataset_id:
            raise ValueError("BIGQUERY_DATASET environment variable is not set.")

        table_id = f"{client.project}.{dataset_id}.prediction_feedback"
        
        rows_to_insert = [{
            "feedback_id": str(uuid.uuid4()),
            "item_category": feedback.item_category,
            "predicted_demand": feedback.predicted_demand,
            "current_stock": feedback.current_stock,
            "user_comment": feedback.user_comment,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "status": "Pending"
        }]
        
        errors = client.insert_rows_json(table_id, rows_to_insert)
        if errors:
            raise HTTPException(status_code=500, detail=f"BigQuery Insert Failed: {errors}")
        
        return {"status": "success", "message": "Feedback recorded."}
        
    except Exception as e:
        print(f"[ERROR] Feedback Endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))