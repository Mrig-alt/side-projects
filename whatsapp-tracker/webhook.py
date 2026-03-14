import json
from flask import Flask, request
from config import WHATSAPP_VERIFY_TOKEN, MY_NUMBER
from tracker import (
    lookup_poll,
    record_morning_vote,
    record_evening_vote,
    get_weekly_summary,
)
from poller import send_text_message

app = Flask(__name__)


# ── Meta webhook verification ─────────────────────────────────────────────────

@app.route("/webhook", methods=["GET"])
def verify():
    """Meta calls this GET during webhook setup to confirm ownership."""
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")
    if mode == "subscribe" and token == WHATSAPP_VERIFY_TOKEN:
        return challenge, 200
    return "Forbidden", 403


# ── Incoming messages ─────────────────────────────────────────────────────────

@app.route("/webhook", methods=["POST"])
def webhook():
    data = request.get_json(silent=True) or {}
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            for msg in change.get("value", {}).get("messages", []):
                _handle_message(msg)
    return "OK", 200


def _handle_message(msg: dict) -> None:
    sender = msg.get("from", "")
    msg_type = msg.get("type", "")

    # Only process messages from our own number
    if sender != MY_NUMBER:
        return

    if msg_type == "text":
        text = msg.get("text", {}).get("body", "").strip().lower()
        if text in ("summary", "week", "report", "stats"):
            send_text_message(get_weekly_summary())
        return

    if msg_type == "interactive":
        _handle_poll_vote(msg)


def _handle_poll_vote(msg: dict) -> None:
    """
    Poll votes arrive as interactive messages with type 'nfm_reply'.
    Meta sends one webhook per vote change (each tap updates the state),
    so we always overwrite with the latest selection.
    """
    interactive = msg.get("interactive", {})
    if interactive.get("type") != "nfm_reply":
        return
    nfm = interactive.get("nfm_reply", {})
    if nfm.get("name") != "poll":
        return

    # Parse selected option IDs from the response JSON
    try:
        response = json.loads(nfm.get("response_json", "{}"))
        selected_indices = [
            int(opt["row_id"]) for opt in response.get("selected_options", [])
        ]
    except (KeyError, ValueError, json.JSONDecodeError):
        return

    # The context.id is the original poll message ID
    original_msg_id = msg.get("context", {}).get("id", "")
    poll_info = lookup_poll(original_msg_id)
    if not poll_info:
        return

    poll_type = poll_info["type"]

    if poll_type == "morning":
        record_morning_vote(original_msg_id, selected_indices)
        # No confirmation message — it's just a planning check-in

    elif poll_type == "evening":
        pct, names = record_evening_vote(original_msg_id, selected_indices)
        _send_completion_feedback(pct, names)


def _send_completion_feedback(pct: int, names: list[str]) -> None:
    if names:
        completed_str = "\n".join(f"  ✅ {n}" for n in names)
    else:
        completed_str = "  (none selected)"

    if pct == 100:
        header = "🏆 Perfect day! 100% complete!"
    elif pct >= 80:
        header = f"🔥 {pct}% — Almost perfect, great work!"
    elif pct >= 60:
        header = f"💪 {pct}% — Solid progress!"
    elif pct >= 40:
        header = f"⚡ {pct}% — Keep pushing, you've got this!"
    elif pct > 0:
        header = f"🌱 {pct}% — Small wins still count!"
    else:
        header = "🌅 0% today — rest up and come back stronger!"

    send_text_message(f"{header}\n\n{completed_str}")


@app.route("/health", methods=["GET"])
def health():
    return "OK", 200
