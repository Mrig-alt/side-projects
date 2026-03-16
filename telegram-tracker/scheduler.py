from datetime import time
import pytz
from telegram.ext import Application
from poller import send_morning_poll, send_evening_poll, send_text_message
from tracker import get_weekly_summary
from config import MORNING_POLL_TIME, EVENING_POLL_TIME, TIMEZONE


async def _send_weekly_summary(context) -> None:
    await send_text_message(context, get_weekly_summary())


def setup_jobs(app: Application) -> None:
    tz = pytz.timezone(TIMEZONE)
    m_hour, m_min = map(int, MORNING_POLL_TIME.split(":"))
    e_hour, e_min = map(int, EVENING_POLL_TIME.split(":"))

    jq = app.job_queue
    jq.run_daily(send_morning_poll, time(m_hour, m_min, tzinfo=tz), name="morning_poll")
    jq.run_daily(send_evening_poll, time(e_hour, e_min, tzinfo=tz), name="evening_poll")
    jq.run_daily(
        _send_weekly_summary,
        time(e_hour, (e_min + 2) % 60, tzinfo=tz),
        days=(6,),  # Sunday only
        name="weekly_summary",
    )

    print("Scheduler ready:")
    print(f"  Morning poll: {MORNING_POLL_TIME} {TIMEZONE}")
    print(f"  Evening poll: {EVENING_POLL_TIME} {TIMEZONE}")
    print(f"  Weekly summary: Sundays at {e_hour}:{(e_min + 2) % 60:02d} {TIMEZONE}")
