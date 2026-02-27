"""People data model."""
from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Classification(str, enum.Enum):
    Professional = "Professional"
    Educational = "Educational"
    Personal = "Personal"


class Status(str, enum.Enum):
    Active = "Active"
    Dormant = "Dormant"
    NeedsWork = "Needs Work"
    DoNotPursue = "Do Not Pursue"


class Person(SQLModel, table=True):
    __tablename__ = "people"

    person_id: Optional[int] = Field(default=None, primary_key=True)
    full_name: str = Field(index=True)

    # Classification stored as comma-separated values to support multiple
    classification: Optional[str] = Field(default=None)  # e.g. "Professional,Educational"
    subgroup: Optional[str] = Field(default=None)
    relationship_type: Optional[str] = Field(default=None)
    company_or_school: Optional[str] = Field(default=None, index=True)
    role_or_program: Optional[str] = Field(default=None)
    location: Optional[str] = Field(default=None)

    email: Optional[str] = Field(default=None, index=True)
    linkedin_url: Optional[str] = Field(default=None, index=True)

    # Scoring 1–5
    tie_strength: int = Field(default=3, ge=1, le=5)
    alignment: int = Field(default=3, ge=1, le=5)
    influence: int = Field(default=3, ge=1, le=5)

    last_interaction_date: Optional[date] = Field(default=None)
    status: str = Field(default="Active", index=True)
    next_action: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)
    tags: Optional[str] = Field(default=None)  # comma-separated

    introduced_by_person_id: Optional[int] = Field(
        default=None, foreign_key="people.person_id"
    )

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def classification_list(self) -> list[str]:
        if not self.classification:
            return []
        return [c.strip() for c in self.classification.split(",") if c.strip()]

    def tags_list(self) -> list[str]:
        if not self.tags:
            return []
        return [t.strip() for t in self.tags.split(",") if t.strip()]

    def display_dict(self) -> dict:
        return {
            "id": self.person_id,
            "name": self.full_name,
            "classification": self.classification or "",
            "status": self.status,
            "company": self.company_or_school or "",
            "role": self.role_or_program or "",
            "location": self.location or "",
            "tie_strength": self.tie_strength,
            "alignment": self.alignment,
            "influence": self.influence,
            "last_interaction": str(self.last_interaction_date or ""),
            "next_action": self.next_action or "",
            "tags": self.tags or "",
            "email": self.email or "",
            "linkedin_url": self.linkedin_url or "",
        }
