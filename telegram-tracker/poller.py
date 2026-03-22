from datetime import date
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from config import TELEGRAM_CHAT_ID, TODOIST_API_TOKEN, PROGRESS_FILE, load_tasks, load_task_objects
from tracker import mark_morning_poll_sent, mark_evening_poll_sent, get_planned_tasks_for_today, lookup_poll
from state import ChecklistSession, sessions


def build_keyboard(tasks: list[str], selected: set, confirm_label: str = "Done ✅") -> InlineKeyboardMarkup:
    buttons = []
    for i, task in enumerate(tasks):
        prefix = "✅ " if i in selected else "☐  "
        buttons.append([InlineKeyboardButton(prefix + task, callback_data=f"toggle:{i}")])
    buttons.append([InlineKeyboardButton(confirm_label, callback_data="confirm")])
    return InlineKeyboardMarkup(buttons)


def _load_poll_tasks() -> tuple[list[str], list[str], list[str] | None]:
    """
    Return (task_names, task_types, task_ids).

    If TODOIST_API_TOKEN is set, fetches all uncompleted tasks from Todoist.
    Falls back to tasks.json if the call fails or the token is absent.
    task_ids is None when using the local tasks.json source.
    """
    if TODOIST_API_TOKEN:
        try:
            import todoist
            items = todoist.fetch_todoist_tasks()
            names = [t["content"] for t in items]
            ids   = [t["id"]      for t in items]
            types = ["todoist"] * len(items)
            return names, types, ids
        except Exception as e:
            print(f"[warn] Todoist fetch failed, falling back to tasks.json: {e}")

    task_objects = load_task_objects()
    names = [t["name"]             for t in task_objects]
    types = [t.get("type", "recurring") for t in task_objects]
    return names, types, None


async def send_morning_poll(context: ContextTypes.DEFAULT_TYPE) -> None:
    task_names, task_types, task_ids = _load_poll_tasks()

    today = date.today().strftime("%A, %B %d")
    text = f"📅 *{today}* — Which tasks are you tackling today?"
    msg = await context.bot.send_message(
        chat_id=TELEGRAM_CHAT_ID,
        text=text,
        reply_markup=build_keyboard(task_names, set()),
        parse_mode="Markdown",
    )
    key = str(msg.message_id)
    mark_morning_poll_sent(key, task_names=task_names, task_types=task_types, task_ids=task_ids)
    sessions[TELEGRAM_CHAT_ID] = ChecklistSession(
        poll_type="morning",
        message_id=key,
        display_tasks=task_names,
        selected=set(),
    )
    source = "Todoist" if task_ids else "tasks.json"
    print(f"[{date.today().isoformat()}] Morning checklist sent (msg: {key}, source: {source})")


async def send_evening_poll(context: ContextTypes.DEFAULT_TYPE) -> None:
    import json

    planned_indices = get_planned_tasks_for_today()

    # Use morning poll task names — correct for both Todoist and local tasks.json
    today_str = date.today().isoformat()
    progress = json.loads(PROGRESS_FILE.read_text()) if PROGRESS_FILE.exists() else {}
    morning_poll_id = progress.get(today_str, {}).get("morning", {}).get("poll_id")
    all_task_names = None
    if morning_poll_id:
        info = lookup_poll(morning_poll_id)
        if info:
            all_task_names = info.get("task_names")
    if not all_task_names:
        all_task_names = load_tasks()

    if planned_indices:
        display_tasks = [all_task_names[i] for i in planned_indices if i < len(all_task_names)]
        intro = "Which of your planned tasks did you complete?"
    else:
        display_tasks = all_task_names
        intro = "Which tasks did you complete today?"

    if not display_tasks:
        display_tasks = all_task_names
        planned_indices = None
        intro = "Which tasks did you complete today?"

    today = date.today().strftime("%A, %B %d")
    text = f"✅ *{today}* — {intro}"
    msg = await context.bot.send_message(
        chat_id=TELEGRAM_CHAT_ID,
        text=text,
        reply_markup=build_keyboard(display_tasks, set(), confirm_label="Submit ✅"),
        parse_mode="Markdown",
    )
    key = str(msg.message_id)
    mark_evening_poll_sent(key, planned_indices)
    sessions[TELEGRAM_CHAT_ID] = ChecklistSession(
        poll_type="evening",
        message_id=key,
        display_tasks=display_tasks,
        selected=set(),
        planned_indices=planned_indices,
    )
    print(f"[{date.today().isoformat()}] Evening checklist sent (msg: {key})")


async def send_text_message(context: ContextTypes.DEFAULT_TYPE, text: str) -> None:
    await context.bot.send_message(
        chat_id=TELEGRAM_CHAT_ID,
        text=text,
        parse_mode="Markdown",
    )


async def send_countdown_alerts(context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Sends a message listing any tasks whose due date is within
    COUNTDOWN_THRESHOLD_DAYS days. Silently skips if nothing is due soon.
    """
    from config import COUNTDOWN_THRESHOLD_DAYS, load_task_objects
    from google_cal import days_until, countdown_label

    tasks = load_task_objects()
    alerts = []

    for t in tasks:
        if not t.get("due_date"):
            continue
        subtype = t.get("task_subtype", "deadline")
        days = days_until(t["due_date"], subtype)
        if 0 <= days <= COUNTDOWN_THRESHOLD_DAYS:
            icon = "🎂" if subtype == "birthday" else "📌"
            time_part = f" at {t['due_time']}" if t.get("due_time") else ""
            alerts.append(
                f"{icon} *{t['name']}*{time_part} — {countdown_label(days)}"
            )

    if alerts:
        text = "⏰ *Upcoming reminders:*\n" + "\n".join(alerts)
        await context.bot.send_message(
            chat_id=TELEGRAM_CHAT_ID, text=text, parse_mode="Markdown"
        )
