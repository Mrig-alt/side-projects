from apscheduler.schedulers.background import BackgroundScheduler
from config import POLL_TIME, TIMEZONE
from poller import send_poll
from tracker import get_weekly_summary
from poller import send_message


def _send_weekly_summary():
    send_message(get_weekly_summary())


def start_scheduler() -> BackgroundScheduler:
    hour, minute = map(int, POLL_TIME.split(":"))
    scheduler = BackgroundScheduler(timezone=TIMEZONE)

    # Daily poll
    scheduler.add_job(send_poll, "cron", hour=hour, minute=minute, id="daily_poll")

    # Weekly summary every Sunday at the poll time
    scheduler.add_job(
        _send_weekly_summary,
        "cron",
        day_of_week="sun",
        hour=hour,
        minute=minute + 1,  # 1 minute after the daily poll
        id="weekly_summary",
    )

    scheduler.start()
    print(f"Scheduler started — polls at {POLL_TIME} {TIMEZONE} daily.")
    return scheduler
