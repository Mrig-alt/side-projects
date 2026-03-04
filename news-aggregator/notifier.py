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
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

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
