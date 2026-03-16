#!/usr/bin/env python3
"""
Telegram Progress Tracker — entry point.

Usage:
  python run.py                 Start the bot (scheduler + long polling)
  python run.py --morning-now   Send the morning task-selection poll now
  python run.py --evening-now   Send the evening completion poll now
  python run.py --summary       Print the weekly summary to stdout
"""
import sys
import asyncio
from telegram import Bot
from telegram.ext import Application, PollAnswerHandler
from config import TELEGRAM_BOT_TOKEN


async def _send_poll_now(poll_type: str) -> None:
    """Helper to fire a poll immediately from the CLI without starting the full bot."""
    class _Ctx:
        def __init__(self, bot):
            self.bot = bot

    async with Bot(token=TELEGRAM_BOT_TOKEN) as bot:
        ctx = _Ctx(bot)
        if poll_type == "morning":
            from poller import send_morning_poll
            await send_morning_poll(ctx)
        else:
            from poller import send_evening_poll
            await send_evening_poll(ctx)


def main() -> None:
    arg = sys.argv[1] if len(sys.argv) > 1 else None

    if arg == "--morning-now":
        asyncio.run(_send_poll_now("morning"))
        return

    if arg == "--evening-now":
        asyncio.run(_send_poll_now("evening"))
        return

    if arg == "--summary":
        from tracker import get_weekly_summary
        print(get_weekly_summary())
        return

    from handlers import handle_poll_answer
    from scheduler import setup_jobs

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(PollAnswerHandler(handle_poll_answer))
    setup_jobs(app)

    print("Bot started — polling for updates. Press Ctrl+C to stop.")
    app.run_polling()


if __name__ == "__main__":
    main()
