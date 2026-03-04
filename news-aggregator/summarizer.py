"""
Claude API integration for:
  1. Single-article AI summaries (on-demand, triggered by user click)
  2. Developing story analysis — clusters all articles across categories and
     identifies overarching narratives, key actors, and what to watch.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY
from storage import Article, DevelopingStory, make_article_id

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"
MAX_TOKENS_SUMMARY = 300
MAX_TOKENS_DEVELOPING = 2000


def _get_client() -> Optional[anthropic.Anthropic]:
    if not ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — AI features disabled")
        return None
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


# ---------------------------------------------------------------------------
# Single article summary
# ---------------------------------------------------------------------------

async def summarize_article(article: Article) -> str:
    """
    Returns a 2-3 sentence AI summary of the article.
    Falls back to the RSS excerpt if Claude API is not configured.
    """
    client = _get_client()
    if not client:
        return article.summary or "AI summaries require ANTHROPIC_API_KEY in .env"

    prompt = f"""Summarize this news article in 2-3 concise sentences. Focus on:
- What happened / what is being reported
- Why it matters (financial, political, or operational impact)
- Any key figures or organizations involved

Title: {article.title}
Source: {article.source}
Excerpt: {article.summary or "(no excerpt available)"}

Reply with ONLY the summary, no preamble."""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS_SUMMARY,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
    except Exception as exc:
        logger.error("Claude summary failed for '%s': %s", article.title, exc)
        return article.summary or "Summary unavailable."


# ---------------------------------------------------------------------------
# Developing stories analysis
# ---------------------------------------------------------------------------

def _build_developing_prompt(articles_by_category: dict[str, list[Article]]) -> str:
    """Build the prompt for developing story identification."""
    lines: list[str] = [
        "You are a senior intelligence analyst. Below are recent headlines grouped by region/topic.",
        "Identify 4-6 overarching DEVELOPING STORIES that span multiple sources or regions.",
        "",
        "For each developing story, return a JSON object with these fields:",
        '  "id": short_snake_case_id,',
        '  "headline": "concise story title (max 10 words)",',
        '  "description": "2-3 sentence narrative of what is unfolding",',
        '  "regions": ["list", "of", "affected", "regions"],',
        '  "article_ids": ["list of article IDs that relate to this story"],',
        '  "key_actors": ["list of key people, companies, governments"],',
        '  "what_to_watch": "1-2 sentences on what to monitor next"',
        "",
        "Return ONLY a JSON array of these objects, no markdown, no commentary.",
        "",
        "--- HEADLINES ---",
    ]

    for cat_id, articles in articles_by_category.items():
        if not articles:
            continue
        lines.append(f"\n[{cat_id}]")
        for art in articles[:15]:  # cap per category to keep prompt manageable
            lines.append(f"  ID:{art.id} | {art.title} ({art.source})")

    return "\n".join(lines)


async def identify_developing_stories(
    articles_by_category: dict[str, list[Article]],
) -> list[DevelopingStory]:
    """
    Sends all recent headlines to Claude and asks it to identify developing
    cross-cutting narratives. Returns a list of DevelopingStory objects.
    """
    client = _get_client()
    if not client:
        return []

    total = sum(len(v) for v in articles_by_category.values())
    if total < 5:
        logger.info("Too few articles (%d) for developing story analysis", total)
        return []

    prompt = _build_developing_prompt(articles_by_category)

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS_DEVELOPING,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown code fences if Claude wraps in ```json ... ```
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        data: list[dict] = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Could not parse developing stories JSON: %s", exc)
        return []
    except Exception as exc:
        logger.error("Claude developing stories failed: %s", exc)
        return []

    stories: list[DevelopingStory] = []
    for item in data:
        try:
            story = DevelopingStory(
                id=item.get("id", make_article_id(item.get("headline", str(len(stories))))),
                headline=item.get("headline", "Unknown Story"),
                description=item.get("description", ""),
                regions=item.get("regions", []),
                article_ids=item.get("article_ids", []),
                key_actors=item.get("key_actors", []),
                what_to_watch=item.get("what_to_watch", ""),
                generated_at=datetime.now(timezone.utc),
            )
            stories.append(story)
        except Exception as exc:
            logger.warning("Skipping malformed developing story: %s", exc)

    logger.info("Identified %d developing stories", len(stories))
    return stories


# ---------------------------------------------------------------------------
# Topic keyword search summary
# ---------------------------------------------------------------------------

async def pick_top_stories(
    recent_articles: list[Article],
    n: int = 3,
) -> list[Article]:
    """
    From articles published in the last 6 hours, ask Claude to pick the
    N most globally significant / high-impact stories.
    Falls back to the N newest articles if API is not configured.
    """
    if not recent_articles:
        return []

    client = _get_client()
    if not client:
        return sorted(recent_articles, key=lambda a: a.published, reverse=True)[:n]

    numbered = "\n".join(
        f"{i}. [{a.category_id}] {a.title} — {a.source} ({a.published.strftime('%H:%M UTC')})"
        for i, a in enumerate(recent_articles[:40], 1)
    )
    prompt = f"""You are a news editor. From these recent headlines (last 6 hours), pick the {n} most important stories that a globally-minded reader interested in India, US, Europe, finance, politics, and supply chains should know about right now.

{numbered}

Reply with ONLY a JSON array of the line numbers you selected, e.g. [3, 17, 22]. No explanation."""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=50,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        indices = json.loads(raw)
        selected = [recent_articles[i - 1] for i in indices if 1 <= i <= len(recent_articles)]
        return selected[:n]
    except Exception as exc:
        logger.error("Top story selection failed: %s", exc)
        return sorted(recent_articles, key=lambda a: a.published, reverse=True)[:n]


async def detect_significant_stories(new_articles: list[Article]) -> list[dict]:
    """
    Scan freshly fetched articles for stories significant enough to warrant
    an immediate notification (breaking, controversial, market-moving, etc.).

    Only considers articles published within the last 2 hours.
    Returns up to 3 flagged items as dicts:
      {article_id, headline, reason, severity, category, url, source}

    Called after every refresh cycle when new articles were actually added.
    """
    from datetime import timedelta

    client = _get_client()
    if not client or not new_articles:
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(hours=2)
    fresh = [
        a for a in new_articles
        if (a.published if a.published.tzinfo else a.published.replace(tzinfo=timezone.utc)) >= cutoff
    ]
    if not fresh:
        return []

    numbered = "\n".join(
        f"{i}. [ID:{a.id}] [{a.category_id}] {a.title} — {a.source}"
        for i, a in enumerate(fresh[:40], 1)
    )

    prompt = f"""Scan these recent news headlines and flag up to 3 that are genuinely significant right now.

A story is notification-worthy if it is: breaking/urgent, highly controversial, market-moving,
geopolitically important for India/US/Europe, or an operational shock to global supply chains.

{numbered}

Reply with ONLY a JSON array ([] if nothing clears the bar). Each object:
{{
  "article_id": "the ID shown after ID:",
  "headline": "the title",
  "reason": "one sentence — why this matters RIGHT NOW",
  "severity": "high" or "medium",
  "category": one of [political, financial, supply_chain, breaking, controversial]
}}

Be selective — flag only genuinely important developments, not routine updates.
Most refreshes should return []."""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=700,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        items = json.loads(raw)
        # Enrich with url/source from the article store
        id_to_article = {a.id: a for a in fresh}
        for item in items:
            art = id_to_article.get(item.get("article_id"))
            if art:
                item["url"] = art.url
                item["source"] = art.source
        return items[:3]
    except Exception as exc:
        logger.error("Significance detection failed: %s", exc)
        return []


async def summarize_search_results(query: str, articles: list[Article]) -> str:
    """
    Given a search query and matching articles, return an AI overview of
    what's happening on this topic. Used for the search panel.
    """
    client = _get_client()
    if not client or not articles:
        return ""

    headlines = "\n".join(
        f"- {a.title} ({a.source}, {a.published.strftime('%b %d')})"
        for a in articles[:20]
    )
    prompt = f"""I searched for "{query}" and found these headlines:

{headlines}

Give me a 3-4 sentence briefing on what's happening with this topic right now.
Focus on trends, key developments, and what's driving the coverage.
Reply with ONLY the briefing, no preamble."""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
    except Exception as exc:
        logger.error("Claude search summary failed: %s", exc)
        return ""
