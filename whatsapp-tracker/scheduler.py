from apscheduler.schedulers.background import BackgroundScheduler
from config import MORNING_POLL_TIME, EVENING_POLL_TIME, TIMEZONE
from poller import send_morning_poll, send_evening_poll, send_text_message
from tracker import get_weekly_summary


def _send_weekly_summary() -> None:
    send_text_message(get_weekly_summary())


def start_scheduler() -> BackgroundScheduler:
    m_hour, m_min = map(int, MORNING_POLL_TIME.split(":"))
    e_hour, e_min = map(int, EVENING_POLL_TIME.split(":"))

    scheduler = BackgroundScheduler(timezone=TIMEZONE)

    # Daily morning poll — task selection
    scheduler.add_job(send_morning_poll, "cron", hour=m_hour, minute=m_min, id="morning_poll")

    # Daily evening poll — completion check-in
    scheduler.add_job(send_evening_poll, "cron", hour=e_hour, minute=e_min, id="evening_poll")

    # Weekly summary every Sunday, 2 minutes after the evening poll
    scheduler.add_job(
        _send_weekly_summary,
        "cron",
        day_of_week="sun",
        hour=e_hour,
        minute=(e_min + 2) % 60,
        id="weekly_summary",
    )

    scheduler.start()
    print(f"Scheduler started:")
    print(f"  Morning poll (task selection): {MORNING_POLL_TIME} {TIMEZONE}")
    print(f"  Evening poll (completion):     {EVENING_POLL_TIME} {TIMEZONE}")
    print(f"  Weekly summary:                Sundays at {EVENING_POLL_TIME} {TIMEZONE}")
    return scheduler
