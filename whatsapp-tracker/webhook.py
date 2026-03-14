from flask import Flask, request
from tracker import record_response, get_weekly_summary
from poller import send_message

app = Flask(__name__)


@app.route("/webhook", methods=["POST"])
def webhook():
    incoming = request.form.get("Body", "").strip()
    sender = request.form.get("From", "")
    print(f"[webhook] {sender}: {incoming!r}")

    if not incoming:
        return "OK", 200

    if incoming.lower() in ("summary", "week", "report", "stats"):
        send_message(get_weekly_summary())
        return "OK", 200

    completed, pct, tasks = record_response(incoming)

    if completed:
        names = "\n".join(f"  ✅ {tasks[i - 1]}" for i in completed)
        if pct == 100:
            encouragement = "Absolutely crushed it today! 🔥🏆"
        elif pct >= 80:
            encouragement = "Killing it! Almost a perfect day! 💪"
        elif pct >= 60:
            encouragement = "Solid progress. Keep the momentum! 🚀"
        elif pct >= 40:
            encouragement = "Good start — push harder tomorrow! ⚡"
        else:
            encouragement = "Every step counts. Tomorrow is a new day! 🌅"

        reply = (
            f"✅ *Logged for today* ({pct}%)\n\n"
            f"Completed:\n{names}\n\n"
            f"{encouragement}"
        )
    else:
        reply = "📝 Logged: 0% today.\nRest up and come back stronger tomorrow! 🌅"

    send_message(reply)
    return "OK", 200


@app.route("/health", methods=["GET"])
def health():
    return "OK", 200
