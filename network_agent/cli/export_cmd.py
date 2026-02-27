"""Export commands."""
from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Annotated

import typer
from rich import print as rprint
from sqlmodel import select

from network_agent.core.database import get_session
from network_agent.models.actions import Action
from network_agent.models.people import Person

app = typer.Typer(help="Export data.")


def export_all(
    out: Annotated[Path, typer.Option("--out", "-o", help="Output directory")] = Path("./exports"),
):
    """Export people.csv and actions.csv to the specified directory."""
    out.mkdir(parents=True, exist_ok=True)
    ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S")

    _export_people(out, ts)
    _export_actions(out, ts)


def _export_people(out: Path, ts: str) -> None:
    people_file = out / f"people_{ts}.csv"
    with get_session() as session:
        people = session.exec(select(Person)).all()

    if not people:
        rprint("[yellow]No people to export.[/yellow]")
        return

    fieldnames = [
        "person_id", "full_name", "classification", "subgroup", "relationship_type",
        "company_or_school", "role_or_program", "location", "email", "linkedin_url",
        "tie_strength", "alignment", "influence", "last_interaction_date", "status",
        "next_action", "notes", "tags", "introduced_by_person_id", "created_at", "updated_at",
    ]

    with people_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for p in people:
            row = {fn: getattr(p, fn, "") for fn in fieldnames}
            writer.writerow(row)

    rprint(f"[bold green]✓[/bold green] Exported {len(people)} people → [cyan]{people_file}[/cyan]")


def _export_actions(out: Path, ts: str) -> None:
    actions_file = out / f"actions_{ts}.csv"
    with get_session() as session:
        actions = session.exec(select(Action)).all()

    if not actions:
        rprint("[yellow]No actions to export.[/yellow]")
        return

    fieldnames = [
        "action_id", "action_timestamp", "action_type", "platform",
        "target_person_id", "target_name_raw", "target_url",
        "context", "outcome", "follow_up_date", "metadata_json", "created_at",
    ]

    with actions_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for a in actions:
            row = {fn: getattr(a, fn, "") for fn in fieldnames}
            writer.writerow(row)

    rprint(f"[bold green]✓[/bold green] Exported {len(actions)} actions → [cyan]{actions_file}[/cyan]")
