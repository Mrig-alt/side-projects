"""
Follow-up story tracker.

When a user clicks "Follow Up" on any article or developing story, it is saved
here. A daily scheduler job calls Perplexity to check for new developments on
each tracked story and stores the results as updates.

The user sees:
  - A "Follow-ups" panel with all tracked stories
  - An unread update count badge on the tab
  - Each story card showing its update history
  - Mark-as-read on open
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import persistence
from perplexity import check_story_updates

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class StoryUpdate:
    summary: str
    found_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_read: bool = False

    def to_dict(self) -> dict:
        return {
            "summary": self.summary,
            "found_at": self.found_at.isoformat(),
            "is_read": self.is_read,
        }


@dataclass
class FollowedStory:
    id: str                     # article id or developing story id
    headline: str
    url: str
    source: str
    category_id: str
    classification: str
    followed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    keywords: list[str] = field(default_factory=list)
    updates: list[StoryUpdate] = field(default_factory=list)
    last_checked: Optional[datetime] = None

    @property
    def unread_count(self) -> int:
        return sum(1 for u in self.updates if not u.is_read)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "headline": self.headline,
            "url": self.url,
            "source": self.source,
            "category_id": self.category_id,
            "classification": self.classification,
            "followed_at": self.followed_at.isoformat(),
            "keywords": self.keywords,
            "unread_count": self.unread_count,
            "updates": [u.to_dict() for u in self.updates],
            "last_checked": self.last_checked.isoformat() if self.last_checked else None,
        }


# ---------------------------------------------------------------------------
# Follow-up store
# ---------------------------------------------------------------------------

class FollowUpStore:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._stories: dict[str, FollowedStory] = {}

    async def follow(self, story: FollowedStory) -> bool:
        """Add a story to follow. Returns False if already followed."""
        async with self._lock:
            if story.id in self._stories:
                return False
            self._stories[story.id] = story
            logger.info("Now following: %s", story.headline[:60])
        await persistence.save_followed_story(story)
        return True

    async def unfollow(self, story_id: str) -> bool:
        async with self._lock:
            if story_id not in self._stories:
                return False
            del self._stories[story_id]
        await persistence.delete_followed_story(story_id)
        return True

    def get(self, story_id: str) -> Optional[FollowedStory]:
        return self._stories.get(story_id)

    def list_all(self) -> list[FollowedStory]:
        return sorted(self._stories.values(), key=lambda s: s.followed_at, reverse=True)

    def total_unread(self) -> int:
        return sum(s.unread_count for s in self._stories.values())

    async def add_update(self, story_id: str, summary: str) -> bool:
        now = datetime.now(timezone.utc)
        async with self._lock:
            story = self._stories.get(story_id)
            if not story:
                return False
            update = StoryUpdate(summary=summary, found_at=now)
            story.updates.append(update)
            story.last_checked = now
        await persistence.save_story_update(story_id, summary, now, False)
        await persistence.update_story_last_checked(story_id, now)
        return True

    async def mark_read(self, story_id: str) -> bool:
        async with self._lock:
            story = self._stories.get(story_id)
            if not story:
                return False
            for update in story.updates:
                update.is_read = True
        await persistence.mark_story_updates_read(story_id)
        return True

    async def set_last_checked(self, story_id: str) -> None:
        now = datetime.now(timezone.utc)
        async with self._lock:
            story = self._stories.get(story_id)
            if story:
                story.last_checked = now
        await persistence.update_story_last_checked(story_id, now)

    async def load_from_db(self) -> None:
        """Restore followed stories and their updates from SQLite on startup."""
        rows = await persistence.load_followed_stories()
        for row in rows:
            followed_at = datetime.fromisoformat(row["followed_at"])
            if followed_at.tzinfo is None:
                followed_at = followed_at.replace(tzinfo=timezone.utc)

            last_checked = None
            if row.get("last_checked"):
                last_checked = datetime.fromisoformat(row["last_checked"])
                if last_checked.tzinfo is None:
                    last_checked = last_checked.replace(tzinfo=timezone.utc)

            updates = []
            for u in row.get("updates", []):
                found_at = datetime.fromisoformat(u["found_at"])
                if found_at.tzinfo is None:
                    found_at = found_at.replace(tzinfo=timezone.utc)
                updates.append(StoryUpdate(
                    summary=u["summary"],
                    found_at=found_at,
                    is_read=u["is_read"],
                ))

            story = FollowedStory(
                id=row["id"],
                headline=row["headline"],
                url=row["url"],
                source=row["source"],
                category_id=row["category_id"],
                classification=row["classification"],
                followed_at=followed_at,
                keywords=row["keywords"],
                updates=updates,
                last_checked=last_checked,
            )
            self._stories[story.id] = story
        if rows:
            logger.info("Loaded %d followed stories from DB", len(rows))


# ---------------------------------------------------------------------------
# Daily check logic
# ---------------------------------------------------------------------------

async def _check_single_story(story: FollowedStory, store: FollowUpStore) -> None:
    """Run Perplexity update check for one followed story."""
    update_text = await check_story_updates(
        headline=story.headline,
        keywords=story.keywords,
        followed_since_iso=story.followed_at.strftime("%Y-%m-%d"),
    )
    if update_text:
        await store.add_update(story.id, update_text)
    else:
        await store.set_last_checked(story.id)


async def check_all_followups(store: FollowUpStore) -> int:
    """
    Called by the daily scheduler. Checks every followed story for updates.
    Returns count of stories that received new updates.
    """
    stories = store.list_all()
    if not stories:
        logger.info("No followed stories to check.")
        return 0

    logger.info("Checking updates for %d followed stories...", len(stories))

    # Check up to 5 concurrently to avoid hammering the API
    sem = asyncio.Semaphore(5)

    async def bounded_check(story: FollowedStory) -> None:
        async with sem:
            await _check_single_story(story, store)

    before_counts = {s.id: s.unread_count for s in stories}
    await asyncio.gather(*[bounded_check(s) for s in stories], return_exceptions=True)

    updated = sum(
        1 for s in stories
        if s.unread_count > before_counts.get(s.id, 0)
    )
    logger.info("Follow-up check complete: %d stories with new updates", updated)
    return updated


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

follow_up_store = FollowUpStore()
