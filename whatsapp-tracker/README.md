# WhatsApp Progress Tracker

Sends you a daily WhatsApp check-in poll, collects your reply, and logs progress to a JSON file. Runs as a persistent server on a VPS.

## How it works

1. Every day at your configured time, a WhatsApp message is sent listing your tasks.
2. You reply with which tasks you completed.
3. The webhook server receives your reply, logs it to `progress.json`, and sends back a confirmation.
4. Every Sunday, a weekly summary is automatically sent.
5. Text `summary` at any time to get your weekly stats.

## Setup

### 1. Twilio WhatsApp Sandbox

1. Sign up at [twilio.com](https://www.twilio.com) (free trial works).
2. Go to **Messaging → Try it out → Send a WhatsApp message**.
3. Follow the instructions to connect your WhatsApp number to the sandbox (you'll send a join code to `+1 415 523 8886`).
4. Note your **Account SID** and **Auth Token** from the Console dashboard.

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Twilio credentials and WhatsApp number
```

### 3. Customize your tasks

Edit `tasks.json`:
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

Then point Twilio's webhook URL to your server:

- Go to **Messaging → Settings → WhatsApp Sandbox Settings**
- Set **"When a message comes in"** to: `http://<your-vps-ip>:5000/webhook`
- Method: `HTTP POST`

### 6. Run as a background service (systemd)

```bash
# Edit the paths in the service file first
sudo cp whatsapp-tracker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-tracker
sudo systemctl start whatsapp-tracker
```

## Usage

| Reply | Meaning |
|---|---|
| `1 3 5` | Tasks 1, 3, and 5 completed |
| `all` | All tasks done (100%) |
| `none` | Nothing done today (0%) |
| `75%` | 75% progress |
| `summary` | Get your 7-day summary |

## Progress file

All responses are saved to `progress.json`:

```json
{
  "2026-03-14": {
    "sent_at": "2026-03-14T21:00:00",
    "responded_at": "2026-03-14T21:35:12",
    "tasks_completed": [1, 3, 5],
    "tasks_completed_names": ["Morning routine", "Deep work session", "Evening review"],
    "total_tasks": 5,
    "percentage": 60,
    "raw_reply": "1 3 5",
    "status": "completed"
  }
}
```

## CLI commands

```bash
python run.py              # Start the server (webhook + scheduler)
python run.py --send-now   # Trigger today's poll immediately
python run.py --summary    # Print weekly summary to terminal
```
