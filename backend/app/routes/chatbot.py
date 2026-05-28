from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.chatbot_service import generate_chatbot_guidance
from typing import Optional, Dict, Any

router = APIRouter()

ALLOWED_DATASETS = {
    "overall",
    "amazon",
    "cruzbuy",
    "onecard",
    "pcard",
    "procard",
    "bookstore",
}

BLOCKED_TERMS = [
    "ignore previous instructions",
    "ignore all previous instructions",
    "reveal system prompt",
    "show system prompt",
    "print system prompt",
    "api key",
    "password",
    "credentials",
    "environment variable",
    ".env",
    "secret",
    "token",
    "bypass",
    "jailbreak",
    "hack",
    "malware",
    "phishing",
    "sql injection",
]

SAFE_REDIRECT = (
    "I can only help with UCSC purchasing analytics, dashboard insights, "
    "vendor trends, and Campus Store stocking questions."
)


class ChatbotRequest(BaseModel):
    message: str
    current_view: Optional[str] = "dashboard"
    dataset: Optional[str] = "overall"
    selected_vendor: Optional[str] = ""
    selected_category: Optional[str] = ""
    selected_time_period: Optional[str] = ""
    filters: Optional[Dict[str, Any]] = {}


def is_blocked_message(message: str) -> bool:
    lowered = (message or "").lower()
    return any(term in lowered for term in BLOCKED_TERMS)


@router.post("/guidance")
def get_chatbot_guidance(request: ChatbotRequest):
    try:
        message = (request.message or "").strip()
        dataset = (request.dataset or "overall").strip().lower()

        if not message:
            return {
                "status": "blocked",
                "data": {
                    "answer": "Please ask a question about UCSC purchasing analytics or Campus Store stocking.",
                    "category": "guardrail",
                    "suggested_questions": [
                        "Which bookstore items should we prioritize for reordering?",
                        "What items were purchased most often last quarter?",
                        "How does demand change across quarters?",
                    ],
                    "source": "guardrail",
                },
            }

        if len(message) > 1000:
            return {
                "status": "blocked",
                "data": {
                    "answer": "Please shorten your question. I can help with focused questions about UCSC purchasing analytics.",
                    "category": "guardrail",
                    "suggested_questions": [
                        "Which items should we restock first?",
                        "What are the top purchasing trends?",
                        "Which vendors have the highest demand?",
                    ],
                    "source": "guardrail",
                },
            }

        if dataset not in ALLOWED_DATASETS:
            return {
                "status": "blocked",
                "data": {
                    "answer": SAFE_REDIRECT,
                    "category": "guardrail",
                    "suggested_questions": [
                        "What are the top items in the approved datasets?",
                        "Which bookstore items should we prioritize for reordering?",
                        "What purchasing trends appear in the dashboard?",
                    ],
                    "source": "guardrail",
                },
            }

        if is_blocked_message(message):
            return {
                "status": "blocked",
                "data": {
                    "answer": SAFE_REDIRECT,
                    "category": "guardrail",
                    "suggested_questions": [
                        "Which bookstore items should we prioritize for reordering?",
                        "What purchasing trends appear in the dashboard?",
                        "How does demand change across quarters?",
                    ],
                    "source": "guardrail",
                },
            }

        context = {
            "current_view": request.current_view,
            "dataset": dataset,
            "selected_vendor": request.selected_vendor,
            "selected_category": request.selected_category,
            "selected_time_period": request.selected_time_period,
            "filters": request.filters,
        }

        result = generate_chatbot_guidance(
            message=message,
            context=context,
        )

        return {
            "status": "success",
            "data": result,
        }

    except Exception as e:
        print(f"[ERROR] Chatbot guidance failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to process chatbot request.")