import json
from datetime import date, datetime, timedelta
from pathlib import Path
from config import PROGRESS_FILE, POLL_INDEX_FILE, load_tasks, load_task_objects, save_task_objects


def _load(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def _save(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2))


# ── Poll index: poll_id → {date, type} ───────────────────────────────────────

def register_poll(poll_id: str, poll_type: str, day: str = None) -> None:
    day = day or date.today().isoformat()
    index = _load(POLL_INDEX_FILE)
    index[poll_id] = {"date": day, "type": poll_type}
    _save(POLL_INDEX_FILE, index)


def lookup_poll(poll_id: str) -> dict | None:
    return _load(POLL_INDEX_FILE).get(poll_id)


# ── Progress ──────────────────────────────────────────────────────────────────

def mark_morning_poll_sent(poll_id: str) -> None:
    day = date.today().isoformat()
    register_poll(poll_id, "morning", day)
    progress = _load(PROGRESS_FILE)
    progress.setdefault(day, {})["morning"] = {
        "poll_id": poll_id,
        "sent_at": datetime.now().isoformat(),
        "planned_task_indices": None,
        "voted_at": None,
    }
    _save(PROGRESS_FILE, progress)


def mark_evening_poll_sent(poll_id: str, planned_indices: list[int] | None) -> None:
    day = date.today().isoformat()
    register_poll(poll_id, "evening", day)
    progress = _load(PROGRESS_FILE)
    progress.setdefault(day, {})["evening"] = {
        "poll_id": poll_id,
        "sent_at": datetime.now().isoformat(),
        "planned_task_indices": planned_indices,
        "completed_task_indices": None,
        "completed_task_names": None,
        "percentage": None,
        "voted_at": None,
        "status": "pending",
    }
    _save(PROGRESS_FILE, progress)


def get_planned_tasks_for_today() -> list[int] | None:
    today = date.today().isoformat()
    progress = _load(PROGRESS_FILE)
    return progress.get(today, {}).get("morning", {}).get("planned_task_indices")


def record_morning_vote(poll_id: str, selected_indices: list[int]) -> None:
    info = lookup_poll(poll_id)
    if not info:
        return
    progress = _load(PROGRESS_FILE)
    progress.setdefault(info["date"], {}).setdefault("morning", {}).update({
        "planned_task_indices": selected_indices,
        "voted_at": datetime.now().isoformat(),
    })
    _save(PROGRESS_FILE, progress)


def record_evening_vote(
    poll_id: str,
    selected_poll_indices: list[int],
) -> tuple[int, list[str]]:
    info = lookup_poll(poll_id)
    if not info:
        return 0, []

    day = info["date"]
    tasks = load_tasks()
    progress = _load(PROGRESS_FILE)
    evening = progress.get(day, {}).get("evening", {})
    planned = evening.get("planned_task_indices")

    if planned is not None:
        actual_indices = [planned[i] for i in selected_poll_indices if i < len(planned)]
        denominator = len(planned)
    else:
        actual_indices = selected_poll_indices
        denominator = len(tasks)

    pct = round(len(actual_indices) / denominator * 100) if denominator else 0
    completed_names = [tasks[i] for i in actual_indices if i < len(tasks)]

    progress.setdefault(day, {}).setdefault("evening", {}).update({
        "completed_task_indices": actual_indices,
        "completed_task_names": completed_names,
        "percentage": pct,
        "voted_at": datetime.now().isoformat(),
        "status": "completed",
    })
    _save(PROGRESS_FILE, progress)
    return pct, completed_names


def update_task_stats(
    all_original_indices: list[int],
    completed_original_indices: list[int],
) -> list[str]:
    """
    Increment completed/missed counts for tasks that appeared in the evening checklist.
    Removes completed one-off tasks from tasks.json.
    Returns the names of any one-off tasks that were removed.
    """
    tasks = load_task_objects()
    completed_set = set(completed_original_indices)
    removed_names = []
    kept = []

    for i, task in enumerate(tasks):
        if i in all_original_indices:
            if i in completed_set:
                task["completed"] = task.get("completed", 0) + 1
                if task.get("type") == "recurring":
                    task["current_streak"] = task.get("current_streak", 0) + 1
                    if task["current_streak"] > task.get("best_streak", 0):
                        task["best_streak"] = task["current_streak"]
                elif task.get("type") == "one-off":
                    removed_names.append(task["name"])
                    continue  # drop from list
            elif task.get("type") == "recurring":
                task["missed"] = task.get("missed", 0) + 1
                task["current_streak"] = 0
        kept.append(task)

    save_task_objects(kept)
    return removed_names


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
