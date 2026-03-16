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

TASKS_FILE = Path(__file__).parent / "tasks.json"
PROGRESS_FILE = Path(__file__).parent / "progress.json"
POLL_INDEX_FILE = Path(__file__).parent / "poll_index.json"


def load_tasks() -> list[str]:
    if not TASKS_FILE.exists():
        default = {
            "tasks": [
                "Morning routine (wake up, hygiene, breakfast)",
                "Exercise / physical activity",
                "Deep work session (2+ hours focused)",
                "Learning / reading (30+ min)",
                "Evening review & plan for tomorrow",
            ]
        }
        TASKS_FILE.write_text(json.dumps(default, indent=2))
    return json.loads(TASKS_FILE.read_text())["tasks"]
