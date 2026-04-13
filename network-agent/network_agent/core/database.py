"""Database engine, session factory, and table initialisation."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlmodel import Session, SQLModel, create_engine

from network_agent.core import config

# Import models so SQLModel registers them before create_all
from network_agent.models.people import Person  # noqa: F401
from network_agent.models.actions import Action  # noqa: F401
from network_agent.models.sources import Source  # noqa: F401

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        db_url = config.get_database_url()
        connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
        _engine = create_engine(db_url, echo=False, connect_args=connect_args)
    return _engine


def init_db() -> None:
    """Create all tables (idempotent)."""
    SQLModel.metadata.create_all(get_engine())


@contextmanager
def get_session() -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        yield session
