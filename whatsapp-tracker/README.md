# WhatsApp Progress Tracker

Two native WhatsApp polls per day — tap to plan, tap to log. All responses saved to a JSON file automatically.

## Flow

```
08:00  Morning poll   → "Which tasks are you doing today?" (tick your plan)
21:00  Evening poll   → "Which tasks did you complete?"   (tick what you did)
                           ↓ only shows tasks you planned in the morning
21:00  Sunday         → Automatic weekly summary sent to you
       Any time       → Text "summary" to get your 7-day stats
```

Progress is logged to `progress.json` automatically after each evening poll vote.

---

## Setup

### 1. Meta WhatsApp Cloud API (free tier is enough)

1. Go to [developers.facebook.com](https://developers.facebook.com) and create an app (type: **Business**).
2. Add the **WhatsApp** product to the app.
3. Under **WhatsApp → API Setup**, find your:
   - **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Temporary access token** (or generate a permanent one) → `WHATSAPP_API_TOKEN`
4. Add your personal WhatsApp number as a test recipient in the sandbox.

### 2. Configure

```bash
cp .env.example .env
# Fill in: WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
#          WHATSAPP_VERIFY_TOKEN, MY_WHATSAPP_NUMBER,
#          MORNING_POLL_TIME, EVENING_POLL_TIME, TIMEZONE
```

### 3. Customise your tasks

Edit `tasks.json` (max 12 items — WhatsApp poll limit):

```json
{
  "tasks": [
    "Morning routine",
    "Exercise",
    "Deep work session",
    "Learning / reading",
    "Evening review"
  ]
}
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Run on your VPS

```bash
python run.py
```

### 6. Register the webhook with Meta

In the Meta Developer console → **WhatsApp → Configuration → Webhook**:

- **Callback URL**: `http://<your-vps-ip>:5000/webhook`
- **Verify Token**: the same value as `WHATSAPP_VERIFY_TOKEN` in your `.env`
- Subscribe to the **messages** field

### 7. Run as a background service (systemd)

```bash
# Edit User and WorkingDirectory paths in the service file first
sudo cp whatsapp-tracker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-tracker
sudo systemctl start whatsapp-tracker
```

---

## CLI

```bash
python run.py                 # Start the server
python run.py --morning-now   # Fire the morning poll immediately
python run.py --evening-now   # Fire the evening poll immediately
python run.py --summary       # Print weekly summary to terminal
```

---

## Progress file (`progress.json`)

```json
{
  "2026-03-14": {
    "morning": {
      "poll_msg_id": "wamid.xxx",
      "sent_at": "2026-03-14T08:00:00",
      "planned_task_indices": [0, 2, 4],
      "voted_at": "2026-03-14T08:12:34"
    },
    "evening": {
      "poll_msg_id": "wamid.yyy",
      "sent_at": "2026-03-14T21:00:00",
      "planned_task_indices": [0, 2, 4],
      "completed_task_indices": [0, 4],
      "completed_task_names": ["Morning routine", "Evening review"],
      "percentage": 67,
      "voted_at": "2026-03-14T21:28:11",
      "status": "completed"
    }
  }
}
```
