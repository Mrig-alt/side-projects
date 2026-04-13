"""Action logging and import commands."""
from __future__ import annotations

import csv
import json
from datetime import date, datetime
from pathlib import Path
from typing import Annotated, Optional

import typer
from dateutil import parser as dateutil_parser
from rich import print as rprint
from rich.console import Console
from rich.table import Table
from sqlmodel import select

from network_agent.core.database import get_session
from network_agent.core.linking import resolve_target
from network_agent.models.actions import Action, ACTION_TYPE_VALUES
from network_agent.models.people import Person

app = typer.Typer(help="Log and query LinkedIn actions.")
console = Console()


def _parse_dt(value: str) -> datetime:
    try:
        return dateutil_parser.parse(value)
    except Exception:
        raise typer.BadParameter(f"Cannot parse datetime: {value!r}")


def _parse_date(value: str) -> date:
    return _parse_dt(value).date()


# ---------------------------------------------------------------------------
# log-action
# ---------------------------------------------------------------------------

def log_action(
    action_type: Annotated[str, typer.Option("--type", "-t", help=f"Action type. Options: {', '.join(ACTION_TYPE_VALUES)}")] = "other",
    timestamp: Annotated[Optional[str], typer.Option("--timestamp", help="ISO datetime (default: now)")] = None,
    platform: Annotated[str, typer.Option("--platform", help="Platform name")] = "LinkedIn",
    person_id: Annotated[Optional[int], typer.Option("--person-id", "-p", help="Existing person_id to link")] = None,
    target_name: Annotated[Optional[str], typer.Option("--target-name", help="Target person name (for fuzzy match)")] = None,
    linkedin_url: Annotated[Optional[str], typer.Option("--linkedin-url", help="Target LinkedIn URL (for URL match)")] = None,
    email: Annotated[Optional[str], typer.Option("--email", help="Target email (for email match)")] = None,
    target_url: Annotated[Optional[str], typer.Option("--target-url", help="URL of the target page/post")] = None,
    context: Annotated[Optional[str], typer.Option("--context", "-c", help="Context note")] = None,
    outcome: Annotated[Optional[str], typer.Option("--outcome", "-o", help="Outcome note")] = None,
    follow_up_date: Annotated[Optional[str], typer.Option("--follow-up", help="Follow-up date (YYYY-MM-DD)")] = None,
    meta: Annotated[Optional[str], typer.Option("--meta", help='Extra metadata as JSON string, e.g. \'{"role":"PM"}\'')] = None,
    interactive: Annotated[bool, typer.Option("--interactive", "-i", help="Prompt for all fields")] = False,
):
    """Log a LinkedIn action you performed."""
    if interactive:
        action_type = typer.prompt(f"Action type [{'/'.join(ACTION_TYPE_VALUES)}]", default=action_type)
        timestamp = typer.prompt("Timestamp (ISO, blank=now)", default="") or None
        target_name = typer.prompt("Target person name (optional)", default="") or None
        linkedin_url = typer.prompt("Target LinkedIn URL (optional)", default="") or None
        context = typer.prompt("Context (optional)", default="") or None
        outcome = typer.prompt("Outcome (optional)", default="") or None
        follow_up_date = typer.prompt("Follow-up date YYYY-MM-DD (optional)", default="") or None

    action_dt = _parse_dt(timestamp) if timestamp else datetime.utcnow()
    fup_date = _parse_date(follow_up_date) if follow_up_date else None

    resolved_person_id: Optional[int] = person_id
    warning: Optional[str] = None

    # Identity resolution if no explicit person_id
    if resolved_person_id is None and (target_name or linkedin_url or email):
        with get_session() as session:
            resolved_person_id, warning = resolve_target(
                session,
                linkedin_url=linkedin_url or "",
                email=email or "",
                name=target_name or "",
            )
    elif resolved_person_id is not None:
        # Validate the explicit person_id exists
        with get_session() as session:
            p = session.get(Person, resolved_person_id)
            if p is None:
                rprint(f"[red]Error:[/red] No person with id={resolved_person_id}")
                raise typer.Exit(1)

    if warning:
        rprint(f"[yellow]Warning:[/yellow] {warning}")

    action = Action(
        action_timestamp=action_dt,
        action_type=action_type,
        platform=platform,
        target_person_id=resolved_person_id,
        target_name_raw=target_name,
        target_url=target_url or linkedin_url,
        context=context,
        outcome=outcome,
        follow_up_date=fup_date,
        metadata_json=meta,
    )

    with get_session() as session:
        session.add(action)
        session.commit()
        session.refresh(action)

    person_label = f"person_id={resolved_person_id}" if resolved_person_id else f"(unlinked: {target_name or 'N/A'})"
    rprint(
        f"[bold green]✓[/bold green] Logged action [bold]{action_type}[/bold] "
        f"→ {person_label} (action_id={action.action_id})"
    )


# ---------------------------------------------------------------------------
# list-actions
# ---------------------------------------------------------------------------

def list_actions(
    person_id: Annotated[Optional[int], typer.Option("--person-id", "-p")] = None,
    action_type: Annotated[Optional[str], typer.Option("--type", "-t")] = None,
    since: Annotated[Optional[str], typer.Option("--since", help="From date YYYY-MM-DD")] = None,
    until: Annotated[Optional[str], typer.Option("--until", help="To date YYYY-MM-DD")] = None,
    limit: Annotated[int, typer.Option("--limit", "-n")] = 50,
):
    """List logged actions with filters."""
    with get_session() as session:
        stmt = select(Action)
        results = session.exec(stmt).all()

    if person_id is not None:
        results = [a for a in results if a.target_person_id == person_id]
    if action_type:
        results = [a for a in results if action_type.lower() in a.action_type.lower()]
    if since:
        since_dt = _parse_dt(since)
        results = [a for a in results if a.action_timestamp >= since_dt]
    if until:
        until_dt = _parse_dt(until)
        results = [a for a in results if a.action_timestamp <= until_dt]

    results = sorted(results, key=lambda a: a.action_timestamp, reverse=True)[:limit]

    if not results:
        rprint("[yellow]No actions found matching filters.[/yellow]")
        return

    table = Table(title=f"Actions ({len(results)} records)", show_lines=False)
    for col in ["id", "timestamp", "type", "platform", "person_id", "target_name", "context", "outcome", "follow_up"]:
        table.add_column(col, overflow="fold")

    for a in results:
        table.add_row(
            str(a.action_id),
            str(a.action_timestamp)[:19],
            a.action_type,
            a.platform,
            str(a.target_person_id or ""),
            a.target_name_raw or "",
            (a.context or "")[:50],
            a.outcome or "",
            str(a.follow_up_date or ""),
        )

    console.print(table)


# ---------------------------------------------------------------------------
# import-actions
# ---------------------------------------------------------------------------

def import_actions(
    file: Annotated[Path, typer.Option("--file", "-f", help="CSV or JSON file to import", exists=True)],
    dry_run: Annotated[bool, typer.Option("--dry-run/--no-dry-run", help="Preview without writing")] = False,
    skip_duplicates: Annotated[bool, typer.Option("--skip-duplicates/--no-skip-duplicates")] = True,
):
    """
    Import actions from a CSV or JSON file.

    CSV schema (header row required):
      action_timestamp, action_type, platform, target_name, linkedin_url,
      email, target_url, context, outcome, follow_up_date, metadata_json

    JSON schema: array of objects with the same keys.
    """
    raw_rows = _load_import_file(file)
    if not raw_rows:
        rprint("[yellow]File is empty or unrecognised format.[/yellow]")
        return

    rprint(f"[cyan]Loaded {len(raw_rows)} row(s) from {file}[/cyan]")

    added = 0
    skipped = 0
    warnings: list[str] = []

    with get_session() as session:
        for row in raw_rows:
            action_dt = _parse_dt(row.get("action_timestamp") or "") if row.get("action_timestamp") else datetime.utcnow()
            action_type = row.get("action_type") or "other"
            platform = row.get("platform") or "LinkedIn"
            target_name = row.get("target_name") or row.get("target_name_raw") or None
            linkedin_url = row.get("linkedin_url") or None
            email_val = row.get("email") or None
            target_url = row.get("target_url") or None
            context = row.get("context") or None
            outcome = row.get("outcome") or None
            fup_raw = row.get("follow_up_date") or None
            fup_date = _parse_date(fup_raw) if fup_raw else None
            meta = row.get("metadata_json") or None

            # Dedupe by timestamp + type + target_name
            if skip_duplicates:
                existing = session.exec(
                    select(Action).where(
                        Action.action_timestamp == action_dt,
                        Action.action_type == action_type,
                        Action.target_name_raw == target_name,
                    )
                ).first()
                if existing:
                    skipped += 1
                    continue

            resolved_id, warn = resolve_target(
                session,
                linkedin_url=linkedin_url or "",
                email=email_val or "",
                name=target_name or "",
            )
            if warn and target_name:
                warnings.append(f"Row {added + skipped + 1}: {warn}")

            action = Action(
                action_timestamp=action_dt,
                action_type=action_type,
                platform=platform,
                target_person_id=resolved_id,
                target_name_raw=target_name,
                target_url=target_url,
                context=context,
                outcome=outcome,
                follow_up_date=fup_date,
                metadata_json=meta,
            )

            if not dry_run:
                session.add(action)
            added += 1

        if not dry_run:
            session.commit()

    mode = "[DRY RUN] " if dry_run else ""
    rprint(f"[bold green]{mode}Import complete.[/bold green] Added={added}, Skipped={skipped}")
    for w in warnings[:10]:
        rprint(f"  [yellow]↳[/yellow] {w}")
    if len(warnings) > 10:
        rprint(f"  [yellow]... and {len(warnings) - 10} more warnings.[/yellow]")


def _load_import_file(file: Path) -> list[dict]:
    suffix = file.suffix.lower()
    if suffix == ".json":
        with file.open() as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        if isinstance(data, dict) and "actions" in data:
            return data["actions"]
        return []
    elif suffix == ".csv":
        with file.open(newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            return [dict(row) for row in reader]
    else:
        rprint(f"[red]Unsupported file format: {suffix}[/red] (expected .csv or .json)")
        raise typer.Exit(1)
