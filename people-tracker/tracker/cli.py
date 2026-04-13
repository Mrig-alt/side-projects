"""
People Tracker CLI

Commands:
  tracker add "Name" --linkedin slug --instagram username
  tracker people                  # list tracked people
  tracker login linkedin|instagram
  tracker fetch [-p person_id]    # scrape new posts
  tracker feed [--all]            # browse posts
  tracker flag <post_id>          # mark as interesting
  tracker reached-out <post_id>   # log that you reached out
  tracker note <person_id> "text" # update notes on a person
  tracker remove <person_id>
  tracker stats
"""

import click
from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from . import db
from . import linkedin as li
from . import instagram as ig

console = Console()


@click.group()
def cli():
    """Track people's social posts and know when to reach out."""
    db.init_db()


# ---------------------------------------------------------------------------
# People management
# ---------------------------------------------------------------------------

@cli.command()
@click.argument("name")
@click.option("--linkedin", "-l", "linkedin_slug", default=None,
              help="LinkedIn slug (e.g. 'johndoe' from linkedin.com/in/johndoe)")
@click.option("--instagram", "-i", "instagram_username", default=None,
              help="Instagram username (without @)")
@click.option("--notes", "-n", default=None, help="Notes about this person")
def add(name, linkedin_slug, instagram_username, notes):
    """Add a person to track."""
    if not linkedin_slug and not instagram_username:
        console.print("[red]Provide at least --linkedin or --instagram.[/red]")
        raise SystemExit(1)
    person_id = db.add_person(name, linkedin_slug, instagram_username, notes)
    console.print(f"[green]Added[/green] [bold]{name}[/bold] (id: {person_id})")


@cli.command()
def people():
    """List everyone you're tracking."""
    rows = db.list_people()
    if not rows:
        console.print("[dim]No one tracked yet. Use 'tracker add' to get started.[/dim]")
        return

    table = Table(box=box.ROUNDED, show_lines=False)
    table.add_column("ID", style="dim", width=4)
    table.add_column("Name", style="bold")
    table.add_column("LinkedIn")
    table.add_column("Instagram")
    table.add_column("Notes", style="dim")

    for row in rows:
        table.add_row(
            str(row["id"]),
            row["name"],
            row["linkedin_slug"] or "[dim]-[/dim]",
            row["instagram_username"] or "[dim]-[/dim]",
            (row["notes"] or "")[:50],
        )

    console.print(table)


@cli.command()
@click.argument("person_id", type=int)
@click.argument("notes")
def note(person_id, notes):
    """Update notes for a person."""
    person = db.get_person(person_id)
    if not person:
        console.print(f"[red]Person {person_id} not found.[/red]")
        raise SystemExit(1)
    db.update_person_notes(person_id, notes)
    console.print(f"[green]Updated notes for[/green] {person['name']}")


@cli.command()
@click.argument("person_id", type=int)
@click.confirmation_option(prompt="Remove this person and all their posts?")
def remove(person_id):
    """Remove a person (and all their saved posts)."""
    person = db.get_person(person_id)
    if not person:
        console.print(f"[red]Person {person_id} not found.[/red]")
        raise SystemExit(1)
    db.delete_person(person_id)
    console.print(f"[red]Removed[/red] {person['name']}")


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@cli.command()
@click.argument("platform", type=click.Choice(["linkedin", "instagram"]))
def login(platform):
    """Save a browser session for LinkedIn or Instagram (run this once)."""
    console.print(f"Opening browser for [bold]{platform}[/bold]...")
    if platform == "linkedin":
        li.login()
    else:
        ig.login()
    console.print(f"[green]Session saved for {platform}.[/green]")


# ---------------------------------------------------------------------------
# Fetching
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--person", "-p", "person_id", type=int, default=None,
              help="Fetch only for this person ID")
@click.option("--limit", default=10, show_default=True,
              help="Max posts to fetch per person per platform")
def fetch(person_id, limit):
    """Scrape recent posts for all tracked people (or one person)."""
    people = [db.get_person(person_id)] if person_id else db.list_people()
    people = [p for p in people if p]

    if not people:
        console.print("[dim]No people to fetch. Add someone with 'tracker add'.[/dim]")
        return

    total_new = 0

    for person in people:
        console.rule(f"[bold]{person['name']}[/bold]")

        if person["linkedin_slug"]:
            new = _fetch_platform(person, "linkedin", li.fetch_posts, person["linkedin_slug"], limit)
            total_new += new

        if person["instagram_username"]:
            new = _fetch_platform(person, "instagram", ig.fetch_posts, person["instagram_username"], limit)
            total_new += new

    console.print(f"\n[green]Done.[/green] {total_new} new post(s) saved. Run [bold]tracker feed[/bold] to browse.")


def _fetch_platform(person, platform_name, fetch_fn, handle, limit):
    try:
        posts = fetch_fn(handle, limit=limit)
        new_count = sum(
            db.save_post(person["id"], p["platform"], p["post_id"], p["content"], p["url"], p["posted_at"])
            for p in posts
        )
        status = f"[green]{new_count} new[/green]" if new_count else "[dim]0 new[/dim]"
        console.print(f"  {platform_name.capitalize()}: fetched {len(posts)}, {status}")
        return new_count
    except RuntimeError as e:
        console.print(f"  [yellow]{e}[/yellow]")
        return 0
    except Exception as e:
        console.print(f"  [red]{platform_name.capitalize()} error:[/red] {e}")
        return 0


# ---------------------------------------------------------------------------
# Feed / post actions
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--all", "show_all", is_flag=True, help="Show all posts including flagged/reached-out")
@click.option("--person", "-p", "person_id", type=int, default=None, help="Filter to one person")
@click.option("--limit", default=30, show_default=True)
def feed(show_all, person_id, limit):
    """Browse recent posts. New posts (not yet flagged or reached-out) are shown by default."""
    if person_id:
        posts = db.get_person_posts(person_id, limit=limit)
    else:
        posts = db.get_feed(limit=limit, only_new=not show_all)

    if not posts:
        hint = "tracker fetch" if not show_all else "tracker fetch, then tracker feed --all"
        console.print(f"[dim]No posts to show. Try: {hint}[/dim]")
        return

    for post in posts:
        _render_post(post)

    console.print(
        f"\n[dim]Tip: tracker flag <id>  ·  tracker reached-out <id>  ·  tracker feed --all[/dim]"
    )


def _render_post(post):
    platform = post["platform"]
    color = "blue" if platform == "linkedin" else "magenta"
    platform_tag = f"[{color}]{platform.upper()}[/{color}]"

    badges = []
    if post["flagged"]:
        badges.append("[yellow]★ flagged[/yellow]")
    if post["reached_out"]:
        badges.append("[green]✓ reached out[/green]")
    badge_str = ("  " + "  ".join(badges)) if badges else ""

    title = (
        f"[bold]{post['person_name']}[/bold]  {platform_tag}"
        f"  [dim]post id: {post['id']}[/dim]{badge_str}"
    )

    content = post["content"] or ""
    # Truncate long posts
    if len(content) > 400:
        content = content[:400].rstrip() + " [dim]…[/dim]"

    if not content:
        content = "[dim](no text content)[/dim]"

    if post["url"]:
        content += f"\n[dim]{post['url']}[/dim]"

    border = "yellow" if post["flagged"] else ("green" if post["reached_out"] else "dim")
    console.print(Panel(content, title=title, title_align="left", border_style=border))


@cli.command()
@click.argument("post_id", type=int)
def flag(post_id):
    """Flag a post as interesting (you want to reach out about this)."""
    db.flag_post(post_id)
    console.print(f"[yellow]★ Flagged post {post_id}[/yellow]")


@cli.command()
@click.argument("post_id", type=int)
def unflag(post_id):
    """Remove the flag from a post."""
    db.unflag_post(post_id)
    console.print(f"[dim]Unflagged post {post_id}[/dim]")


@cli.command("reached-out")
@click.argument("post_id", type=int)
def reached_out(post_id):
    """Log that you've reached out to this person about this post."""
    db.mark_reached_out(post_id)
    console.print(f"[green]✓ Marked post {post_id}: reached out[/green]")


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@cli.command()
def stats():
    """Show a summary of your tracking activity."""
    s = db.stats()
    table = Table(box=box.SIMPLE, show_header=False)
    table.add_column("", style="dim")
    table.add_column("", style="bold")
    table.add_row("People tracked", str(s["people"]))
    table.add_row("Posts saved", str(s["posts"]))
    table.add_row("Posts flagged", str(s["flagged"]))
    table.add_row("Times reached out", str(s["reached_out"]))
    console.print(table)


def main():
    cli()


if __name__ == "__main__":
    main()
