#!/usr/bin/env python3
"""
One-time Google Calendar OAuth setup.

Steps:
1. Go to https://console.cloud.google.com
2. Create a project → Enable "Google Calendar API"
3. Create OAuth 2.0 credentials (Desktop app) → download as credentials.json
4. Set GOOGLE_CREDENTIALS_PATH=credentials.json in your .env (or put it here)
5. Run:  python setup_calendar.py
6. Complete the browser login — token.json is saved automatically.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

SCOPES = ["https://www.googleapis.com/auth/calendar"]
CREDS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
TOKEN_PATH = Path(__file__).parent / "token.json"


def main():
    from google_auth_oauthlib.flow import InstalledAppFlow

    if not Path(CREDS_PATH).exists():
        print(f"ERROR: credentials file not found at '{CREDS_PATH}'")
        print("Download it from Google Cloud Console → APIs & Services → Credentials")
        return

    flow = InstalledAppFlow.from_client_secrets_file(CREDS_PATH, SCOPES)
    creds = flow.run_local_server(port=0)
    TOKEN_PATH.write_text(creds.to_json())
    print(f"\n✅ Done! Saved to {TOKEN_PATH}")
    print("Your bot can now create Google Calendar events.")


if __name__ == "__main__":
    main()
