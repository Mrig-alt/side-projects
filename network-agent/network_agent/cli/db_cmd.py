"""DB management commands."""
import typer
from rich import print as rprint

app = typer.Typer(help="Database management.")


def init_db():
    """Initialise the SQLite database and create all tables."""
    from network_agent.core.database import init_db as _init_db
    _init_db()
    rprint("[bold green]✓[/bold green] Database initialised successfully.")
