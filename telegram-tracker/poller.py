from datetime import date
from telegram.ext import ContextTypes
from config import TELEGRAM_CHAT_ID, load_tasks
from tracker import mark_morning_poll_sent, mark_evening_poll_sent, get_planned_tasks_for_today

_MAX_POLL_OPTIONS = 10  # Telegram limit


async def send_morning_poll(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Morning poll: full task list — user selects which tasks they plan to do today."""
    tasks = load_tasks()
    if len(tasks) > _MAX_POLL_OPTIONS:
        raise ValueError(
            f"Telegram polls support max {_MAX_POLL_OPTIONS} options "
            f"(got {len(tasks)}). Trim your tasks.json."
        )

    today = date.today().strftime("%A, %B %d")
    question = f"📅 {today} — Which tasks are you doing today?"
    msg = await context.bot.send_poll(
        chat_id=TELEGRAM_CHAT_ID,
        question=question,
        options=tasks,
        is_anonymous=False,
        allows_multiple_answers=True,
    )
    mark_morning_poll_sent(msg.poll.id)
    print(f"[{date.today().isoformat()}] Morning poll sent (id: {msg.poll.id})")


async def send_evening_poll(context: ContextTypes.DEFAULT_TYPE) -> None:
    """Evening poll: shows only today's planned tasks. Falls back to full list if morning skipped."""
    tasks = load_tasks()
    planned_indices = get_planned_tasks_for_today()

    if planned_indices is not None:
        poll_tasks = [tasks[i] for i in planned_indices if i < len(tasks)]
        intro = "Which of your planned tasks did you complete?"
    else:
        poll_tasks = tasks
        intro = "Which tasks did you complete today?"

    if not poll_tasks:
        poll_tasks = tasks
        planned_indices = None
        intro = "Which tasks did you complete today?"

    today = date.today().strftime("%A, %B %d")
    question = f"✅ {today} — {intro}"
    msg = await context.bot.send_poll(
        chat_id=TELEGRAM_CHAT_ID,
        question=question,
        options=poll_tasks,
        is_anonymous=False,
        allows_multiple_answers=True,
    )
    mark_evening_poll_sent(msg.poll.id, planned_indices)
    print(f"[{date.today().isoformat()}] Evening poll sent (id: {msg.poll.id})")


async def send_text_message(context: ContextTypes.DEFAULT_TYPE, text: str) -> None:
    await context.bot.send_message(
        chat_id=TELEGRAM_CHAT_ID,
        text=text,
        parse_mode="Markdown",
    )
