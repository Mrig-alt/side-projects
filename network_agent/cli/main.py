"""CLI entrypoint: network_agent"""
import typer

from network_agent.cli import db_cmd, people_cmd, actions_cmd, export_cmd

app = typer.Typer(
    name="network_agent",
    help="Local-first LinkedIn Action Tracker + People Dataset AI Agent.",
    no_args_is_help=True,
)

app.add_typer(db_cmd.app, name="db")
app.add_typer(people_cmd.app, name="people")
app.add_typer(actions_cmd.app, name="actions")
app.add_typer(export_cmd.app, name="data")

# Convenience top-level aliases so the spec commands work directly:
#   network_agent init-db
#   network_agent add-person  ...etc
app.command("init-db")(db_cmd.init_db)
app.command("add-person")(people_cmd.add_person)
app.command("list-people")(people_cmd.list_people)
app.command("log-action")(actions_cmd.log_action)
app.command("list-actions")(actions_cmd.list_actions)
app.command("import-actions")(actions_cmd.import_actions)
app.command("export")(export_cmd.export_all)
app.command("reconcile")(people_cmd.reconcile)

if __name__ == "__main__":
    app()
