"""Tests for people CRUD via CLI helpers."""
from __future__ import annotations

from datetime import datetime

import pytest
from sqlmodel import select

from network_agent.core.database import get_session
from network_agent.models.people import Person


def _add(session, **kwargs) -> Person:
    defaults = dict(
        full_name="Test Person",
        classification="Professional",
        tie_strength=3,
        alignment=3,
        influence=3,
        status="Active",
    )
    defaults.update(kwargs)
    p = Person(**defaults)
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


def test_add_person_basic(session):
    p = _add(session, full_name="Alice Nguyen", company_or_school="Acme")
    assert p.person_id is not None
    assert p.full_name == "Alice Nguyen"
    assert p.company_or_school == "Acme"


def test_add_person_defaults(session):
    p = _add(session, full_name="Bob Lee")
    assert p.tie_strength == 3
    assert p.alignment == 3
    assert p.status == "Active"


def test_person_tags_list(session):
    p = _add(session, full_name="Carol", tags="ml,product,vc")
    assert p.tags_list() == ["ml", "product", "vc"]


def test_person_classification_list(session):
    p = _add(session, full_name="Dana", classification="Professional,Educational")
    assert set(p.classification_list()) == {"Professional", "Educational"}


def test_list_people_filter_status(session):
    _add(session, full_name="Active Person", status="Active")
    _add(session, full_name="Dormant Person", status="Dormant")
    actives = session.exec(select(Person).where(Person.status == "Active")).all()
    assert all(p.status == "Active" for p in actives)
    assert any(p.full_name == "Active Person" for p in actives)


def test_person_update(session):
    p = _add(session, full_name="Eve")
    p.role_or_program = "PM"
    p.updated_at = datetime.utcnow()
    session.add(p)
    session.commit()
    session.refresh(p)
    assert p.role_or_program == "PM"


def test_display_dict_keys(session):
    p = _add(session, full_name="Frank", email="frank@example.com")
    d = p.display_dict()
    for key in ["id", "name", "classification", "status", "company", "role",
                "location", "tie_strength", "alignment", "influence",
                "last_interaction", "next_action", "tags", "email", "linkedin_url"]:
        assert key in d
