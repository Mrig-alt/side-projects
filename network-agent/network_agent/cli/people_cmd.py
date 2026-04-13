"""People CRUD commands."""
from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Optional

import typer
from rich import print as rprint
from rich.console import Console
from rich.table import Table
from sqlmodel import select

from network_agent.core.database import get_session
from network_agent.models.people import Person

app = typer.Typer(help="Manage people records.")
console = Console()

# ---------------------------------------------------------------------------
# add-person
# ---------------------------------------------------------------------------

def add_person(
    name: Annotated[Optional[str], typer.Option("--name", "-n", help="Full name")] = None,
    classification: Annotated[Optional[str], typer.Option(help="Comma-separated: Professional,Educational,Personal")] = None,
    subgroup: Annotated[Optional[str], typer.Option(help="Subgroup/community")] = None,
    relationship_type: Annotated[Optional[str], typer.Option(help="Relationship type")] = None,
    company: Annotated[Optional[str], typer.Option("--company", "-c", help="Company or school")] = None,
    role: Annotated[Optional[str], typer.Option("--role", "-r", help="Role or program")] = None,
    location: Annotated[Optional[str], typer.Option("--location", help="Location")] = None,
    email: Annotated[Optional[str], typer.Option("--email", "-e", help="Email address")] = None,
    linkedin_url: Annotated[Optional[str], typer.Option("--linkedin", "-l", help="LinkedIn profile URL")] = None,
    tie_strength: Annotated[int, typer.Option("--tie", help="Tie strength 1-5")] = 3,
    alignment: Annotated[int, typer.Option("--alignment", help="Alignment 1-5")] = 3,
    influence: Annotated[int, typer.Option("--influence", help="Influence 1-5")] = 3,
    status: Annotated[str, typer.Option("--status", help="Active|Dormant|Needs Work|Do Not Pursue")] = "Active",
    next_action: Annotated[Optional[str], typer.Option("--next-action", help="Suggested next action")] = None,
    notes: Annotated[Optional[str], typer.Option("--notes", help="Free-form notes")] = None,
    tags: Annotated[Optional[str], typer.Option("--tags", help="Comma-separated tags")] = None,
    introduced_by: Annotated[Optional[int], typer.Option("--introduced-by", help="person_id who introduced you")] = None,
    interactive: Annotated[bool, typer.Option("--interactive", "-i", help="Prompt for all fields interactively")] = False,
):
    """Add a new person to the People table."""
    if interactive or name is None:
        name = name or typer.prompt("Full name")
        if not classification:
            classification = typer.prompt(
                "Classification (Professional/Educational/Personal, comma-sep)", default="Professional"
            )
        if not company:
            company = typer.prompt("Company or school", default="")
        if not role:
            role = typer.prompt("Role or program", default="")
        if not location:
            location = typer.prompt("Location", default="")
        if not email:
            email = typer.prompt("Email (optional)", default="") or None
        if not linkedin_url:
            linkedin_url = typer.prompt("LinkedIn URL (optional)", default="") or None
        tie_strength = typer.prompt("Tie strength (1-5)", default=tie_strength, type=int)
        alignment = typer.prompt("Alignment (1-5)", default=alignment, type=int)
        influence = typer.prompt("Influence (1-5)", default=influence, type=int)
        status = typer.prompt(
            "Status (Active/Dormant/Needs Work/Do Not Pursue)", default=status
        )
        next_action = typer.prompt("Next action (optional)", default="") or None
        notes = typer.prompt("Notes (optional)", default="") or None
        tags = typer.prompt("Tags (comma-separated, optional)", default="") or None
    elif not name:
        rprint("[red]Error:[/red] --name is required (or use --interactive)")
        raise typer.Exit(1)

    # Validate scores
    for label, val in [("tie_strength", tie_strength), ("alignment", alignment), ("influence", influence)]:
        if not 1 <= val <= 5:
            rprint(f"[red]Error:[/red] {label} must be between 1 and 5 (got {val})")
            raise typer.Exit(1)

    person = Person(
        full_name=name,
        classification=classification,
        subgroup=subgroup,
        relationship_type=relationship_type,
        company_or_school=company or None,
        role_or_program=role or None,
        location=location or None,
        email=email,
        linkedin_url=linkedin_url,
        tie_strength=tie_strength,
        alignment=alignment,
        influence=influence,
        status=status,
        next_action=next_action,
        notes=notes,
        tags=tags,
        introduced_by_person_id=introduced_by,
    )

    with get_session() as session:
        session.add(person)
        session.commit()
        session.refresh(person)
        rprint(
            f"[bold green]✓[/bold green] Added person [bold]{person.full_name}[/bold] "
            f"(id={person.person_id})"
        )


# ---------------------------------------------------------------------------
# list-people
# ---------------------------------------------------------------------------

def list_people(
    classification: Annotated[Optional[str], typer.Option("--classification", "-c", help="Filter by classification")] = None,
    status: Annotated[Optional[str], typer.Option("--status", "-s", help="Filter by status")] = None,
    tags: Annotated[Optional[str], typer.Option("--tags", "-t", help="Filter by tag (single)")] = None,
    company: Annotated[Optional[str], typer.Option("--company", help="Filter by company (partial match)")] = None,
    limit: Annotated[int, typer.Option("--limit", "-n", help="Max rows to show")] = 50,
):
    """List people with optional filters."""
    with get_session() as session:
        stmt = select(Person)
        results = session.exec(stmt).all()

    # Python-side filtering for flexibility
    if classification:
        results = [p for p in results if classification.lower() in (p.classification or "").lower()]
    if status:
        results = [p for p in results if status.lower() in p.status.lower()]
    if tags:
        results = [p for p in results if tags.lower() in (p.tags or "").lower()]
    if company:
        results = [p for p in results if company.lower() in (p.company_or_school or "").lower()]

    results = results[:limit]

    if not results:
        rprint("[yellow]No people found matching filters.[/yellow]")
        return

    table = Table(title=f"People ({len(results)} records)", show_lines=False)
    cols = ["id", "name", "classification", "status", "company", "role", "location",
            "tie", "align", "inf", "last_interaction", "next_action", "tags"]
    for col in cols:
        table.add_column(col, overflow="fold")

    for p in results:
        table.add_row(
            str(p.person_id),
            p.full_name,
            p.classification or "",
            p.status,
            p.company_or_school or "",
            p.role_or_program or "",
            p.location or "",
            str(p.tie_strength),
            str(p.alignment),
            str(p.influence),
            str(p.last_interaction_date or ""),
            (p.next_action or "")[:40],
            p.tags or "",
        )

    console.print(table)


# ---------------------------------------------------------------------------
# reconcile
# ---------------------------------------------------------------------------

def reconcile(
    dry_run: Annotated[bool, typer.Option("--dry-run/--no-dry-run", help="Preview only")] = True,
    threshold: Annotated[int, typer.Option("--threshold", help="Fuzzy match threshold 0-100")] = 85,
):
    """Find potential duplicate people and optionally merge them."""
    from rapidfuzz import fuzz
    with get_session() as session:
        stmt = select(Person)
        people = session.exec(stmt).all()

        seen: set[tuple[int, int]] = set()
        dupes: list[tuple[Person, Person, int]] = []

        for i, p1 in enumerate(people):
            for p2 in people[i + 1:]:
                score = fuzz.WRatio(p1.full_name.lower(), p2.full_name.lower())
                if score >= threshold:
                    key = (min(p1.person_id, p2.person_id), max(p1.person_id, p2.person_id))
                    if key not in seen:
                        seen.add(key)
                        dupes.append((p1, p2, score))

        if not dupes:
            rprint("[green]No potential duplicates found.[/green]")
            return

        rprint(f"\n[bold yellow]Found {len(dupes)} potential duplicate pair(s):[/bold yellow]\n")
        for p1, p2, score in dupes:
            rprint(
                f"  [bold]id={p1.person_id}[/bold] {p1.full_name} ({p1.company_or_school or 'N/A'})  "
                f"↔  [bold]id={p2.person_id}[/bold] {p2.full_name} ({p2.company_or_school or 'N/A'})  "
                f"  score={score}%"
            )

        if dry_run:
            rprint("\n[dim]Run with --no-dry-run to interactively merge pairs.[/dim]")
            return

        # Interactive merge
        for p1, p2, score in dupes:
            rprint(f"\n[bold]Merge candidate (score={score}%):[/bold]")
            rprint(f"  [cyan]A[/cyan] id={p1.person_id}: {p1.full_name}, {p1.company_or_school}, {p1.email}")
            rprint(f"  [cyan]B[/cyan] id={p2.person_id}: {p2.full_name}, {p2.company_or_school}, {p2.email}")
            choice = typer.prompt("Keep which? (A/B/skip)", default="skip").strip().upper()

            if choice not in ("A", "B"):
                rprint("[dim]Skipped.[/dim]")
                continue

            keep, discard = (p1, p2) if choice == "A" else (p2, p1)

            # Re-point actions to keeper
            from network_agent.models.actions import Action
            from sqlmodel import update as sql_update
            session.exec(
                sql_update(Action)
                .where(Action.target_person_id == discard.person_id)
                .values(target_person_id=keep.person_id)
            )

            # Re-point sources
            from network_agent.models.sources import Source
            session.exec(
                sql_update(Source)
                .where(Source.person_id == discard.person_id)
                .values(person_id=keep.person_id)
            )

            # Merge notes/tags
            merged_notes = "\n".join(filter(None, [keep.notes, discard.notes]))
            merged_tags = ",".join(filter(None, [keep.tags, discard.tags]))
            keep.notes = merged_notes or None
            keep.tags = merged_tags or None
            keep.updated_at = datetime.utcnow()
            session.add(keep)
            session.delete(discard)
            session.commit()
            rprint(f"[green]✓[/green] Merged id={discard.person_id} into id={keep.person_id}")
