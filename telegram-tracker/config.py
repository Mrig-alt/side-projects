import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = int(os.getenv("TELEGRAM_CHAT_ID", "0"))

MORNING_POLL_TIME = os.getenv("MORNING_POLL_TIME", "08:00")
EVENING_POLL_TIME = os.getenv("EVENING_POLL_TIME", "21:00")
TIMEZONE = os.getenv("TIMEZONE", "UTC")

# Google Calendar (optional — bot works without this)
GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
COUNTDOWN_THRESHOLD_DAYS = int(os.getenv("COUNTDOWN_THRESHOLD_DAYS", "10"))

# Todoist (optional — bot works without this)
TODOIST_API_TOKEN = os.getenv("TODOIST_API_TOKEN", "")
TODOIST_PROJECT_NAME = os.getenv("TODOIST_PROJECT_NAME", "Inbox")
TODOIST_CLOSE_ON_COMPLETE = os.getenv("TODOIST_CLOSE_ON_COMPLETE", "true").lower() == "true"

TASKS_FILE = Path(__file__).parent / "tasks.json"
PROGRESS_FILE = Path(__file__).parent / "progress.json"
POLL_INDEX_FILE = Path(__file__).parent / "poll_index.json"
EXCEL_FILE = Path(__file__).parent / "tracker.xlsx"


def load_task_objects() -> list[dict]:
    """Load tasks as full objects. Migrates plain strings on first run."""
    if not TASKS_FILE.exists():
        default = {
            "tasks": [
                {"name": "Morning routine (wake up, hygiene, breakfast)", "type": "recurring", "completed": 0, "missed": 0},
                {"name": "Exercise / physical activity",                  "type": "recurring", "completed": 0, "missed": 0},
                {"name": "Deep work session (2+ hours focused)",          "type": "recurring", "completed": 0, "missed": 0},
                {"name": "Learning / reading (30+ min)",                  "type": "recurring", "completed": 0, "missed": 0},
                {"name": "Evening review & plan for tomorrow",            "type": "recurring", "completed": 0, "missed": 0},
            ]
        }
        TASKS_FILE.write_text(json.dumps(default, indent=2))

    tasks = json.loads(TASKS_FILE.read_text())["tasks"]

    # Migrate plain strings from old format
    migrated = False
    for i, t in enumerate(tasks):
        if isinstance(t, str):
            tasks[i] = {"name": t, "type": "recurring", "completed": 0, "missed": 0}
            migrated = True
    if migrated:
        save_task_objects(tasks)

    return tasks


def save_task_objects(tasks: list[dict]) -> None:
    TASKS_FILE.write_text(json.dumps({"tasks": tasks}, indent=2))


def load_tasks() -> list[str]:
    return [t["name"] for t in load_task_objects()]
