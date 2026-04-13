"""
Google Calendar integration for the Telegram tracker.

Setup: run `python setup_calendar.py` once to authorise access.
After that, token.json is used automatically.

Functions that interact with the API (create_*, delete_event) will
raise RuntimeError if calendar is not configured — callers should
catch and degrade gracefully so the bot works without calendar too.
"""

import os
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from config import TIMEZONE, GOOGLE_CREDENTIALS_PATH, MORNING_POLL_TIME, EVENING_POLL_TIME

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


def _find_free_slots(
    date_str: str,
    count: int,
    service,
    tz_name: str,
    start_hm: str,
    end_hm: str,
) -> list[datetime]:
    """
    Query freebusy and return `count` datetime starts for 30-min slots
    that fit in the free gaps between start_hm and end_hm.
    Falls back to evenly spaced times if not enough free gaps.
    """
    zone = ZoneInfo(tz_name)
    d = date.fromisoformat(date_str)
    sh, sm = map(int, start_hm.split(":"))
    eh, em = map(int, end_hm.split(":"))

    window_start = datetime(d.year, d.month, d.day, sh, sm, tzinfo=zone)
    window_end   = datetime(d.year, d.month, d.day, eh, em, tzinfo=zone)
    slot_len     = timedelta(minutes=30)

    # Query busy times in the window
    body = {
        "timeMin": window_start.isoformat(),
        "timeMax": window_end.isoformat(),
        "timeZone": tz_name,
        "items": [{"id": "primary"}],
    }
    result = service.freebusy().query(body=body).execute()
    busy_raw = result.get("calendars", {}).get("primary", {}).get("busy", [])

    busy = []
    for b in busy_raw:
        bs = datetime.fromisoformat(b["start"].replace("Z", "+00:00")).astimezone(zone)
        be = datetime.fromisoformat(b["end"].replace("Z", "+00:00")).astimezone(zone)
        busy.append((bs, be))

    # Collect free 30-min increments across the window
    free: list[datetime] = []
    cursor = window_start
    while cursor + slot_len <= window_end:
        slot_end = cursor + slot_len
        if not any(bs < slot_end and be > cursor for bs, be in busy):
            free.append(cursor)
        cursor += slot_len

    if len(free) >= count:
        # Pick evenly distributed slots from the free list
        if count == 1:
            return [free[len(free) // 2]]
        step = (len(free) - 1) / (count - 1)
        return [free[round(i * step)] for i in range(count)]

    # Fallback: spread evenly across the full window regardless of busy times
    total_secs = int((window_end - window_start).total_seconds())
    step_secs = total_secs // (count + 1)
    return [window_start + timedelta(seconds=step_secs * (i + 1)) for i in range(count)]


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

def create_timed_task_events(names: list[str], date_str: str) -> dict[str, str]:
    """
    Creates timed 30-min calendar events spread across free slots in the day.
    Queries freebusy first to avoid collisions with existing events.
    Falls back to evenly-spaced times if the calendar is full.
    Returns {task_name: event_id}.
    """
    service = _get_service()
    zone = ZoneInfo(TIMEZONE)
    slot_len = timedelta(minutes=30)

    slots = _find_free_slots(date_str, len(names), service, TIMEZONE, MORNING_POLL_TIME, EVENING_POLL_TIME)

    event_ids: dict[str, str] = {}
    for name, slot_start in zip(names, slots):
        slot_end = slot_start + slot_len
        event = {
            "summary": f"✅ {name}",
            "start": {"dateTime": slot_start.isoformat(), "timeZone": TIMEZONE},
            "end":   {"dateTime": slot_end.isoformat(),   "timeZone": TIMEZONE},
            "reminders": {
                "useDefault": False,
                "overrides": [{"method": "popup", "minutes": 0}],
            },
        }
        result = service.events().insert(calendarId="primary", body=event).execute()
        event_ids[name] = result["id"]

    return event_ids


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
