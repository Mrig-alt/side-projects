"""
todoist.py — Fetch uncompleted tasks from a Todoist project.

Uses the Todoist REST API v2. Requires TODOIST_API_TOKEN in .env.
"""

import requests
from config import TODOIST_API_TOKEN, TODOIST_PROJECT_NAME, TODOIST_TASK_LIMIT

_BASE = "https://api.todoist.com/rest/v2"
_MAX_WHATSAPP_POLL_OPTIONS = 12


def _headers() -> dict:
    return {"Authorization": f"Bearer {TODOIST_API_TOKEN}"}


def _find_project_id(name: str) -> str | None:
    """Return the ID of the first project whose name matches (case-insensitive)."""
    r = requests.get(f"{_BASE}/projects", headers=_headers(), timeout=10)
    r.raise_for_status()
    name_lower = name.lower()
    for project in r.json():
        if project.get("is_inbox_project") and name_lower == "inbox":
            return project["id"]
        if project.get("name", "").lower() == name_lower:
            return project["id"]
    return None


def fetch_todoist_tasks() -> list[dict]:
    """
    Fetch uncompleted tasks from the configured Todoist project.

    Returns a list of dicts:
        {"id": "<todoist_task_id>", "content": "<task title>"}

    Capped at min(TODOIST_TASK_LIMIT, MAX_WHATSAPP_POLL_OPTIONS).
    Raises requests.HTTPError on API failure.
    """
    limit = min(TODOIST_TASK_LIMIT, _MAX_WHATSAPP_POLL_OPTIONS)

    project_id = _find_project_id(TODOIST_PROJECT_NAME)
    if project_id:
        params: dict = {"project_id": project_id}
    else:
        # Fall back to filtering by name (Todoist filter syntax)
        params = {"filter": f"#{TODOIST_PROJECT_NAME}"}

    r = requests.get(f"{_BASE}/tasks", headers=_headers(), params=params, timeout=10)
    r.raise_for_status()

    tasks = r.json()
    return [{"id": t["id"], "content": t["content"]} for t in tasks[:limit]]


def close_todoist_task(task_id: str) -> None:
    """Mark a Todoist task as complete (close it)."""
    r = requests.post(f"{_BASE}/tasks/{task_id}/close", headers=_headers(), timeout=10)
    r.raise_for_status()
