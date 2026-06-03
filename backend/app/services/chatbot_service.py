"""Gemini-backed chatbot guidance service.

This service uses Gemini when a key is configured and falls back to a local
heuristic response so the chatbot remains usable in development.
"""

from __future__ import annotations

import json
import os
import re
from google import genai
from google.genai import types
from typing import Any, Dict, Optional

from .chatbot_prompts import QUESTION_GROUPS, build_system_prompt


GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite")


def _normalize_context(context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    context = context or {}
    return {
        "current_view": context.get("current_view") or context.get("view") or "dashboard",
        "dataset": context.get("dataset") or "overall",
        "selected_vendor": context.get("selected_vendor") or "",
        "selected_category": context.get("selected_category") or "",
        "selected_time_period": context.get("selected_time_period") or "",
        "filters": context.get("filters") or {},
        "analytics_context": context.get("analytics_context") or {},
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
            "I can help with bookstore stocking, but I need low-turnover or least-purchased item data "
            "in the analytics context to name specific items. Based on the current setup, I can answer "
            "which bookstore items are bought most often or should be prioritized for reordering, but I "
            "should not guess which items can be stocked less often without the low-turnover results."
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
    suggested = group["questions"][:]

    if "bookstore" in lower_message:
        suggested = [
            "Which bookstore items should we prioritize for reordering?",
            "What items were bought the most overall in the past quarter?",
            "Which vendors supply the most frequently purchased bookstore items?",
        ]

    return {
        "answer": answer,
        "category": str(group["id"]),
        "suggested_questions": group["questions"][:3],
        "source": "fallback",
    }


def _build_user_prompt(message: str, context: Dict[str, Any]) -> str:
    context_json = json.dumps(context, indent=2, sort_keys=True)
    return (
        "Dashboard context and live analytics data:\n"
        f"{context_json}\n\n"
        "Use the live analytics data when answering. "
        "If top_items or top_vendors_by_spend are available, reference specific names, counts, spend, or quantities from them. "
        "Do not make up numbers or item names that are not in the provided context.\n\n"
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
    try:
        client = genai.Client(
            vertexai=True,
            project=os.getenv("GOOGLE_CLOUD_PROJECT", "slugsmart2"),
            location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
        )

        prompt = _build_user_prompt(message, context)

        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=build_system_prompt(),
                temperature=0.4,
                max_output_tokens=1024,
            ),
        )

        text = response.text or ""
        if not text:
            return None

        try:
            parsed = _parse_json_response(text)
        except json.JSONDecodeError:
            print("[VERTEX AI WARNING] Response was not valid JSON. Using raw text.")
            parsed = {
                "answer": text,
                "category": _matched_group(message)["id"],
                "suggested_questions": _matched_group(message)["questions"][:3],
            }

        suggested_questions = parsed.get("suggested_questions") or []
        
        if not isinstance(suggested_questions, list):
            suggested_questions = []

        print("[VERTEX AI SUCCESS] Response generated")

        return {
            "answer": str(parsed.get("answer") or text).strip(),
            "category": str(parsed.get("category") or _matched_group(message)["id"]),
            "suggested_questions": [str(question) for question in suggested_questions[:3]],
            "source": "vertex",
        }

    except Exception as e:
        print("[VERTEX AI ERROR]", repr(e))
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
