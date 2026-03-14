#!/usr/bin/env python3
"""
Entry point for the WhatsApp Progress Tracker.

Usage:
  python run.py              # Start webhook server + scheduler
  python run.py --send-now   # Send today's poll immediately and exit
  python run.py --summary    # Print weekly summary to stdout and exit
"""
import sys
import signal
from config import WEBHOOK_PORT


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None

    if arg == "--send-now":
        from poller import send_poll
        send_poll()
        return

    if arg == "--summary":
        from tracker import get_weekly_summary
        print(get_weekly_summary())
        return

    # Normal mode: start scheduler + Flask webhook server
    from scheduler import start_scheduler
    from webhook import app

    scheduler = start_scheduler()

    def shutdown(sig, frame):
        print("\nShutting down scheduler...")
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print(f"Webhook server listening on port {WEBHOOK_PORT}...")
    print("Configure Twilio to POST to: http://<your-vps-ip>:{WEBHOOK_PORT}/webhook")
    app.run(host="0.0.0.0", port=WEBHOOK_PORT)


if __name__ == "__main__":
    main()
