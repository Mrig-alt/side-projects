import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

WHATSAPP_API_TOKEN = os.getenv("WHATSAPP_API_TOKEN")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "my_verify_token")
MY_NUMBER = os.getenv("MY_WHATSAPP_NUMBER")  # no + prefix

MORNING_POLL_TIME = os.getenv("MORNING_POLL_TIME", "08:00")
EVENING_POLL_TIME = os.getenv("EVENING_POLL_TIME", "21:00")
TIMEZONE = os.getenv("TIMEZONE", "UTC")
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "5000"))

GRAPH_API_VERSION = "v20.0"
GRAPH_API_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

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
