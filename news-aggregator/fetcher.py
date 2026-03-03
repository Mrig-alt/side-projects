"""
RSS feed fetching with premium cookie authentication and NewsAPI search.

RSS fetching:
  - Uses httpx async client with optional cookie headers for premium sites
  - Parses feeds with feedparser
  - Falls back gracefully if premium cookies are missing/expired

NewsAPI:
  - Used for on-demand topic searches (UFO sightings, any custom query)
  - Requires NEWS_API_KEY in .env
  - Free tier allows 100 req/day; paid tier removes limits
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

import feedparser
import httpx

from config import (
    CATEGORIES,
    DEFAULT_CUSTOM_TOPICS,
    MAX_ARTICLES_PER_FEED,
    NEWS_API_KEY,
    Feed,
    get_premium_cookies,
)
from storage import Article, make_article_id

logger = logging.getLogger(__name__)

NEWS_API_BASE = "https://newsapi.org/v2/everything"
REQUEST_TIMEOUT = 15  # seconds
MAX_CONCURRENT_FEEDS = 10


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_date(entry: feedparser.FeedParserDict) -> datetime:
    """Try multiple date fields; fall back to now."""
    for attr in ("published_parsed", "updated_parsed", "created_parsed"):
        tup = getattr(entry, attr, None)
        if tup:
            try:
                return datetime(*tup[:6], tzinfo=timezone.utc)
            except Exception:
                pass
    # Try string parse
    for attr in ("published", "updated"):
        val = getattr(entry, attr, None)
        if val:
            try:
                return parsedate_to_datetime(val)
            except Exception:
                pass
    return datetime.now(timezone.utc)


def _clean_html(text: str) -> str:
    """Strip HTML tags for plain-text summaries."""
    import re
    return re.sub(r"<[^>]+>", "", text or "").strip()


def _entry_to_article(entry, category_id: str, source_name: str, is_premium: bool) -> Optional[Article]:
    url = getattr(entry, "link", None)
    title = getattr(entry, "title", None)
    if not url or not title:
        return None

    summary = ""
    for attr in ("summary", "description", "content"):
        raw = getattr(entry, attr, None)
        if raw:
            if isinstance(raw, list) and raw:
                raw = raw[0].get("value", "")
            summary = _clean_html(str(raw))[:500]
            break

    return Article(
        id=make_article_id(url),
        title=title.strip(),
        url=url.strip(),
        source=source_name,
        category_id=category_id,
        published=_parse_date(entry),
        summary=summary,
        is_premium=is_premium,
    )


# ---------------------------------------------------------------------------
# Single feed fetch
# ---------------------------------------------------------------------------

async def fetch_feed(
    client: httpx.AsyncClient,
    feed: Feed,
    category_id: str,
) -> list[Article]:
    cookies = {}
    if feed.domain:
        cookies = get_premium_cookies(feed.domain)

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; PersonalNewsAggregator/1.0)"
        ),
    }
    if cookies:
        headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in cookies.items())

    try:
        resp = await client.get(feed.url, headers=headers, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (401, 403) and feed.is_premium:
            logger.warning(
                "%s returned %s — premium cookies may be missing or expired",
                feed.name,
                exc.response.status_code,
            )
        else:
            logger.warning("HTTP %s fetching %s", exc.response.status_code, feed.url)
        return []
    except Exception as exc:
        logger.warning("Error fetching %s: %s", feed.url, exc)
        return []

    parsed = feedparser.parse(resp.text)
    articles: list[Article] = []
    for entry in parsed.entries[:MAX_ARTICLES_PER_FEED]:
        art = _entry_to_article(entry, category_id, feed.name, feed.is_premium)
        if art:
            articles.append(art)

    return articles


# ---------------------------------------------------------------------------
# Batch fetch all core categories
# ---------------------------------------------------------------------------

async def fetch_all_categories() -> list[Article]:
    """Fetch every configured feed across all core categories concurrently."""
    sem = asyncio.Semaphore(MAX_CONCURRENT_FEEDS)

    async def bounded_fetch(client: httpx.AsyncClient, feed: Feed, cat_id: str) -> list[Article]:
        async with sem:
            return await fetch_feed(client, feed, cat_id)

    async with httpx.AsyncClient(follow_redirects=True) as client:
        tasks = [
            bounded_fetch(client, feed, cat_id)
            for cat_id, cat_cfg in CATEGORIES.items()
            for feed in cat_cfg["feeds"]
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    all_articles: list[Article] = []
    for result in results:
        if isinstance(result, Exception):
            logger.warning("Feed task raised: %s", result)
        else:
            all_articles.extend(result)

    logger.info("Fetched %d articles from core categories", len(all_articles))
    return all_articles


# ---------------------------------------------------------------------------
# Custom topic fetch (dedicated RSS feeds per topic)
# ---------------------------------------------------------------------------

async def fetch_topic_feeds(topic: dict) -> list[Article]:
    """Fetch dedicated RSS feeds for a custom topic."""
    feeds: list[Feed] = topic.get("feeds", [])
    topic_id: str = topic["id"]

    async with httpx.AsyncClient(follow_redirects=True) as client:
        tasks = [fetch_feed(client, feed, f"topic_{topic_id}") for feed in feeds]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    articles: list[Article] = []
    for result in results:
        if not isinstance(result, Exception):
            articles.extend(result)
    return articles


# ---------------------------------------------------------------------------
# NewsAPI search (on-demand and keyword matching for custom topics)
# ---------------------------------------------------------------------------

async def newsapi_search(
    query: str,
    category_id: str = "search",
    page_size: int = 20,
) -> list[Article]:
    """Search NewsAPI for any query string. Returns empty list if key not configured."""
    if not NEWS_API_KEY:
        logger.debug("NEWS_API_KEY not set — skipping NewsAPI search for '%s'", query)
        return []

    params = {
        "q": query,
        "apiKey": NEWS_API_KEY,
        "pageSize": min(page_size, 100),
        "sortBy": "publishedAt",
        "language": "en",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(NEWS_API_BASE, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("NewsAPI error for '%s': %s", query, exc)
        return []

    articles: list[Article] = []
    for item in data.get("articles", []):
        url = item.get("url")
        title = item.get("title")
        if not url or not title or url == "https://removed.com":
            continue

        try:
            pub = datetime.fromisoformat(item["publishedAt"].replace("Z", "+00:00"))
        except Exception:
            pub = datetime.now(timezone.utc)

        art = Article(
            id=make_article_id(url),
            title=title,
            url=url,
            source=item.get("source", {}).get("name", "NewsAPI"),
            category_id=category_id,
            published=pub,
            summary=_clean_html(item.get("description") or item.get("content") or "")[:500],
        )
        articles.append(art)

    return articles


# ---------------------------------------------------------------------------
# Fetch all default custom topics (RSS + keyword filter across stored articles)
# ---------------------------------------------------------------------------

async def fetch_default_topics() -> dict[str, list[Article]]:
    """
    Returns a dict of topic_id → articles for all DEFAULT_CUSTOM_TOPICS.
    Each topic gets: its dedicated feed articles + NewsAPI search results.
    """
    results: dict[str, list[Article]] = {}
    for topic in DEFAULT_CUSTOM_TOPICS:
        topic_articles: list[Article] = []

        # 1. Dedicated RSS feeds for this topic
        if topic.get("feeds"):
            topic_articles.extend(await fetch_topic_feeds(topic))

        # 2. NewsAPI search using first keyword
        if topic.get("keywords") and NEWS_API_KEY:
            primary_kw = topic["keywords"][0]
            news_articles = await newsapi_search(primary_kw, f"topic_{topic['id']}")
            topic_articles.extend(news_articles)

        results[topic["id"]] = topic_articles

    return results
