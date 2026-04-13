import re
from datetime import date
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


# ── Internal helper ───────────────────────────────────────────────────────────

async def _finalize_dated_task(pending: PendingAdd) -> str:
    """Saves a deadline/birthday task, creates a calendar event, returns confirm text."""
    from google_cal import days_until, countdown_label

    task = {
        "name": pending.name,
        "type": "one-off",
        "task_subtype": pending.task_subtype,
        "due_date": pending.due_date,
        "due_time": pending.due_time,
        "completed": 0,
        "missed": 0,
        "calendar_event_id": None,
    }

    cal_note = ""
    try:
        from google_cal import create_deadline_event, create_birthday_event
        if pending.task_subtype == "birthday":
            event_id = create_birthday_event(pending.name, pending.due_date)
        else:
            event_id = create_deadline_event(pending.name, pending.due_date, pending.due_time)
        task["calendar_event_id"] = event_id
        cal_note = "\n📅 Added to Google Calendar"
    except RuntimeError:
        cal_note = "\n_(Google Calendar not set up — run setup\\_calendar.py to enable)_"
    except Exception as e:
        cal_note = f"\n_(Calendar sync failed: {e})_"

    tasks = load_task_objects()
    tasks.append(task)
    save_task_objects(tasks)

    days = days_until(pending.due_date, pending.task_subtype or "deadline")
    icon = "🎂" if pending.task_subtype == "birthday" else "📌"
    time_part = f" at {pending.due_time}" if pending.due_time else ""

    return (
        f'{icon} Added *"{pending.name}"*\n'
        f'📆 {pending.due_date}{time_part} — {countdown_label(days)}{cal_note}'
    )


# ── Checklist toggle / confirm / add-type callbacks ───────────────────────────

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    chat_id = query.message.chat_id
    data = query.data

    # ── Task type selection after /addtask ────────────────────────────────────
    if data.startswith("add_type:"):
        task_type = data.split(":")[1]

        # Dated types: keep pending, ask for date next
        if task_type in ("deadline", "birthday"):
            pending = pending_adds.get(chat_id)
            if not pending:
                await query.answer("Expired — run /addtask again.")
                return
            pending.task_subtype = task_type
            pending.awaiting = "date"
            icon = "📌" if task_type == "deadline" else "🎂"
            label = "deadline date" if task_type == "deadline" else "birthday / anniversary date"
            await query.edit_message_text(
                f'{icon} *"{pending.name}"* — send me the {label}:\n'
                f'Format: `YYYY-MM-DD` (e.g. `{date.today().isoformat()}`)',
                parse_mode="Markdown",
            )
            await query.answer()
            return

        # Instant types: pop pending and save immediately
        pending = pending_adds.pop(chat_id, None)
        if not pending:
            await query.answer("Expired — run /addtask again.")
            return
        actual_type = "recurring" if task_type == "recurring" else "one-off"
        tasks = load_task_objects()
        tasks.append({"name": pending.name, "type": actual_type, "completed": 0, "missed": 0})
        save_task_objects(tasks)
        label = "🔁 recurring" if actual_type == "recurring" else "1️⃣ one-off"
        await query.edit_message_text(
            f'✅ Added *"{pending.name}"* as a {label} task.',
            parse_mode="Markdown",
        )
        await query.answer()
        return

    # ── Skip time entry during dated task add ─────────────────────────────────
    if data == "add_skip_time":
        pending = pending_adds.pop(chat_id, None)
        if not pending:
            await query.answer("Expired.")
            return
        msg = await _finalize_dated_task(pending)
        await query.edit_message_text(msg, parse_mode="Markdown")
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


# ── Text message handler (for date/time input during /addtask flow) ───────────

async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    pending = pending_adds.get(chat_id)

    if not pending or pending.awaiting not in ("date", "time"):
        return  # not in a multi-step add flow — ignore

    text = update.message.text.strip()

    if pending.awaiting == "date":
        try:
            date.fromisoformat(text)
        except ValueError:
            await update.message.reply_text(
                f"❌ Invalid date. Use `YYYY-MM-DD` (e.g. `{date.today().isoformat()}`):",
                parse_mode="Markdown",
            )
            return
        pending.due_date = text
        pending.awaiting = "time"
        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton("⏭ Skip (all-day)", callback_data="add_skip_time"),
        ]])
        await update.message.reply_text(
            "What time? Send `HH:MM` (24h, e.g. `14:30`) — or skip for an all-day event:",
            reply_markup=keyboard,
            parse_mode="Markdown",
        )

    elif pending.awaiting == "time":
        if not re.match(r"^\d{1,2}:\d{2}$", text):
            await update.message.reply_text(
                "❌ Invalid time. Use `HH:MM` (e.g. `14:30`) — or tap Skip:",
                parse_mode="Markdown",
            )
            return
        h, m = text.split(":")
        if not (0 <= int(h) <= 23 and 0 <= int(m) <= 59):
            await update.message.reply_text(
                "❌ Invalid time. Use `HH:MM` (e.g. `14:30`) — or tap Skip:",
                parse_mode="Markdown",
            )
            return
        pending.due_time = f"{int(h):02d}:{m}"
        pending_adds.pop(chat_id, None)
        msg = await _finalize_dated_task(pending)
        await update.message.reply_text(msg, parse_mode="Markdown")


# ── Task management commands ──────────────────────────────────────────────────

async def cmd_tasks(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    from google_cal import days_until, countdown_label

    tasks = load_task_objects()
    if not tasks:
        await update.message.reply_text("No tasks yet. Use /addtask to add some.")
        return

    lines = []
    for i, t in enumerate(tasks):
        subtype = t.get("task_subtype")
        ttype = t.get("type")

        if subtype in ("deadline", "birthday"):
            icon = "🎂" if subtype == "birthday" else "📌"
            days = days_until(t["due_date"], subtype)
            time_part = f" {t['due_time']}" if t.get("due_time") else ""
            stats = f"due {t['due_date']}{time_part} • {countdown_label(days)}"

        elif ttype == "recurring":
            icon = "🔁"
            done = t.get("completed", 0)
            missed = t.get("missed", 0)
            cs = t.get("current_streak", 0)
            bs = t.get("best_streak", 0)
            streak = f" 🔥{cs}" if cs > 1 else ""
            best = f" _(best: {bs})_" if bs > cs and bs > 1 else ""
            stats = f"✅{done} ❌{missed}{streak}{best}" if (done + missed) else "no data yet"

        else:
            icon = "1️⃣"
            stats = "pending"

        lines.append(f"{i + 1}. {icon} {t['name']} — {stats}")

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
    keyboard = InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🔁 Recurring", callback_data="add_type:recurring"),
            InlineKeyboardButton("1️⃣ One-off", callback_data="add_type:oneoff"),
        ],
        [
            InlineKeyboardButton("📌 Deadline", callback_data="add_type:deadline"),
            InlineKeyboardButton("🎂 Birthday / Anniversary", callback_data="add_type:birthday"),
        ],
    ])
    await update.message.reply_text(
        f'What kind of task is *"{task}"*?',
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

    # Clean up the calendar event if there was one
    if removed.get("calendar_event_id"):
        try:
            from google_cal import delete_event
            delete_event(removed["calendar_event_id"])
        except Exception:
            pass

    await update.message.reply_text(f"🗑 Removed: _{removed['name']}_", parse_mode="Markdown")


async def cmd_edittask(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/edittask <number> <new name>"""
    if len(context.args) < 2 or not context.args[0].isdigit():
        await update.message.reply_text("Usage: /edittask 3 New task name")
        return
    idx = int(context.args[0]) - 1
    new_name = " ".join(context.args[1:]).strip()
    tasks = load_task_objects()
    if idx < 0 or idx >= len(tasks):
        await update.message.reply_text(f"No task #{idx + 1}. Use /tasks to see the list.")
        return
    old_name = tasks[idx]["name"]
    tasks[idx]["name"] = new_name
    save_task_objects(tasks)
    await update.message.reply_text(
        f"✏️ _{old_name}_ → _{new_name}_",
        parse_mode="Markdown",
    )


async def cmd_summary(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(get_weekly_summary(), parse_mode="Markdown")
