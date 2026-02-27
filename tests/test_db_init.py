"""Tests for database initialisation."""
from __future__ import annotations

import pytest
from sqlmodel import SQLModel, inspect


def test_tables_created(engine):
    """All expected tables exist after create_all."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert "people" in tables
    assert "actions" in tables
    assert "sources" in tables


def test_people_columns(engine):
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("people")}
    required = {
        "person_id", "full_name", "classification", "company_or_school",
        "role_or_program", "email", "linkedin_url", "tie_strength",
        "alignment", "influence", "status", "tags", "created_at", "updated_at",
    }
    assert required.issubset(cols)


def test_actions_columns(engine):
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("actions")}
    required = {
        "action_id", "action_timestamp", "action_type", "platform",
        "target_person_id", "target_name_raw", "context", "outcome",
        "follow_up_date", "metadata_json", "created_at",
    }
    assert required.issubset(cols)


def test_sources_columns(engine):
    inspector = inspect(engine)
    cols = {c["name"] for c in inspector.get_columns("sources")}
    required = {"source_id", "person_id", "url", "retrieved_at", "content_hash"}
    assert required.issubset(cols)


def test_init_db_idempotent(engine):
    """Calling init_db twice should not raise."""
    from network_agent.core.database import init_db
    init_db()
    init_db()  # second call – must not fail
