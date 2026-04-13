"""Pytest fixtures for network_agent tests."""
from __future__ import annotations

import os
import pytest
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool


@pytest.fixture()
def engine():
    """In-memory SQLite engine for testing."""
    _engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(_engine)
    return _engine


@pytest.fixture()
def session(engine):
    with Session(engine) as s:
        yield s


@pytest.fixture(autouse=True)
def patch_db_engine(engine, monkeypatch):
    """Redirect all get_engine() calls to the in-memory test engine."""
    import network_agent.core.database as db_module
    monkeypatch.setattr(db_module, "_engine", engine)
