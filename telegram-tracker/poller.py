from datetime import date
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from config import TELEGRAM_CHAT_ID, load_tasks
from tracker import mark_morning_poll_sent, mark_evening_poll_sent, get_planned_tasks_for_today
from state import ChecklistSession, sessions


def build_keyboard(tasks: list[str], selected: set, confirm_label: str = "Done ✅") -> InlineKeyboardMarkup:
    buttons = []
    for i, task in enumerate(tasks):
        prefix = "✅ " if i in selected else "☐  "
        buttons.append([InlineKeyboardButton(prefix + task, callback_data=f"toggle:{i}")])
    buttons.append([InlineKeyboardButton(confirm_label, callback_data="confirm")])
    return InlineKeyboardMarkup(buttons)


async def send_morning_poll(context: ContextTypes.DEFAULT_TYPE) -> None:
    tasks = load_tasks()
    today = date.today().strftime("%A, %B %d")
    text = f"📅 *{today}* — Which tasks are you tackling today?"
    msg = await context.bot.send_message(
        chat_id=TELEGRAM_CHAT_ID,
        text=text,
        reply_markup=build_keyboard(tasks, set()),
        parse_mode="Markdown",
    )
    key = str(msg.message_id)
    mark_morning_poll_sent(key)
    sessions[TELEGRAM_CHAT_ID] = ChecklistSession(
        poll_type="morning",
        message_id=key,
        display_tasks=tasks,
        selected=set(),
    )
    print(f"[{date.today().isoformat()}] Morning checklist sent (msg: {key})")


async def send_evening_poll(context: ContextTypes.DEFAULT_TYPE) -> None:
    tasks = load_tasks()
    planned_indices = get_planned_tasks_for_today()

    if planned_indices:
        display_tasks = [tasks[i] for i in planned_indices if i < len(tasks)]
        intro = "Which of your planned tasks did you complete?"
    else:
        display_tasks = tasks
        intro = "Which tasks did you complete today?"

    if not display_tasks:
        display_tasks = tasks
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
