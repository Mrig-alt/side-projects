import json
from pathlib import Path
from telegram import Update
from telegram.ext import ContextTypes
from config import TASKS_FILE, load_tasks
from tracker import (
    record_morning_vote,
    record_evening_vote,
    get_weekly_summary,
)
from poller import build_keyboard
from state import sessions


# ── Checklist toggle / confirm ────────────────────────────────────────────────

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = query.message.chat_id
    data = query.data

    session = sessions.get(chat_id)
    if not session:
        await query.answer("Session expired — wait for the next scheduled checklist.")
        return

    if data.startswith("toggle:"):
        idx = int(data.split(":")[1])
        if idx in session.selected:
            session.selected.discard(idx)
        else:
            session.selected.add(idx)
        keyboard = build_keyboard(
            session.display_tasks,
            session.selected,
            confirm_label="Submit ✅" if session.poll_type == "evening" else "Done ✅",
        )
        await query.edit_message_reply_markup(keyboard)
        await query.answer()

    elif data == "confirm":
        selected = sorted(session.selected)

        if session.poll_type == "morning":
            record_morning_vote(session.message_id, selected)
            task_lines = "\n".join(
                f"• {session.display_tasks[i]}" for i in selected
            ) or "_(nothing selected)_"
            await query.edit_message_text(
                f"📋 Locked in for today:\n{task_lines}\n\nGood luck 💪",
                parse_mode="Markdown",
            )

        elif session.poll_type == "evening":
            pct, completed = record_evening_vote(session.message_id, selected)
            if completed:
                task_lines = "\n".join(f"✅ {t}" for t in completed)
            else:
                task_lines = "_(nothing ticked)_"
            await query.edit_message_text(
                f"🎯 *{pct}% done today*\n\n{task_lines}",
                parse_mode="Markdown",
            )

        del sessions[chat_id]
        await query.answer("Saved!")


# ── Task management commands ──────────────────────────────────────────────────

def _save_tasks(tasks: list[str]) -> None:
    TASKS_FILE.write_text(json.dumps({"tasks": tasks}, indent=2))


async def cmd_tasks(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """List all tasks with their index numbers."""
    tasks = load_tasks()
    if not tasks:
        await update.message.reply_text("No tasks yet. Use /addtask to add some.")
        return
    lines = "\n".join(f"{i + 1}. {t}" for i, t in enumerate(tasks))
    await update.message.reply_text(f"📋 *Your tasks:*\n{lines}", parse_mode="Markdown")


async def cmd_addtask(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/addtask <task name>"""
    task = " ".join(context.args).strip()
    if not task:
        await update.message.reply_text("Usage: /addtask Go for a 30-min walk")
        return
    tasks = load_tasks()
    tasks.append(task)
    _save_tasks(tasks)
    await update.message.reply_text(f"✅ Added: _{task}_\nYou now have {len(tasks)} tasks.", parse_mode="Markdown")


async def cmd_removetask(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/removetask <number>  — use /tasks to see numbers"""
    if not context.args or not context.args[0].isdigit():
        await update.message.reply_text("Usage: /removetask 3  (use /tasks to see numbers)")
        return
    idx = int(context.args[0]) - 1
    tasks = load_tasks()
    if idx < 0 or idx >= len(tasks):
        await update.message.reply_text(f"No task #{idx + 1}. Use /tasks to see the list.")
        return
    removed = tasks.pop(idx)
    _save_tasks(tasks)
    await update.message.reply_text(f"🗑 Removed: _{removed}_", parse_mode="Markdown")


async def cmd_summary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(get_weekly_summary(), parse_mode="Markdown")
