import json
from datetime import date, datetime, timedelta
from pathlib import Path
from config import (
    PROGRESS_FILE, POLL_INDEX_FILE, TODOIST_CLOSE_ON_COMPLETE,
    load_tasks, load_task_objects, save_task_objects,
)
import excel_store


def _load(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def _save(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2))


# ── Poll index: poll_id → {date, type, task_ids?, task_names?, task_types?} ───

def register_poll(
    poll_id: str,
    poll_type: str,
    day: str = None,
    task_ids: list[str] | None = None,
    task_names: list[str] | None = None,
    task_types: list[str] | None = None,
) -> None:
    day = day or date.today().isoformat()
    index = _load(POLL_INDEX_FILE)
    entry: dict = {"date": day, "type": poll_type}
    if task_ids is not None:
        entry["task_ids"] = task_ids      # Todoist task IDs in poll-option order
    if task_names is not None:
        entry["task_names"] = task_names  # task display names in poll-option order
    if task_types is not None:
        entry["task_types"] = task_types  # task type strings in poll-option order
    index[poll_id] = entry
    _save(POLL_INDEX_FILE, index)


def lookup_poll(poll_id: str) -> dict | None:
    return _load(POLL_INDEX_FILE).get(poll_id)


# ── Progress ──────────────────────────────────────────────────────────────────

def mark_morning_poll_sent(
    poll_id: str,
    task_names: list[str] | None = None,
    task_types: list[str] | None = None,
    task_ids: list[str] | None = None,
) -> None:
    day = date.today().isoformat()
    register_poll(poll_id, "morning", day, task_ids=task_ids, task_names=task_names, task_types=task_types)
    progress = _load(PROGRESS_FILE)
    progress.setdefault(day, {})["morning"] = {
        "poll_id": poll_id,
        "sent_at": datetime.now().isoformat(),
        "planned_task_indices": None,
        "planned_task_ids": None,
        "voted_at": None,
    }
    _save(PROGRESS_FILE, progress)

    # Step 1: log that these tasks were shown
    if task_names and task_types:
        try:
            excel_store.log_morning_poll_sent(day, task_names, task_types)
        except Exception as e:
            print(f"[warn] Excel log_morning_poll_sent failed: {e}")


def mark_evening_poll_sent(poll_id: str, planned_indices: list[int] | None) -> None:
    day = date.today().isoformat()
    register_poll(poll_id, "evening", day)
    progress = _load(PROGRESS_FILE)
    progress.setdefault(day, {})["evening"] = {
        "poll_id": poll_id,
        "sent_at": datetime.now().isoformat(),
        "planned_task_indices": planned_indices,
        "completed_task_indices": None,
        "completed_task_ids": None,
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

    day = info["date"]
    task_ids = info.get("task_ids")
    task_names = info.get("task_names") or load_tasks()
    task_types = info.get("task_types") or [
        t.get("type", "recurring") for t in load_task_objects()
    ]

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

    # Create Google Calendar events for each planned task (visual day reminders)
    cal_event_ids = {}
    try:
        import google_cal
        for i in selected_indices:
            if i < len(task_names):
                try:
                    event_id = google_cal.create_daily_task_event(task_names[i], day)
                    cal_event_ids[task_names[i]] = event_id
                except Exception:
                    pass
        if cal_event_ids:
            progress = _load(PROGRESS_FILE)
            progress.setdefault(day, {}).setdefault("morning", {})["cal_event_ids"] = cal_event_ids
            _save(PROGRESS_FILE, progress)
    except Exception as e:
        print(f"[warn] Google Calendar daily events failed: {e}")

    # Step 2: log which tasks were planned
    try:
        excel_store.write_morning_selections(day, task_names, task_types, selected_indices)
    except Exception as e:
        print(f"[warn] Excel write_morning_selections failed: {e}")


def record_evening_vote(
    poll_id: str,
    selected_poll_indices: list[int],
) -> tuple[int, list[str]]:
    info = lookup_poll(poll_id)
    if not info:
        return 0, []

    day = info["date"]
    progress = _load(PROGRESS_FILE)
    evening = progress.get(day, {}).get("evening", {})
    planned = evening.get("planned_task_indices")

    # Use morning poll task names — works for both Todoist and local tasks.json
    morning_poll_id = progress.get(day, {}).get("morning", {}).get("poll_id")
    morning_info = lookup_poll(morning_poll_id) if morning_poll_id else None
    task_names = (morning_info.get("task_names") if morning_info else None) or load_tasks()
    morning_task_ids = morning_info.get("task_ids") if morning_info else None

    if planned is not None:
        actual_indices = [planned[i] for i in selected_poll_indices if i < len(planned)]
        denominator = len(planned)
    else:
        actual_indices = selected_poll_indices
        denominator = len(task_names)

    pct = round(len(actual_indices) / denominator * 100) if denominator else 0
    completed_names = [task_names[i] for i in actual_indices if i < len(task_names)]

    # Resolve completed Todoist task IDs from morning poll
    completed_task_ids = None
    if morning_task_ids:
        completed_task_ids = [
            morning_task_ids[i] for i in actual_indices if i < len(morning_task_ids)
        ]

    # Rollover: tasks that were planned this morning but not completed tonight
    rollover_names: list[str] = []
    if planned is not None:
        planned_names = [task_names[i] for i in planned if i < len(task_names)]
        completed_set = set(completed_names)
        rollover_names = [n for n in planned_names if n not in completed_set]

    progress.setdefault(day, {}).setdefault("evening", {}).update({
        "completed_task_indices": actual_indices,
        "completed_task_ids": completed_task_ids,
        "completed_task_names": completed_names,
        "percentage": pct,
        "voted_at": datetime.now().isoformat(),
        "status": "completed",
    })
    progress[day]["rollover"] = rollover_names
    _save(PROGRESS_FILE, progress)

    # Delete today's calendar events for completed tasks
    try:
        import google_cal
        cal_event_ids = progress.get(day, {}).get("morning", {}).get("cal_event_ids", {})
        for name in completed_names:
            if name in cal_event_ids:
                google_cal.delete_event(cal_event_ids[name])
    except Exception as e:
        print(f"[warn] Google Calendar event deletion failed: {e}")

    # Close completed tasks in Todoist if configured
    if completed_task_ids and TODOIST_CLOSE_ON_COMPLETE:
        try:
            import todoist
            for tid in completed_task_ids:
                todoist.close_todoist_task(tid)
        except Exception as e:
            print(f"[warn] Todoist close failed: {e}")

    return pct, completed_names


def update_task_stats(
    all_original_indices: list[int],
    completed_original_indices: list[int],
    poll_id: str | None = None,
) -> list[str]:
    """
    Increment completed/missed counts for tasks that appeared in the evening checklist.
    Removes completed one-off tasks from tasks.json.
    Returns the names of any one-off tasks that were removed.
    Also writes the updated stats to Excel.
    """
    tasks = load_task_objects()
    completed_set = set(completed_original_indices)
    removed_names = []
    kept = []
    today = date.today().isoformat()

    for i, task in enumerate(tasks):
        if i in all_original_indices:
            if i in completed_set:
                task["completed"] = task.get("completed", 0) + 1
                task["last_active"] = today
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

    # Step 3a: write evening completions to Excel Daily Log
    day = today
    task_names = [t["name"] for t in tasks]
    task_types = [t.get("type", "recurring") for t in tasks]
    pct = round(len(completed_original_indices) / len(all_original_indices) * 100) if all_original_indices else 0
    streaks = {t["name"]: t.get("current_streak", 0) for t in kept}

    try:
        excel_store.write_evening_completions(
            day, task_names, task_types,
            completed_original_indices, pct, streaks,
        )
    except Exception as e:
        print(f"[warn] Excel write_evening_completions failed: {e}")

    # Step 3b: refresh Task Stats sheet
    try:
        excel_store.refresh_task_stats(kept)
    except Exception as e:
        print(f"[warn] Excel refresh_task_stats failed: {e}")

    return removed_names


def get_rollover_tasks() -> list[str]:
    """Return task names that were planned but not completed yesterday."""
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    progress = _load(PROGRESS_FILE)
    return progress.get(yesterday, {}).get("rollover", [])


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
