import requests
from datetime import date
from config import (
    WHATSAPP_API_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID,
    MY_NUMBER,
    GRAPH_API_BASE,
    TODOIST_API_TOKEN,
    load_tasks,
)
from tracker import (
    mark_morning_poll_sent,
    mark_evening_poll_sent,
    get_planned_tasks_for_today,
)

_MAX_POLL_OPTIONS = 12  # WhatsApp platform limit


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {WHATSAPP_API_TOKEN}",
        "Content-Type": "application/json",
    }


def _send_native_poll(question: str, options: list[str], allow_multiple: bool = True) -> str:
    """
    Send a native WhatsApp poll via Meta Cloud API.
    Returns the sent message ID.
    """
    if len(options) > _MAX_POLL_OPTIONS:
        raise ValueError(
            f"WhatsApp polls support max {_MAX_POLL_OPTIONS} options "
            f"(got {len(options)}). Trim your tasks.json."
        )

    url = f"{GRAPH_API_BASE}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": MY_NUMBER,
        "type": "interactive",
        "interactive": {
            "type": "poll",
            "body": {"text": question},
            "action": {
                "name": "poll",
                "parameters": {
                    "question": question,
                    "options": [
                        {"id": str(i), "title": opt[:100]}
                        for i, opt in enumerate(options)
                    ],
                    "allow_multiple_answers": allow_multiple,
                },
            },
        },
    }
    r = requests.post(url, json=payload, headers=_headers(), timeout=10)
    r.raise_for_status()
    return r.json()["messages"][0]["id"]


def send_text_message(body: str) -> None:
    url = f"{GRAPH_API_BASE}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": MY_NUMBER,
        "type": "text",
        "text": {"body": body},
    }
    requests.post(url, json=payload, headers=_headers(), timeout=10)


# ── Scheduled polls ───────────────────────────────────────────────────────────

def _load_poll_tasks() -> tuple[list[str], list[str] | None]:
    """
    Return (task_names, task_ids).

    If TODOIST_API_TOKEN is set, fetches live uncompleted tasks from Todoist.
    Falls back to tasks.json if the Todoist call fails or token is absent.
    task_ids is None when using the local tasks.json source.
    """
    if TODOIST_API_TOKEN:
        try:
            import todoist
            items = todoist.fetch_todoist_tasks()
            return [t["content"] for t in items], [t["id"] for t in items]
        except Exception as e:
            print(f"[warn] Todoist fetch failed, falling back to tasks.json: {e}")
    return load_tasks(), None


def send_morning_poll() -> None:
    """
    Morning poll: full task list → user selects which tasks they plan to do today.
    Uses live Todoist Inbox tasks when TODOIST_API_TOKEN is configured.
    """
    task_names, task_ids = _load_poll_tasks()
    today = date.today().strftime("%A, %B %d")
    question = f"📅 {today} — Which tasks are you doing today?"
    msg_id = _send_native_poll(question, task_names, allow_multiple=True)
    mark_morning_poll_sent(msg_id, task_ids=task_ids)
    source = "Todoist" if task_ids else "tasks.json"
    print(f"[{date.today().isoformat()}] Morning poll sent (id: {msg_id}, source: {source})")


def send_evening_poll() -> None:
    """
    Evening poll: shows only today's planned tasks (from morning poll).
    Falls back to full task list if morning poll was skipped.
    """
    tasks = load_tasks()
    planned_indices = get_planned_tasks_for_today()

    if planned_indices is not None:
        poll_tasks = [tasks[i] for i in planned_indices if i < len(tasks)]
        intro = "Which of your planned tasks did you complete?"
    else:
        poll_tasks = tasks
        intro = "Which tasks did you complete today?"

    # Fall back to full list if morning poll had no selections
    if not poll_tasks:
        poll_tasks = tasks
        planned_indices = None
        intro = "Which tasks did you complete today?"

    today = date.today().strftime("%A, %B %d")
    question = f"✅ {today} — {intro}"
    msg_id = _send_native_poll(question, poll_tasks, allow_multiple=True)
    mark_evening_poll_sent(msg_id, planned_indices)
    print(f"[{date.today().isoformat()}] Evening poll sent (id: {msg_id})")
