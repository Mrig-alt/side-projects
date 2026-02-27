"""Tests for action logging and identity resolution."""
from __future__ import annotations

from datetime import date, datetime

import pytest
from sqlmodel import select

from network_agent.core.linking import (
    find_person_by_email,
    find_person_by_url,
    fuzzy_find_person,
    resolve_target,
)
from network_agent.models.actions import Action
from network_agent.models.people import Person


def _person(session, **kwargs) -> Person:
    defaults = dict(
        full_name="Test Person",
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


# ---- URL matching ----

def test_find_by_url_exact(session):
    p = _person(session, full_name="Alice", linkedin_url="https://linkedin.com/in/alice")
    found = find_person_by_url(session, "https://linkedin.com/in/alice")
    assert found is not None
    assert found.person_id == p.person_id


def test_find_by_url_trailing_slash(session):
    p = _person(session, full_name="Alice", linkedin_url="https://linkedin.com/in/alice/")
    found = find_person_by_url(session, "https://linkedin.com/in/alice")
    assert found is not None


def test_find_by_url_no_match(session):
    _person(session, full_name="Alice", linkedin_url="https://linkedin.com/in/alice")
    found = find_person_by_url(session, "https://linkedin.com/in/bob")
    assert found is None


# ---- Email matching ----

def test_find_by_email(session):
    p = _person(session, full_name="Bob", email="bob@example.com")
    found = find_person_by_email(session, "bob@example.com")
    assert found is not None
    assert found.person_id == p.person_id


def test_find_by_email_no_match(session):
    found = find_person_by_email(session, "nobody@example.com")
    assert found is None


# ---- Fuzzy name matching ----

def test_fuzzy_exact_name(session):
    p = _person(session, full_name="Carol Chen")
    results = fuzzy_find_person(session, "Carol Chen")
    assert any(r.person_id == p.person_id for r, _ in results)


def test_fuzzy_partial_name(session):
    p = _person(session, full_name="David Ramirez")
    results = fuzzy_find_person(session, "David Ramires")  # typo
    assert any(r.person_id == p.person_id for r, _ in results)


def test_fuzzy_company_bonus(session):
    p1 = _person(session, full_name="Alex Kim", company_or_school="Google")
    p2 = _person(session, full_name="Alex Kim", company_or_school="Meta")
    results = fuzzy_find_person(session, "Alex Kim", company="Google")
    # p1 should rank higher due to company bonus
    assert results[0][0].person_id == p1.person_id


def test_fuzzy_no_match_below_threshold(session):
    _person(session, full_name="Zara Windsor")
    results = fuzzy_find_person(session, "John Doe", threshold=90)
    assert len(results) == 0


# ---- resolve_target ----

def test_resolve_by_url(session):
    p = _person(session, full_name="Eve", linkedin_url="https://linkedin.com/in/eve")
    pid, warn = resolve_target(session, linkedin_url="https://linkedin.com/in/eve")
    assert pid == p.person_id
    assert warn is None


def test_resolve_by_email(session):
    p = _person(session, full_name="Frank", email="frank@corp.com")
    pid, warn = resolve_target(session, email="frank@corp.com")
    assert pid == p.person_id
    assert warn is None


def test_resolve_no_match(session):
    pid, warn = resolve_target(session, name="Ghost Person")
    assert pid is None
    assert warn is not None


def test_resolve_ambiguous(session):
    _person(session, full_name="Grace Ho")
    _person(session, full_name="Grace Ho")  # duplicate name
    pid, warn = resolve_target(session, name="Grace Ho")
    # Two equally scored matches → ambiguous → no auto-link
    assert pid is None or warn is not None  # either no match or a warning


# ---- Action CRUD ----

def test_log_action_stores_correctly(session):
    p = _person(session, full_name="Hannah")
    action = Action(
        action_type="message_sent",
        platform="LinkedIn",
        target_person_id=p.person_id,
        context="Follow-up from conference",
        outcome="Replied",
        follow_up_date=date(2026, 3, 1),
    )
    session.add(action)
    session.commit()
    session.refresh(action)

    assert action.action_id is not None
    assert action.target_person_id == p.person_id
    assert action.follow_up_date == date(2026, 3, 1)
    assert action.platform == "LinkedIn"


def test_action_unlinked_stores_name(session):
    action = Action(
        action_type="profile_view",
        target_name_raw="Unknown Person",
        target_url="https://linkedin.com/in/unknown",
    )
    session.add(action)
    session.commit()
    session.refresh(action)

    assert action.target_person_id is None
    assert action.target_name_raw == "Unknown Person"


def test_action_display_dict(session):
    action = Action(action_type="comment", platform="LinkedIn")
    session.add(action)
    session.commit()
    session.refresh(action)
    d = action.display_dict()
    for key in ["id", "timestamp", "type", "platform", "context", "outcome"]:
        assert key in d
