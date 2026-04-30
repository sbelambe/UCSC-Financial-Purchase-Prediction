"""Gemini-backed chatbot guidance service.

This service uses Gemini when a key is configured and falls back to a local
heuristic response so the chatbot remains usable in development.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

from .chatbot_prompts import QUESTION_GROUPS, build_system_prompt


GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")


def _normalize_context(context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    context = context or {}
    return {
        "current_view": context.get("current_view") or context.get("view") or "dashboard",
        "dataset": context.get("dataset") or "overall",
        "selected_vendor": context.get("selected_vendor") or "",
        "selected_category": context.get("selected_category") or "",
        "selected_time_period": context.get("selected_time_period") or "",
        "filters": context.get("filters") or {},
    }


def _matched_group(message: str) -> Dict[str, Any]:
    lowered = message.lower()
    for group in QUESTION_GROUPS:
        title = str(group["title"]).lower()
        if "vendor" in lowered and "vendor" in title:
            return group
        if "spring" in lowered and "season" in title:
            return group
        if "bookstore" in lowered and "bookstore" in title:
            return group
        if any(token in lowered for token in ("past", "history", "previous", "last quarter")) and "past" in title:
            return group
    return QUESTION_GROUPS[0]


def _fallback_response(message: str, context: Dict[str, Any]) -> Dict[str, Any]:
    group = _matched_group(message)
    dataset = context.get("dataset") or "overall"
    selected_vendor = context.get("selected_vendor") or "the current vendor"
    selected_category = context.get("selected_category") or "the current category"
    selected_time_period = context.get("selected_time_period") or "the selected time period"

    lower_message = message.lower()
    if "bookstore" in lower_message:
        answer = (
            "For bookstore planning, ask about low-turnover items, seasonal peaks, and "
            "items that are consistently purchased in smaller quantities. That helps "
            "identify what can be stocked less often without hurting availability."
        )
    elif "spring" in lower_message:
        answer = (
            f"For {selected_time_period or 'spring'} demand, compare item frequency and spend "
            "against other quarters to spot seasonal spikes and prepare inventory earlier."
        )
    elif "vendor" in lower_message:
        answer = (
            f"For {selected_vendor}, focus on the items with the highest purchase frequency "
            "and then check whether those items are likely to repeat in the next quarter."
        )
    else:
        answer = (
            f"In {dataset}, start by asking which items have the strongest historical demand "
            f"under {selected_category or 'your current filters'} and then narrow to vendor "
            "or seasonal patterns."
        )

    return {
        "answer": answer,
        "category": str(group["id"]),
        "suggested_questions": group["questions"][:3],
        "source": "fallback",
    }


def _build_user_prompt(message: str, context: Dict[str, Any]) -> str:
    context_json = json.dumps(context, indent=2, sort_keys=True)
    return (
        "Dashboard context:\n"
        f"{context_json}\n\n"
        "User question:\n"
        f"{message}\n\n"
        "Return valid JSON with these keys: answer, category, suggested_questions. "
        "suggested_questions must contain exactly three concise follow-up questions."
    )


def _parse_json_response(text: str) -> Dict[str, Any]:
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate)
        candidate = re.sub(r"\s*```$", "", candidate)
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = candidate[start : end + 1]
    return json.loads(candidate)


def _call_gemini(message: str, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    prompt = _build_user_prompt(message, context)
    payload = {
        "systemInstruction": {
            "parts": [{"text": build_system_prompt()}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 512,
        },
    }

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={api_key}"
    )
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")
        response_json = json.loads(raw)
        text = ""
        candidates = response_json.get("candidates") or []
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            text = "".join(part.get("text", "") for part in parts if isinstance(part, dict))
        if not text:
            return None

        parsed = _parse_json_response(text)
        suggested_questions = parsed.get("suggested_questions") or []
        if not isinstance(suggested_questions, list):
            suggested_questions = []

        return {
            "answer": str(parsed.get("answer") or text).strip(),
            "category": str(parsed.get("category") or _matched_group(message)["id"]),
            "suggested_questions": [str(question) for question in suggested_questions[:3]],
            "source": "gemini",
        }
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, KeyError, IndexError, ValueError):
        return None


def generate_chatbot_guidance(message: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Generate a chatbot response and three suggested follow-up questions."""
    normalized_context = _normalize_context(context)
    stripped_message = (message or "").strip()
    if not stripped_message:
        fallback = _fallback_response("", normalized_context)
        fallback["answer"] = (
            "Try one of the guided questions below to explore historical demand, "
            "seasonal changes, or vendor-specific ordering patterns."
        )
        return fallback

    gemini_response = _call_gemini(stripped_message, normalized_context)
    if gemini_response:
        return gemini_response

    return _fallback_response(stripped_message, normalized_context)
