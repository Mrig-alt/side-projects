"""
Background scheduler — runs every REFRESH_INTERVAL_MINUTES.
On each tick:
  1. Fetch all core category feeds
  2. Fetch all active custom topic feeds + NewsAPI searches
  3. Prune articles older than MAX_ARTICLES_AGE_HOURS
  4. Run AI developing-story analysis (if Claude API key is set)
  5. Compute top 3 stories from last 6 hours for the landing hero

Daily at FOLLOWUP_CHECK_HOUR_UTC:
  6. Check all followed stories for updates via Perplexity web search
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import DEFAULT_CUSTOM_TOPICS, FOLLOWUP_CHECK_HOUR_UTC, REFRESH_INTERVAL_MINUTES
from fetcher import fetch_all_categories, fetch_topic_feeds, newsapi_search
from follow_up import check_all_followups, follow_up_store
from notifier import Alert, alert_bus
from storage import store
from summarizer import detect_significant_stories, identify_developing_stories, pick_top_stories

logger = logging.getLogger(__name__)

# Singleton scheduler
scheduler = AsyncIOScheduler()

# In-memory cache for the landing hero (updated on each refresh)
_top_stories_cache: list[dict] = []
_last_refresh: datetime | None = None


def get_top_stories_cache() -> list[dict]:
    return list(_top_stories_cache)


def get_last_refresh() -> str | None:
    return _last_refresh.isoformat() if _last_refresh else None


async def _fetch_custom_topics() -> None:
    """Fetch articles for all user-created custom topics (stored in store)."""
    custom_topics = store.get_custom_topics()
    for topic_id, topic in custom_topics.items():
        articles = []

        # Dedicated RSS feeds
        if topic.get("feeds"):
            articles.extend(await fetch_topic_feeds(topic))

        # NewsAPI keyword search
        keywords: list[str] = topic.get("keywords", [])
        if keywords:
            query = " OR ".join(f'"{kw}"' for kw in keywords[:3])
            news_results = await newsapi_search(query, f"topic_{topic_id}")
            articles.extend(news_results)

        if articles:
            await store.upsert_articles(articles)
            article_ids = [a.id for a in articles]
            await store.tag_topic(topic_id, article_ids)
            logger.info("Topic '%s': fetched %d articles", topic_id, len(articles))


async def refresh_all() -> None:
    """Full refresh cycle — called on startup and every REFRESH_INTERVAL_MINUTES."""
    global _top_stories_cache, _last_refresh

    logger.info("=== Refresh started ===")

    # 1. Core categories
    core_articles = await fetch_all_categories()
    new_core = await store.upsert_articles(core_articles)
    logger.info("Core categories: %d new articles added", new_core)

    # 2. Default built-in topics (if any configured in config.py)
    for topic in DEFAULT_CUSTOM_TOPICS:
        topic_articles = await fetch_topic_feeds(topic)
        if topic_articles:
            await store.upsert_articles(topic_articles)
            await store.tag_topic(topic["id"], [a.id for a in topic_articles])

    # 3. User-created custom topics
    await _fetch_custom_topics()

    # 4. Prune old articles
    pruned = await store.prune_old_articles()
    if pruned:
        logger.info("Pruned %d old articles", pruned)

    # 5. Developing stories AI analysis
    all_articles = store.get_all_articles(limit_per_category=20)
    developing = await identify_developing_stories(all_articles)
    await store.set_developing_stories(developing)

    # 6. Top 3 stories from last 6 hours (for landing hero)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
    all_flat = [a for articles in all_articles.values() for a in articles]
    recent = [
        a for a in all_flat
        if (a.published if a.published.tzinfo else a.published.replace(tzinfo=timezone.utc)) >= cutoff
    ]
    top3 = await pick_top_stories(recent, n=3)
    _top_stories_cache = [a.to_dict() for a in top3]

    # 7. Significance check — scan fresh articles for notification-worthy stories
    if new_core > 0:
        significant = await detect_significant_stories(core_articles)
        for item in significant:
            alert = Alert(
                id=item.get("article_id", "") + "_alert",
                headline=item.get("headline", ""),
                reason=item.get("reason", ""),
                severity=item.get("severity", "medium"),
                category=item.get("category", "general"),
                article_id=item.get("article_id"),
                url=item.get("url"),
                source=item.get("source"),
            )
            await alert_bus.publish(alert)

    _last_refresh = datetime.now(timezone.utc)
    logger.info("=== Refresh complete. Stats: %s ===", store.stats())


async def run_followup_check() -> None:
    """Daily follow-up check — called by scheduler at FOLLOWUP_CHECK_HOUR_UTC."""
    count = await check_all_followups(follow_up_store)
    logger.info("Daily follow-up check done: %d stories updated", count)


def start_scheduler() -> None:
    # Feed refresh — every REFRESH_INTERVAL_MINUTES
    scheduler.add_job(
        refresh_all,
        trigger="interval",
        minutes=REFRESH_INTERVAL_MINUTES,
        id="refresh_all",
        replace_existing=True,
    )
    # Follow-up story check — daily at configured UTC hour
    scheduler.add_job(
        run_followup_check,
        trigger="cron",
        hour=FOLLOWUP_CHECK_HOUR_UTC,
        minute=0,
        id="followup_check",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "Scheduler started — refresh every %d min, follow-up checks daily at %02d:00 UTC",
        REFRESH_INTERVAL_MINUTES,
        FOLLOWUP_CHECK_HOUR_UTC,
    )
