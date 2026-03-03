"""
In-memory article store with a lightweight search index.
Articles are deduplicated by URL and pruned after MAX_ARTICLES_AGE_HOURS.
Thread-safe via asyncio.Lock — all mutations happen inside the lock.
"""

from __future__ import annotations

import asyncio
import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from config import MAX_ARTICLES_AGE_HOURS


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class Article:
    id: str                          # sha256(url)[:16]
    title: str
    url: str
    source: str                      # feed name
    category_id: str                 # e.g. "india_political"
    published: datetime
    summary: str = ""                # RSS description/excerpt
    ai_summary: Optional[str] = None
    is_premium: bool = False
    fetched_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def age_hours(self) -> float:
        now = datetime.now(timezone.utc)
        pub = self.published if self.published.tzinfo else self.published.replace(tzinfo=timezone.utc)
        return (now - pub).total_seconds() / 3600

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "url": self.url,
            "source": self.source,
            "category_id": self.category_id,
            "published": self.published.isoformat(),
            "summary": self.summary,
            "ai_summary": self.ai_summary,
            "is_premium": self.is_premium,
        }


@dataclass
class DevelopingStory:
    id: str
    headline: str
    description: str
    regions: list[str]
    article_ids: list[str]
    key_actors: list[str]
    what_to_watch: str
    generated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "headline": self.headline,
            "description": self.description,
            "regions": self.regions,
            "article_ids": self.article_ids,
            "key_actors": self.key_actors,
            "what_to_watch": self.what_to_watch,
            "generated_at": self.generated_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# Article ID helper
# ---------------------------------------------------------------------------

def make_article_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Lightweight search helper — matches query tokens against title + summary
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> set[str]:
    return set(re.sub(r"[^a-z0-9\s]", " ", text.lower()).split())


def article_matches(article: Article, query: str) -> bool:
    query_tokens = _tokenize(query)
    article_tokens = _tokenize(article.title + " " + article.summary)
    return bool(query_tokens & article_tokens)


# ---------------------------------------------------------------------------
# Store
# ---------------------------------------------------------------------------

class ArticleStore:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        # primary store: id → Article
        self._articles: dict[str, Article] = {}
        # category index: category_id → list of article ids (insertion order)
        self._by_category: dict[str, list[str]] = {}
        # custom topic index: topic_id → list of article ids
        self._by_topic: dict[str, list[str]] = {}
        # developing stories (latest AI analysis)
        self._developing: list[DevelopingStory] = []
        # custom topics persisted in memory (added via API)
        self._custom_topics: dict[str, dict] = {}

    # -----------------------------------------------------------------------
    # Write operations
    # -----------------------------------------------------------------------

    async def upsert_articles(self, articles: list[Article]) -> int:
        """Add new articles, skip duplicates. Returns count of new articles added."""
        added = 0
        async with self._lock:
            for art in articles:
                if art.id in self._articles:
                    continue
                self._articles[art.id] = art
                self._by_category.setdefault(art.category_id, []).append(art.id)
                added += 1
        return added

    async def set_ai_summary(self, article_id: str, summary: str) -> bool:
        async with self._lock:
            if article_id not in self._articles:
                return False
            self._articles[article_id].ai_summary = summary
            return True

    async def set_developing_stories(self, stories: list[DevelopingStory]) -> None:
        async with self._lock:
            self._developing = stories

    async def tag_topic(self, topic_id: str, article_ids: list[str]) -> None:
        async with self._lock:
            self._by_topic[topic_id] = article_ids

    async def upsert_custom_topic(self, topic: dict) -> None:
        async with self._lock:
            self._custom_topics[topic["id"]] = topic

    async def delete_custom_topic(self, topic_id: str) -> bool:
        async with self._lock:
            if topic_id not in self._custom_topics:
                return False
            del self._custom_topics[topic_id]
            self._by_topic.pop(topic_id, None)
            return True

    async def prune_old_articles(self) -> int:
        """Remove articles older than MAX_ARTICLES_AGE_HOURS. Returns count removed."""
        removed = 0
        async with self._lock:
            expired_ids = [
                aid for aid, art in self._articles.items()
                if art.age_hours() > MAX_ARTICLES_AGE_HOURS
            ]
            for aid in expired_ids:
                art = self._articles.pop(aid)
                cat_list = self._by_category.get(art.category_id, [])
                if aid in cat_list:
                    cat_list.remove(aid)
                removed += 1
        return removed

    # -----------------------------------------------------------------------
    # Read operations
    # -----------------------------------------------------------------------

    def get_article(self, article_id: str) -> Optional[Article]:
        return self._articles.get(article_id)

    def get_by_category(self, category_id: str, limit: int = 50) -> list[Article]:
        ids = self._by_category.get(category_id, [])
        articles = [self._articles[aid] for aid in ids if aid in self._articles]
        # sort newest first
        articles.sort(key=lambda a: a.published, reverse=True)
        return articles[:limit]

    def get_by_topic(self, topic_id: str, limit: int = 30) -> list[Article]:
        ids = self._by_topic.get(topic_id, [])
        articles = [self._articles[aid] for aid in ids if aid in self._articles]
        articles.sort(key=lambda a: a.published, reverse=True)
        return articles[:limit]

    def get_all_articles(self, limit_per_category: int = 20) -> dict[str, list[Article]]:
        result: dict[str, list[Article]] = {}
        for cat_id in self._by_category:
            result[cat_id] = self.get_by_category(cat_id, limit_per_category)
        return result

    def search(self, query: str, limit: int = 50) -> list[Article]:
        if not query.strip():
            return []
        matches = [
            art for art in self._articles.values()
            if article_matches(art, query)
        ]
        matches.sort(key=lambda a: a.published, reverse=True)
        return matches[:limit]

    def get_developing_stories(self) -> list[DevelopingStory]:
        return list(self._developing)

    def get_custom_topics(self) -> dict[str, dict]:
        return dict(self._custom_topics)

    def stats(self) -> dict:
        return {
            "total_articles": len(self._articles),
            "categories": {k: len(v) for k, v in self._by_category.items()},
            "custom_topics": len(self._custom_topics),
            "developing_stories": len(self._developing),
        }


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

store = ArticleStore()
