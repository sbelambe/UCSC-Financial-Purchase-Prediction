from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

router = APIRouter()

# strictly defines the payload coming from the chatbot component
class ChatbotRequest(BaseModel):
    message: str
    current_view: Optional[str] = "dashboard"
    dataset: Optional[str] = "overall"
    selected_vendor: Optional[str] = ""
    selected_category: Optional[str] = ""
    selected_time_period: Optional[str] = ""
    filters: Optional[Dict[str, Any]] = {}


# Routes
@router.post("/guidance")
# Handles incoming chatbot messages from the frontend.
# It parses the user's question and current dashboard context, 
# and returns a guided response with suggested follow-up questions.
# Future implementation will connect this directly to the Gemini LLM.
def get_chatbot_guidance(request: ChatbotRequest):
    try:
        lower_msg = request.message.lower()
        
        # Safe fallback defaults
        answer = "I can help you analyze that data. Please refine your question or use the dashboard filters."
        suggested = ["What are the top items?", "Show me spending over time"]

        # Simple context-aware routing for the MVP
        if "vendor" in lower_msg:
            answer = f"To analyze vendor demand, check the 'Top Purchase Patterns' for {request.dataset}."
            suggested = ["What items will be bought the most from this vendor?", "What vendor items should we reorder first?"]
        elif "seasonal" in lower_msg or "quarter" in lower_msg:
            answer = "Seasonal patterns typically show spikes in the Fall and Spring quarters. Check the 'Transactions Over Time' chart."
            suggested = ["What items are bought the most in the spring quarter?", "How does demand change between spring and fall quarters?"]
        elif "bookstore" in lower_msg:
            answer = "The bookstore inventory is updated via BigQuery point-of-sale data."
            suggested = ["Which bookstore items have low turnover?", "Which bookstore items should be prioritized for reordering?"]

        return {
            "status": "success",
            "data": {
                "answer": answer,
                "suggested_questions": suggested
            }
        }
    except Exception as e:
        print(f"[ERROR] Chatbot guidance failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to process chatbot request.")