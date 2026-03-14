import re
import json
from datetime import date, datetime, timedelta
from config import PROGRESS_FILE, load_tasks


def load_progress() -> dict:
    if not PROGRESS_FILE.exists():
        return {}
    return json.loads(PROGRESS_FILE.read_text())


def save_progress(data: dict) -> None:
    PROGRESS_FILE.write_text(json.dumps(data, indent=2))


def mark_poll_sent() -> None:
    today = date.today().isoformat()
    progress = load_progress()
    progress.setdefault(today, {}).update({
        "sent_at": datetime.now().isoformat(),
        "status": "pending",
    })
    save_progress(progress)


def parse_reply(reply_text: str, tasks: list[str]) -> tuple[list[int], int]:
    """
    Parse a WhatsApp reply into (completed_task_numbers, percentage).

    Accepted formats:
      - "all" / "done"        → all tasks complete
      - "none" / "nothing"    → 0% complete
      - "75%" or "75 %"       → percentage, marks first N tasks as proxy
      - "1 3 5" / "1,3,5"    → specific task numbers completed
    """
    text = reply_text.strip().lower()
    total = len(tasks)

    if text in ("all", "done", "yes", "✅", "everything"):
        return list(range(1, total + 1)), 100

    if text in ("none", "nothing", "no", "0", "❌", "nope"):
        return [], 0

    if "%" in text:
        nums = re.findall(r"\d+", text)
        if nums:
            pct = min(int(nums[0]), 100)
            n = round(total * pct / 100)
            return list(range(1, n + 1)), pct
        return [], 0

    # Parse task numbers
    nums = re.findall(r"\d+", text)
    completed = sorted({int(n) for n in nums if 1 <= int(n) <= total})
    pct = round(len(completed) / total * 100) if total else 0
    return completed, pct


def record_response(reply_text: str) -> tuple[list[int], int, list[str]]:
    tasks = load_tasks()
    today = date.today().isoformat()
    progress = load_progress()

    completed, pct = parse_reply(reply_text, tasks)
    completed_names = [tasks[i - 1] for i in completed]

    entry = progress.get(today, {})
    entry.update({
        "responded_at": datetime.now().isoformat(),
        "tasks_completed": completed,
        "tasks_completed_names": completed_names,
        "total_tasks": len(tasks),
        "percentage": pct,
        "raw_reply": reply_text,
        "status": "completed",
    })
    progress[today] = entry
    save_progress(progress)
    return completed, pct, tasks


def get_weekly_summary() -> str:
    progress = load_progress()
    today = date.today()
    week_days = [(today - timedelta(days=i)).isoformat() for i in range(6, -1, -1)]

    lines = ["📊 *Weekly Summary*\n"]
    total_pct = 0
    counted = 0

    for day in week_days:
        entry = progress.get(day, {})
        status = entry.get("status")
        if status == "completed":
            pct = entry.get("percentage", 0)
            total_pct += pct
            counted += 1
            filled = pct // 10
            bar = "█" * filled + "░" * (10 - filled)
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
