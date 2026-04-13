"""Sources table – provenance for scraped content."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Source(SQLModel, table=True):
    __tablename__ = "sources"

    source_id: Optional[int] = Field(default=None, primary_key=True)
    person_id: int = Field(foreign_key="people.person_id", index=True)
    url: str
    retrieved_at: datetime = Field(default_factory=datetime.utcnow)
    content_hash: Optional[str] = Field(default=None)  # SHA256 of raw text
    raw_text_path: Optional[str] = Field(default=None)
    parsed_json: Optional[str] = Field(default=None)  # JSON string of extracted fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
