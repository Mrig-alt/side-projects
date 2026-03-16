from telegram import Update
from telegram.ext import ContextTypes
from tracker import lookup_poll, record_morning_vote, record_evening_vote


async def handle_poll_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Receives poll answer updates and records them in progress.json."""
    answer = update.poll_answer
    poll_id = answer.poll_id
    selected = answer.option_ids

    info = lookup_poll(poll_id)
    if not info:
        return

    if info["type"] == "morning":
        record_morning_vote(poll_id, selected)
        print(f"Morning vote recorded: options {selected}")
    elif info["type"] == "evening":
        pct, completed = record_evening_vote(poll_id, selected)
        print(f"Evening vote recorded: {pct}% — {completed}")
