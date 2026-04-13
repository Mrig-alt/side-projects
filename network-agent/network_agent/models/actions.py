"""Actions data model – the core movement log."""
from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class ActionType(str, enum.Enum):
    profile_view = "profile_view"
    search = "search"
    follow = "follow"
    connect_request_sent = "connect_request_sent"
    connect_request_accepted = "connect_request_accepted"
    message_sent = "message_sent"
    message_received = "message_received"
    comment = "comment"
    like = "like"
    post = "post"
    share = "share"
    group_join = "group_join"
    event_rsvp = "event_rsvp"
    other = "other"


ACTION_TYPE_VALUES = [e.value for e in ActionType]


class Action(SQLModel, table=True):
    __tablename__ = "actions"

    action_id: Optional[int] = Field(default=None, primary_key=True)
    action_timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    action_type: str = Field(index=True)  # ActionType value or freeform
    platform: str = Field(default="LinkedIn")

    target_person_id: Optional[int] = Field(
        default=None, foreign_key="people.person_id", index=True
    )
    target_name_raw: Optional[str] = Field(default=None)
    target_url: Optional[str] = Field(default=None)

    context: Optional[str] = Field(default=None)
    outcome: Optional[str] = Field(default=None)
    follow_up_date: Optional[date] = Field(default=None, index=True)
    metadata_json: Optional[str] = Field(default=None)  # JSON string

    created_at: datetime = Field(default_factory=datetime.utcnow)

    def display_dict(self) -> dict:
        return {
            "id": self.action_id,
            "timestamp": str(self.action_timestamp)[:19],
            "type": self.action_type,
            "platform": self.platform,
            "target_person_id": self.target_person_id or "",
            "target_name": self.target_name_raw or "",
            "target_url": self.target_url or "",
            "context": (self.context or "")[:60],
            "outcome": self.outcome or "",
            "follow_up": str(self.follow_up_date or ""),
        }
