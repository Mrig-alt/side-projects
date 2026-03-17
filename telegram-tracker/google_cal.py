"""
Google Calendar integration for the Telegram tracker.

Setup: run `python setup_calendar.py` once to authorise access.
After that, token.json is used automatically.

Functions that interact with the API (create_*, delete_event) will
raise RuntimeError if calendar is not configured — callers should
catch and degrade gracefully so the bot works without calendar too.
"""

import os
from datetime import date, timedelta
from pathlib import Path

from config import TIMEZONE, GOOGLE_CREDENTIALS_PATH

SCOPES = ["https://www.googleapis.com/auth/calendar"]
TOKEN_PATH = Path(__file__).parent / "token.json"


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_service():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    creds = None
    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            TOKEN_PATH.write_text(creds.to_json())
        else:
            raise RuntimeError(
                "Google Calendar not connected. Run: python setup_calendar.py"
            )

    return build("calendar", "v3", credentials=creds)


# ── Public: date math (no auth needed) ───────────────────────────────────────

def days_until(date_str: str, task_subtype: str = "deadline") -> int:
    """
    Return calendar days from today to the target date.
    For 'birthday' subtypes, calculates to the *next* yearly occurrence.
    Negative = overdue / past.
    """
    today = date.today()
    target = date.fromisoformat(date_str)

    if task_subtype == "birthday":
        # Find next occurrence (this year or next)
        try:
            this_year = target.replace(year=today.year)
        except ValueError:  # Feb 29 on non-leap year
            this_year = target.replace(year=today.year, day=28)

        if this_year < today:
            try:
                this_year = target.replace(year=today.year + 1)
            except ValueError:
                this_year = target.replace(year=today.year + 1, day=28)

        return (this_year - today).days

    return (target - today).days


def countdown_label(days: int) -> str:
    """Human-friendly countdown string."""
    if days > 1:
        return f"⏳ {days} days away"
    if days == 1:
        return "⏳ tomorrow"
    if days == 0:
        return "⚡ today!"
    return f"❌ {abs(days)}d overdue"


# ── Public: Calendar API ──────────────────────────────────────────────────────

def create_deadline_event(name: str, due_date: str, due_time: str | None = None) -> str:
    """
    Creates a one-time calendar event.
    Returns the event ID string.
    """
    service = _get_service()

    if due_time:
        h, m = due_time.split(":")
        end_h = (int(h) + 1) % 24
        start = {"dateTime": f"{due_date}T{due_time}:00", "timeZone": TIMEZONE}
        end = {"dateTime": f"{due_date}T{end_h:02d}:{m}:00", "timeZone": TIMEZONE}
    else:
        next_day = (date.fromisoformat(due_date) + timedelta(days=1)).isoformat()
        start = {"date": due_date}
        end = {"date": next_day}

    event = {"summary": f"📌 {name}", "start": start, "end": end}
    result = service.events().insert(calendarId="primary", body=event).execute()
    return result["id"]


def create_birthday_event(name: str, date_str: str) -> str:
    """
    Creates a yearly recurring all-day event (e.g. for birthdays).
    Returns the event ID string.
    """
    service = _get_service()
    next_day = (date.fromisoformat(date_str) + timedelta(days=1)).isoformat()

    event = {
        "summary": f"🎂 {name}",
        "start": {"date": date_str},
        "end": {"date": next_day},
        "recurrence": ["RRULE:FREQ=YEARLY"],
    }
    result = service.events().insert(calendarId="primary", body=event).execute()
    return result["id"]


def delete_event(event_id: str) -> None:
    """Silently deletes a calendar event; ignores errors."""
    try:
        service = _get_service()
        service.events().delete(calendarId="primary", eventId=event_id).execute()
    except Exception:
        pass
