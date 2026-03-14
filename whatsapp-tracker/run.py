#!/usr/bin/env python3
"""
WhatsApp Progress Tracker — entry point.

Usage:
  python run.py                 Start the server (scheduler + webhook)
  python run.py --morning-now   Send the morning task-selection poll now
  python run.py --evening-now   Send the evening completion poll now
  python run.py --summary       Print the weekly summary to stdout
"""
import sys
import signal
from config import WEBHOOK_PORT


def main() -> None:
    arg = sys.argv[1] if len(sys.argv) > 1 else None

    if arg == "--morning-now":
        from poller import send_morning_poll
        send_morning_poll()
        return

    if arg == "--evening-now":
        from poller import send_evening_poll
        send_evening_poll()
        return

    if arg == "--summary":
        from tracker import get_weekly_summary
        print(get_weekly_summary())
        return

    from scheduler import start_scheduler
    from webhook import app

    scheduler = start_scheduler()

    def shutdown(sig, frame):
        print("\nShutting down...")
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print(f"Webhook server listening on :{WEBHOOK_PORT}")
    print("Point Twilio/Meta webhook to: http://<your-vps-ip>:{WEBHOOK_PORT}/webhook")
    app.run(host="0.0.0.0", port=WEBHOOK_PORT)


if __name__ == "__main__":
    main()
