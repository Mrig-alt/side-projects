from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from config import load_tasks, load_task_objects, save_task_objects
from tracker import (
    record_morning_vote,
    record_evening_vote,
    update_task_stats,
    get_weekly_summary,
)
from poller import build_keyboard
from state import sessions, pending_adds, PendingAdd


# ── Checklist toggle / confirm / add-type callbacks ───────────────────────────

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = query.message.chat_id
    data = query.data

    # ── Task type selection after /addtask ────────────────────────────────────
    if data.startswith("add_type:"):
        pending = pending_adds.pop(chat_id, None)
        if not pending:
            await query.answer("Expired — run /addtask again.")
            return
        task_type = "recurring" if data == "add_type:recurring" else "one-off"
        tasks = load_task_objects()
        tasks.append({"name": pending.name, "type": task_type, "completed": 0, "missed": 0})
        save_task_objects(tasks)
        label = "🔁 recurring" if task_type == "recurring" else "1️⃣ one-off"
        await query.edit_message_text(
            f'✅ Added *"{pending.name}"* as a {label} task.',
            parse_mode="Markdown",
        )
        await query.answer()
        return

    # ── Checklist toggle / confirm ────────────────────────────────────────────
    session = sessions.get(chat_id)
    if not session:
        await query.answer("Session expired — wait for the next scheduled checklist.")
        return

    if data.startswith("toggle:"):
        idx = int(data.split(":")[1])
        session.selected.discard(idx) if idx in session.selected else session.selected.add(idx)
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
            pct, completed_names = record_evening_vote(session.message_id, selected)

            # Map display indices back to real task indices for stat tracking
            if session.planned_indices is not None:
                all_original = session.planned_indices
                completed_original = [
                    session.planned_indices[i]
                    for i in selected if i < len(session.planned_indices)
                ]
            else:
                all_original = list(range(len(session.display_tasks)))
                completed_original = list(selected)

            removed = update_task_stats(all_original, completed_original)

            task_lines = "\n".join(f"✅ {t}" for t in completed_names) or "_(nothing ticked)_"
            removed_note = (
                f"\n\n🗑 Auto-removed one-off: {', '.join(f'_{r}_' for r in removed)}"
                if removed else ""
            )
            await query.edit_message_text(
                f"🎯 *{pct}% done today*\n\n{task_lines}{removed_note}",
                parse_mode="Markdown",
            )

        del sessions[chat_id]
        await query.answer("Saved!")


# ── Task management commands ──────────────────────────────────────────────────

async def cmd_tasks(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    tasks = load_task_objects()
    if not tasks:
        await update.message.reply_text("No tasks yet. Use /addtask to add some.")
        return
    lines = []
    for i, t in enumerate(tasks):
        icon = "🔁" if t.get("type") == "recurring" else "1️⃣"
        done = t.get("completed", 0)
        missed = t.get("missed", 0)
        total = done + missed
        streak = f"✅{done} ❌{missed}" if total else "no data yet"
        lines.append(f"{i + 1}. {icon} {t['name']} — {streak}")
    await update.message.reply_text(
        "📋 *Your tasks:*\n" + "\n".join(lines),
        parse_mode="Markdown",
    )


async def cmd_addtask(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    task = " ".join(context.args).strip()
    if not task:
        await update.message.reply_text("Usage: /addtask Go for a 30-min walk")
        return
    pending_adds[update.effective_chat.id] = PendingAdd(name=task)
    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("🔁 Recurring", callback_data="add_type:recurring"),
        InlineKeyboardButton("1️⃣ One-off", callback_data="add_type:oneoff"),
    ]])
    await update.message.reply_text(
        f'Is *"{task}"* a recurring or one-off task?',
        reply_markup=keyboard,
        parse_mode="Markdown",
    )


async def cmd_removetask(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args or not context.args[0].isdigit():
        await update.message.reply_text("Usage: /removetask 3  (use /tasks to see numbers)")
        return
    idx = int(context.args[0]) - 1
    tasks = load_task_objects()
    if idx < 0 or idx >= len(tasks):
        await update.message.reply_text(f"No task #{idx + 1}. Use /tasks to see the list.")
        return
    removed = tasks.pop(idx)
    save_task_objects(tasks)
    await update.message.reply_text(f"🗑 Removed: _{removed['name']}_", parse_mode="Markdown")


async def cmd_summary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(get_weekly_summary(), parse_mode="Markdown")
