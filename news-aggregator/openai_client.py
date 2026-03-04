"""
OpenAI integration — alternative AI for article summaries.

Role in the system:
  - Primary: Claude (Anthropic) for summaries and developing-story analysis
  - Alternative: OpenAI GPT-4o for summaries when SUMMARY_AI=openai
  - Cross-validation: run both and show which AI gave the summary (optional)

The IE partnership account should provide an OPENAI_API_KEY.
Set SUMMARY_AI=openai in .env to use GPT-4o as the default summarizer,
or SUMMARY_AI=both to show summaries from both models side-by-side.
"""

from __future__ import annotations

import logging
from typing import Optional

from config import OPENAI_API_KEY, SUMMARY_AI

logger = logging.getLogger(__name__)

OPENAI_MODEL = "gpt-4o"
MAX_TOKENS = 350


def _get_openai_client():
    if not OPENAI_API_KEY:
        return None
    try:
        from openai import OpenAI
        return OpenAI(api_key=OPENAI_API_KEY)
    except ImportError:
        logger.warning("openai package not installed. Run: pip install openai")
        return None


def summarize_with_openai(title: str, excerpt: str, source: str) -> Optional[str]:
    """
    Synchronous OpenAI summary (called from async context via executor if needed).
    Returns summary string or None if OpenAI is not configured.
    """
    client = _get_openai_client()
    if not client:
        return None

    prompt = (
        f"Summarize this news article in 2-3 concise sentences. Focus on:\n"
        f"- What happened and why it matters\n"
        f"- Key figures or organizations\n"
        f"- Financial, political, or operational impact if any\n\n"
        f"Title: {title}\n"
        f"Source: {source}\n"
        f"Excerpt: {excerpt or '(no excerpt)'}\n\n"
        f"Reply with ONLY the summary."
    )

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip()
    except Exception as exc:
        logger.error("OpenAI summarize failed: %s", exc)
        return None


def identify_developing_with_openai(headlines_block: str) -> Optional[str]:
    """
    Alternative developing-story analysis using GPT-4o.
    Input: the same structured headlines prompt used for Claude.
    Returns raw JSON string (same format as Claude's output).
    """
    client = _get_openai_client()
    if not client:
        return None

    try:
        resp = client.chat.completions.create(
            model=OPENAI_MODEL,
            max_tokens=2000,
            messages=[{"role": "user", "content": headlines_block}],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        # GPT-4o with json_object mode wraps in an object — extract stories array
        import json
        raw = resp.choices[0].message.content
        parsed = json.loads(raw)
        # Normalize: GPT sometimes wraps in {"stories": [...]}
        if isinstance(parsed, dict):
            for key in ("stories", "developing_stories", "items", "results"):
                if key in parsed and isinstance(parsed[key], list):
                    return json.dumps(parsed[key])
            # If it's a single story object
            return json.dumps([parsed])
        return json.dumps(parsed)
    except Exception as exc:
        logger.error("OpenAI developing stories failed: %s", exc)
        return None


def is_openai_enabled() -> bool:
    return bool(OPENAI_API_KEY) and SUMMARY_AI in ("openai", "both")
