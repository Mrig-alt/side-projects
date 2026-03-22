import json
from datetime import date, datetime, timedelta
from pathlib import Path
from config import PROGRESS_FILE, POLL_INDEX_FILE, load_tasks
import excel_store


def _load(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def _save(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2))


# ── Poll index: msg_id → {date, type} ────────────────────────────────────────

def register_poll(msg_id: str, poll_type: str, day: str = None, task_ids: list[str] | None = None) -> None:
    day = day or date.today().isoformat()
    index = _load(POLL_INDEX_FILE)
    entry: dict = {"date": day, "type": poll_type}
    if task_ids is not None:
        entry["task_ids"] = task_ids  # Todoist task IDs in poll-option order
    index[msg_id] = entry
    _save(POLL_INDEX_FILE, index)


def lookup_poll(msg_id: str) -> dict | None:
    return _load(POLL_INDEX_FILE).get(msg_id)


# ── Progress ──────────────────────────────────────────────────────────────────

def mark_morning_poll_sent(msg_id: str, task_ids: list[str] | None = None) -> None:
    day = date.today().isoformat()
    register_poll(msg_id, "morning", day, task_ids=task_ids)
    progress = _load(PROGRESS_FILE)
    progress.setdefault(day, {})["morning"] = {
        "poll_msg_id": msg_id,
        "sent_at": datetime.now().isoformat(),
        "planned_task_indices": None,
        "planned_task_ids": None,
        "voted_at": None,
    }
    _save(PROGRESS_FILE, progress)


def mark_evening_poll_sent(msg_id: str, planned_indices: list[int] | None, task_ids: list[str] | None = None) -> None:
    day = date.today().isoformat()
    register_poll(msg_id, "evening", day, task_ids=task_ids)
    progress = _load(PROGRESS_FILE)
    progress.setdefault(day, {})["evening"] = {
        "poll_msg_id": msg_id,
        "sent_at": datetime.now().isoformat(),
        "planned_task_indices": planned_indices,
        "planned_task_ids": None,
        "completed_task_indices": None,
        "completed_task_ids": None,
        "completed_task_names": None,
        "percentage": None,
        "voted_at": None,
        "status": "pending",
    }
    _save(PROGRESS_FILE, progress)


def get_planned_tasks_for_today() -> list[int] | None:
    """Return today's morning poll selections (task indices), or None if not answered."""
    today = date.today().isoformat()
    progress = _load(PROGRESS_FILE)
    return progress.get(today, {}).get("morning", {}).get("planned_task_indices")


def record_morning_vote(msg_id: str, selected_indices: list[int]) -> None:
    info = lookup_poll(msg_id)
    if not info:
        return
    day = info["date"]
    task_ids = info.get("task_ids")

    # Resolve Todoist task IDs for selected options
    planned_task_ids = None
    if task_ids:
        planned_task_ids = [task_ids[i] for i in selected_indices if i < len(task_ids)]

    progress = _load(PROGRESS_FILE)
    progress.setdefault(day, {}).setdefault("morning", {}).update({
        "planned_task_indices": selected_indices,
        "planned_task_ids": planned_task_ids,
        "voted_at": datetime.now().isoformat(),
    })
    _save(PROGRESS_FILE, progress)

    # Mirror to Excel so Make.com / OneDrive can read it
    tasks = load_tasks()
    excel_store.write_morning_selections(day, tasks, selected_indices)


def record_evening_vote(
    msg_id: str,
    selected_poll_indices: list[int],
) -> tuple[int, list[str]]:
    """
    Record evening completion vote.

    selected_poll_indices are positions within the evening poll options
    (which may be a subset of all tasks if a morning poll was answered).

    Returns (percentage, completed_task_names).
    """
    from config import TODOIST_CLOSE_ON_COMPLETE

    info = lookup_poll(msg_id)
    if not info:
        return 0, []

    day = info["date"]
    tasks = load_tasks()
    task_ids = info.get("task_ids")  # Todoist task IDs in poll-option order
    progress = _load(PROGRESS_FILE)
    evening = progress.get(day, {}).get("evening", {})
    planned = evening.get("planned_task_indices")  # original task indices

    if planned is not None:
        # Map poll option positions back to real task indices
        actual_indices = [planned[i] for i in selected_poll_indices if i < len(planned)]
        denominator = len(planned)
    else:
        actual_indices = selected_poll_indices
        denominator = len(tasks)

    pct = round(len(actual_indices) / denominator * 100) if denominator else 0
    completed_names = [tasks[i] for i in actual_indices if i < len(tasks)]

    # Resolve completed Todoist task IDs
    completed_task_ids = None
    if task_ids:
        completed_task_ids = [
            task_ids[i] for i in selected_poll_indices if i < len(task_ids)
        ]

    progress.setdefault(day, {}).setdefault("evening", {}).update({
        "completed_task_indices": actual_indices,
        "completed_task_ids": completed_task_ids,
        "completed_task_names": completed_names,
        "percentage": pct,
        "voted_at": datetime.now().isoformat(),
        "status": "completed",
    })
    _save(PROGRESS_FILE, progress)

    # Close completed tasks in Todoist if configured
    if completed_task_ids and TODOIST_CLOSE_ON_COMPLETE:
        try:
            import todoist
            for tid in completed_task_ids:
                todoist.close_todoist_task(tid)
        except Exception as e:
            print(f"[warn] Todoist close failed: {e}")

    # Mirror to Excel so Make.com / OneDrive can read it
    excel_store.write_evening_completions(day, tasks, actual_indices, pct)

    return pct, completed_names


def get_weekly_summary() -> str:
    progress = _load(PROGRESS_FILE)
    today = date.today()
    week_days = [(today - timedelta(days=i)).isoformat() for i in range(6, -1, -1)]

    lines = ["📊 *Weekly Summary*\n"]
    total_pct = 0
    counted = 0

    for day in week_days:
        evening = progress.get(day, {}).get("evening", {})
        status = evening.get("status")
        if status == "completed":
            pct = evening.get("percentage", 0)
            total_pct += pct
            counted += 1
            bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
            lines.append(f"{day}: {bar} {pct}%")
        elif status == "pending":
            lines.append(f"{day}: ⏳ No response")
        else:
            lines.append(f"{day}: — No data")

    if counted:
        avg = round(total_pct / counted)
        lines.append(f"\n📈 7-day average: {avg}%")
    else:
        lines.append("\n📭 No data recorded yet.")

    return "\n".join(lines)
