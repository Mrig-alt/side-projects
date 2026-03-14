import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")
MY_NUMBER = os.getenv("MY_WHATSAPP_NUMBER")
POLL_TIME = os.getenv("POLL_TIME", "21:00")
TIMEZONE = os.getenv("TIMEZONE", "UTC")
WEBHOOK_PORT = int(os.getenv("WEBHOOK_PORT", "5000"))

TASKS_FILE = Path(__file__).parent / "tasks.json"
PROGRESS_FILE = Path(__file__).parent / "progress.json"


def load_tasks() -> list[str]:
    if not TASKS_FILE.exists():
        default = {
            "tasks": [
                "Morning routine",
                "Exercise",
                "Deep work session",
                "Learning / reading",
                "Evening review",
            ]
        }
        TASKS_FILE.write_text(json.dumps(default, indent=2))
    return json.loads(TASKS_FILE.read_text())["tasks"]
