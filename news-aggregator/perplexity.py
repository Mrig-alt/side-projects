"""
Perplexity API — real-time web search for follow-up story tracking.

Perplexity's sonar models have live internet access, making them ideal for:
  - Checking whether a tracked story has developed since the user followed it
  - Surfacing new angles, outcomes, or related events on a specific topic

We do NOT use Perplexity for standard article summarization (Claude is better
at that). Perplexity's role here is purely: "what's new on this story TODAY?"
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from config import PERPLEXITY_API_KEY

logger = logging.getLogger(__name__)

PERPLEXITY_BASE = "https://api.perplexity.ai"

# sonar-pro: best for research, cites sources, real-time web access
# sonar: faster / cheaper, good for quick checks
SEARCH_MODEL = "sonar-pro"

_NO_UPDATE_PHRASES = [
    "no significant",
    "no major update",
    "no new development",
    "nothing new",
    "no update found",
    "no changes",
]


def _looks_like_no_update(text: str) -> bool:
    lower = text.lower()
    return any(phrase in lower for phrase in _NO_UPDATE_PHRASES) and len(text) < 300


async def check_story_updates(
    headline: str,
    keywords: list[str],
    followed_since_iso: str,
) -> Optional[str]:
    """
    Asks Perplexity to search the web for new developments on a story.

    Returns:
        A concise update summary string if something meaningful was found,
        or None if there are no significant new developments.
    """
    if not PERPLEXITY_API_KEY:
        logger.debug("PERPLEXITY_API_KEY not set — skipping follow-up check")
        return None

    kw_hint = (
        f"Key context: {', '.join(keywords[:5])}" if keywords else ""
    )

    user_prompt = (
        f"Story I'm tracking: \"{headline}\"\n"
        f"{kw_hint}\n"
        f"I started tracking this on {followed_since_iso}.\n\n"
        "Search the web for any significant new developments, outcomes, or follow-up "
        "events on this story in the past 24 hours. "
        "If there are real updates, summarize them in 2-4 sentences with the most "
        "important fact first. "
        "If there are genuinely no new developments, reply with exactly: NO_UPDATE"
    )

    payload = {
        "model": SEARCH_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a real-time news tracker. Use your web search capability "
                    "to find the latest factual developments on the user's story. "
                    "Be concise and factual. Include source names where possible."
                ),
            },
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 400,
        "temperature": 0.1,
        "return_citations": True,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{PERPLEXITY_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error("Perplexity API error %s: %s", exc.response.status_code, exc)
        return None
    except Exception as exc:
        logger.error("Perplexity request failed: %s", exc)
        return None

    text = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

    if not text or text == "NO_UPDATE" or _looks_like_no_update(text):
        logger.debug("No update for story: %s", headline[:60])
        return None

    # Append citations if present
    citations: list[str] = data.get("citations", [])
    if citations:
        sources = " · ".join(citations[:3])
        text = f"{text}\n\nSources: {sources}"

    logger.info("New update found for: %s", headline[:60])
    return text


async def perplexity_search(query: str, max_tokens: int = 600) -> Optional[str]:
    """
    General-purpose Perplexity web search — used for on-demand live research
    from the search bar (supplements NewsAPI with real-time web results).
    """
    if not PERPLEXITY_API_KEY:
        return None

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{PERPLEXITY_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": SEARCH_MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a real-time research assistant. Search the web "
                                "and provide a concise, factual briefing on the query. "
                                "Focus on what's happening RIGHT NOW. Cite sources."
                            ),
                        },
                        {"role": "user", "content": query},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.1,
                    "return_citations": True,
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.error("Perplexity search failed for '%s': %s", query, exc)
        return None

    text = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    citations = data.get("citations", [])
    if citations:
        text = f"{text}\n\nSources: {' · '.join(citations[:4])}"
    return text or None
