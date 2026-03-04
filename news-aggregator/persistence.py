"""
SQLite persistence layer — durable storage for user-created data.

Persists across restarts:
  - Custom topic watchlists
  - Followed stories + their Perplexity update history
  - Recent alerts (last 200)

Articles themselves are intentionally ephemeral — they refresh every 30 minutes
from RSS feeds and don't need to survive a restart.

Database file: $DATABASE_PATH (default: ./data/feed.db)
WAL mode enabled for safe concurrent reads.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import aiosqlite

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "data", "feed.db"))

_CREATE_TABLES = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS custom_topics (
    id          TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    icon        TEXT NOT NULL DEFAULT '📌',
    keywords    TEXT NOT NULL DEFAULT '[]',
    feed_urls   TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS followed_stories (
    id              TEXT PRIMARY KEY,
    headline        TEXT NOT NULL,
    url             TEXT NOT NULL,
    source          TEXT NOT NULL,
    category_id     TEXT NOT NULL,
    classification  TEXT NOT NULL,
    followed_at     TEXT NOT NULL,
    keywords        TEXT NOT NULL DEFAULT '[]',
    last_checked    TEXT
);

CREATE TABLE IF NOT EXISTS story_updates (
    rowid       INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id    TEXT NOT NULL,
    summary     TEXT NOT NULL,
    found_at    TEXT NOT NULL,
    is_read     INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (story_id) REFERENCES followed_stories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
    id          TEXT PRIMARY KEY,
    headline    TEXT NOT NULL,
    reason      TEXT NOT NULL,
    severity    TEXT NOT NULL,
    category    TEXT NOT NULL,
    article_id  TEXT,
    url         TEXT,
    source      TEXT,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint    TEXT PRIMARY KEY,
    subscription TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
"""


async def init_db() -> None:
    """Create the database file and tables if they don't exist."""
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(_CREATE_TABLES)
        await db.commit()
    logger.info("Database ready: %s", DB_PATH)


# ---------------------------------------------------------------------------
# Custom topics
# ---------------------------------------------------------------------------

async def load_custom_topics() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, label, icon, keywords, feed_urls FROM custom_topics ORDER BY created_at"
        ) as cursor:
            rows = await cursor.fetchall()
    result = []
    for row in rows:
        result.append({
            "id": row["id"],
            "label": row["label"],
            "icon": row["icon"],
            "keywords": json.loads(row["keywords"]),
            "feed_urls": json.loads(row["feed_urls"]),
        })
    return result


async def save_topic(topic: dict) -> None:
    feed_urls = [
        f.url if hasattr(f, "url") else f
        for f in topic.get("feeds", topic.get("feed_urls", []))
    ]
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT OR REPLACE INTO custom_topics (id, label, icon, keywords, feed_urls, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                topic["id"],
                topic["label"],
                topic.get("icon", "📌"),
                json.dumps(topic.get("keywords", [])),
                json.dumps(feed_urls),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        await db.commit()


async def delete_topic(topic_id: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM custom_topics WHERE id = ?", (topic_id,))
        await db.commit()


# ---------------------------------------------------------------------------
# Followed stories
# ---------------------------------------------------------------------------

async def load_followed_stories() -> list[dict]:
    """Returns list of dicts with keys matching FollowedStory fields + 'updates' list."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM followed_stories ORDER BY followed_at DESC"
        ) as cursor:
            story_rows = await cursor.fetchall()

        stories = []
        for row in story_rows:
            async with db.execute(
                "SELECT summary, found_at, is_read FROM story_updates WHERE story_id = ? ORDER BY rowid",
                (row["id"],),
            ) as ucursor:
                update_rows = await ucursor.fetchall()

            stories.append({
                "id": row["id"],
                "headline": row["headline"],
                "url": row["url"],
                "source": row["source"],
                "category_id": row["category_id"],
                "classification": row["classification"],
                "followed_at": row["followed_at"],
                "keywords": json.loads(row["keywords"]),
                "last_checked": row["last_checked"],
                "updates": [
                    {
                        "summary": u["summary"],
                        "found_at": u["found_at"],
                        "is_read": bool(u["is_read"]),
                    }
                    for u in update_rows
                ],
            })
    return stories


async def save_followed_story(story) -> None:
    """Persist a FollowedStory dataclass instance."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT OR IGNORE INTO followed_stories
               (id, headline, url, source, category_id, classification, followed_at, keywords, last_checked)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                story.id,
                story.headline,
                story.url,
                story.source,
                story.category_id,
                story.classification,
                story.followed_at.isoformat(),
                json.dumps(story.keywords),
                story.last_checked.isoformat() if story.last_checked else None,
            ),
        )
        await db.commit()


async def delete_followed_story(story_id: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM followed_stories WHERE id = ?", (story_id,))
        await db.commit()


async def save_story_update(story_id: str, summary: str, found_at: datetime, is_read: bool) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO story_updates (story_id, summary, found_at, is_read) VALUES (?, ?, ?, ?)",
            (story_id, summary, found_at.isoformat(), int(is_read)),
        )
        await db.commit()


async def update_story_last_checked(story_id: str, last_checked: datetime) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE followed_stories SET last_checked = ? WHERE id = ?",
            (last_checked.isoformat(), story_id),
        )
        await db.commit()


async def mark_story_updates_read(story_id: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE story_updates SET is_read = 1 WHERE story_id = ?",
            (story_id,),
        )
        await db.commit()


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

async def load_alerts(limit: int = 200) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cursor:
            rows = await cursor.fetchall()
    return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Push subscriptions
# ---------------------------------------------------------------------------

async def load_push_subscriptions() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT subscription FROM push_subscriptions") as cursor:
            rows = await cursor.fetchall()
    return [json.loads(row["subscription"]) for row in rows]


async def save_push_subscription(subscription: dict) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT OR REPLACE INTO push_subscriptions (endpoint, subscription, created_at)
               VALUES (?, ?, ?)""",
            (
                subscription["endpoint"],
                json.dumps(subscription),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        await db.commit()


async def delete_push_subscription(endpoint: str) -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,))
        await db.commit()


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

async def save_alert(alert) -> None:
    """Persist an Alert dataclass instance."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT OR IGNORE INTO alerts
               (id, headline, reason, severity, category, article_id, url, source, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                alert.id,
                alert.headline,
                alert.reason,
                alert.severity,
                alert.category,
                alert.article_id,
                alert.url,
                alert.source,
                alert.created_at.isoformat(),
            ),
        )
        # Keep only last 200 alerts
        await db.execute(
            """DELETE FROM alerts WHERE id NOT IN (
               SELECT id FROM alerts ORDER BY created_at DESC LIMIT 200)"""
        )
        await db.commit()
