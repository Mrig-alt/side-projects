"""Tests for duplicate detection in reconcile logic."""
from __future__ import annotations

import pytest
from rapidfuzz import fuzz
from sqlmodel import select

from network_agent.core.linking import fuzzy_find_person
from network_agent.models.people import Person


def _person(session, **kwargs) -> Person:
    defaults = dict(tie_strength=3, alignment=3, influence=3, status="Active")
    defaults.update(kwargs)
    p = Person(**defaults)
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


def test_no_duplicates_detected(session):
    _person(session, full_name="Alice Smith")
    _person(session, full_name="Bob Jones")
    _person(session, full_name="Carol Wu")

    people = session.exec(select(Person)).all()
    dupes = []
    seen = set()
    THRESHOLD = 85
    for i, p1 in enumerate(people):
        for p2 in people[i + 1:]:
            score = fuzz.WRatio(p1.full_name.lower(), p2.full_name.lower())
            if score >= THRESHOLD:
                key = (min(p1.person_id, p2.person_id), max(p1.person_id, p2.person_id))
                if key not in seen:
                    seen.add(key)
                    dupes.append((p1, p2, score))
    assert dupes == []


def test_duplicates_detected(session):
    p1 = _person(session, full_name="John Doe")
    p2 = _person(session, full_name="Jon Doe")  # near-duplicate

    THRESHOLD = 80
    score = fuzz.WRatio("john doe", "jon doe")
    assert score >= THRESHOLD, f"Expected match; got score={score}"

    results = fuzzy_find_person(session, "John Doe", threshold=THRESHOLD)
    ids = [r.person_id for r, _ in results]
    assert p1.person_id in ids


def test_action_repointing_on_merge(session):
    """After merging, actions should point to keeper."""
    from network_agent.models.actions import Action
    from sqlmodel import update as sql_update

    keep = _person(session, full_name="Evan Lu")
    discard = _person(session, full_name="Evan Lu")

    # Log an action against discard
    action = Action(action_type="message_sent", target_person_id=discard.person_id)
    session.add(action)
    session.commit()
    session.refresh(action)

    # Simulate merge: repoint actions
    session.exec(
        sql_update(Action)
        .where(Action.target_person_id == discard.person_id)
        .values(target_person_id=keep.person_id)
    )
    session.delete(discard)
    session.commit()

    updated = session.get(Action, action.action_id)
    assert updated.target_person_id == keep.person_id

    remaining = session.exec(select(Person)).all()
    assert all(p.person_id != discard.person_id for p in remaining)
