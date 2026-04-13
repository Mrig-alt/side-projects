"""
Real-time alert system — pub/sub bus for significant story notifications.

On each refresh cycle, newly fetched articles are scanned by Claude for:
  - Breaking significance (major geopolitical event, market crash, etc.)
  - High controversy (politically charged, widely contested events)
  - Operational impact (supply chain disruption, sanctions, regulatory shock)

Alerts are broadcast to all connected frontend clients via Server-Sent Events (SSE).
The frontend shows OS-level browser notifications + in-app toasts.
"""

from __future__ import annotations

import asyncio
import json as _json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import persistence

_VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
_VAPID_EMAIL = os.getenv("VAPID_EMAIL", "mailto:admin@localhost")

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Alert model
# ---------------------------------------------------------------------------

@dataclass
class Alert:
    id: str
    headline: str
    reason: str                  # 1-sentence explanation of why this matters now
    severity: str                # "high" | "medium"
    category: str                # political | financial | supply_chain | breaking | controversial
    article_id: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "headline": self.headline,
            "reason": self.reason,
            "severity": self.severity,
            "category": self.category,
            "article_id": self.article_id,
            "url": self.url,
            "source": self.source,
            "created_at": self.created_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# Alert bus — fan-out to all SSE subscribers
# ---------------------------------------------------------------------------

class AlertBus:
    def __init__(self) -> None:
        self._queues: list[asyncio.Queue] = []
        self._recent: list[Alert] = []
        self._seen_ids: set[str] = set()      # dedup across refresh cycles
        self._max_recent = 50

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._queues.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        try:
            self._queues.remove(q)
        except ValueError:
            pass

    async def publish(self, alert: Alert) -> None:
        if alert.id in self._seen_ids:
            return
        self._seen_ids.add(alert.id)
        self._recent.append(alert)
        if len(self._recent) > self._max_recent:
            self._recent = self._recent[-self._max_recent:]
        logger.info(
            "ALERT [%s] %s — %s",
            alert.severity.upper(),
            alert.headline[:60],
            alert.reason[:80],
        )
        for q in list(self._queues):
            try:
                q.put_nowait(alert)
            except asyncio.QueueFull:
                pass
        await persistence.save_alert(alert)
        # Fire-and-forget — don't block SSE delivery waiting for push
        asyncio.create_task(self._send_web_push(alert))

    async def _send_web_push(self, alert: "Alert") -> None:
        """Send Web Push notifications to all subscribed devices."""
        if not _VAPID_PRIVATE_KEY:
            return
        subscriptions = await persistence.load_push_subscriptions()
        if not subscriptions:
            return

        payload = _json.dumps({
            "id": alert.id,
            "headline": alert.headline,
            "reason": alert.reason,
            "severity": alert.severity,
            "url": alert.url or "/",
            "article_id": alert.article_id,
        })

        expired_endpoints: list[str] = []

        def _send_one(sub_info: dict) -> Optional[str]:
            try:
                from pywebpush import WebPushException, webpush
                webpush(
                    subscription_info=sub_info,
                    data=payload,
                    vapid_private_key=_VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": _VAPID_EMAIL},
                    content_encoding="aes128gcm",
                    ttl=3600,
                )
            except Exception as exc:
                resp = getattr(exc, "response", None)
                if resp is not None and resp.status_code in (404, 410):
                    return sub_info.get("endpoint")  # expired — caller will delete
                logger.warning("Web push send failed: %s", exc)
            return None

        loop = asyncio.get_event_loop()
        for sub in subscriptions:
            expired = await loop.run_in_executor(None, _send_one, sub)
            if expired:
                expired_endpoints.append(expired)

        for ep in expired_endpoints:
            await persistence.delete_push_subscription(ep)

    async def load_from_db(self) -> None:
        """Load recent alerts from SQLite on startup (for SSE replay to new clients)."""
        rows = await persistence.load_alerts(limit=self._max_recent)
        for row in rows:
            created_at = datetime.fromisoformat(row["created_at"])
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            alert = Alert(
                id=row["id"],
                headline=row["headline"],
                reason=row["reason"],
                severity=row["severity"],
                category=row["category"],
                article_id=row.get("article_id"),
                url=row.get("url"),
                source=row.get("source"),
                created_at=created_at,
            )
            self._seen_ids.add(alert.id)
            self._recent.append(alert)
        # Keep chronological order (load_alerts returns DESC)
        self._recent.sort(key=lambda a: a.created_at)
        if rows:
            logger.info("Loaded %d recent alerts from DB", len(rows))

    def get_recent(self, limit: int = 20) -> list[Alert]:
        return list(reversed(self._recent[-limit:]))

    def unread_count_since(self, since_iso: Optional[str]) -> int:
        if not since_iso:
            return len(self._recent)
        try:
            since = datetime.fromisoformat(since_iso)
        except ValueError:
            return 0
        return sum(
            1 for a in self._recent
            if a.created_at > since
        )


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

alert_bus = AlertBus()
