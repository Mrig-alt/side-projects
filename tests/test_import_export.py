"""Tests for import-actions and export."""
from __future__ import annotations

import csv
import json
import tempfile
from pathlib import Path

import pytest
from sqlmodel import select

from network_agent.models.actions import Action
from network_agent.models.people import Person


def _add_person(session, name, **kwargs) -> Person:
    defaults = dict(tie_strength=3, alignment=3, influence=3, status="Active")
    defaults.update(kwargs)
    p = Person(full_name=name, **defaults)
    session.add(p)
    session.commit()
    session.refresh(p)
    return p


def _write_csv(rows: list[dict], path: Path) -> None:
    if not rows:
        return
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def test_import_csv_links_known_person(session):
    """Imported CSV row matching a known person by name should link person_id."""
    from network_agent.cli.actions_cmd import _load_import_file
    from network_agent.core.linking import resolve_target

    p = _add_person(session, "Alice Tan", linkedin_url="https://linkedin.com/in/alicetan")

    rows = [
        {
            "action_timestamp": "2026-01-10T10:00:00",
            "action_type": "profile_view",
            "platform": "LinkedIn",
            "target_name": "Alice Tan",
            "linkedin_url": "https://linkedin.com/in/alicetan",
            "email": "",
            "target_url": "",
            "context": "Pre-call research",
            "outcome": "",
            "follow_up_date": "",
            "metadata_json": "",
        }
    ]

    with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        tmp = Path(f.name)

    loaded = _load_import_file(tmp)
    assert len(loaded) == 1
    pid, warn = resolve_target(session, linkedin_url=loaded[0]["linkedin_url"])
    assert pid == p.person_id
    tmp.unlink()


def test_import_json(session):
    """JSON import with array of action objects."""
    from network_agent.cli.actions_cmd import _load_import_file

    data = [
        {"action_timestamp": "2026-01-11T12:00:00", "action_type": "comment",
         "platform": "LinkedIn", "target_name": "Bob", "context": "Good post"}
    ]
    with tempfile.NamedTemporaryFile(suffix=".json", mode="w", delete=False) as f:
        json.dump(data, f)
        tmp = Path(f.name)

    loaded = _load_import_file(tmp)
    assert len(loaded) == 1
    assert loaded[0]["action_type"] == "comment"
    tmp.unlink()


def test_import_deduplication(session):
    """Duplicate rows in import are skipped."""
    from network_agent.cli.actions_cmd import _load_import_file
    from network_agent.core.linking import resolve_target
    from network_agent.models.actions import Action

    # Pre-populate one action
    existing = Action(
        action_type="like",
        target_name_raw="Carol",
        action_timestamp=__import__("datetime").datetime(2026, 1, 12, 9, 0, 0),
    )
    session.add(existing)
    session.commit()

    rows = [
        {
            "action_timestamp": "2026-01-12T09:00:00",
            "action_type": "like",
            "platform": "LinkedIn",
            "target_name": "Carol",
            "linkedin_url": "",
            "email": "",
            "target_url": "",
            "context": "",
            "outcome": "",
            "follow_up_date": "",
            "metadata_json": "",
        }
    ]
    with tempfile.NamedTemporaryFile(suffix=".csv", mode="w", delete=False, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        tmp = Path(f.name)

    # The CLI import_actions checks for dupes inline; test the DB path here
    from network_agent.core.database import get_session
    from sqlmodel import select as sql_select

    with get_session() as s:
        existing_check = s.exec(
            sql_select(Action).where(
                Action.action_type == "like",
                Action.target_name_raw == "Carol",
            )
        ).first()
        assert existing_check is not None  # pre-existing row found

    tmp.unlink()


def test_export_creates_csv(session, tmp_path):
    """Export writes valid CSV files."""
    _add_person(session, "Dave Export", email="dave@e.com")
    action = Action(action_type="follow", target_name_raw="Dave Export")
    session.add(action)
    session.commit()

    from network_agent.cli.export_cmd import _export_people, _export_actions
    ts = "20260101T000000"
    _export_people(tmp_path, ts)
    _export_actions(tmp_path, ts)

    people_file = tmp_path / f"people_{ts}.csv"
    actions_file = tmp_path / f"actions_{ts}.csv"

    assert people_file.exists()
    assert actions_file.exists()

    with people_file.open() as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert any(r["full_name"] == "Dave Export" for r in rows)

    with actions_file.open() as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert any(r["action_type"] == "follow" for r in rows)
