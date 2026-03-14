from datetime import date
from twilio.rest import Client
from config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM, MY_NUMBER, load_tasks
from tracker import mark_poll_sent


def _client() -> Client:
    return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def send_poll() -> None:
    tasks = load_tasks()
    today = date.today().strftime("%A, %B %d")
    task_lines = "\n".join(f"{i + 1}. {task}" for i, task in enumerate(tasks))

    body = (
        f"📋 *Daily Progress Check-in*\n"
        f"📅 {today}\n\n"
        f"Here are today's tasks:\n\n"
        f"{task_lines}\n\n"
        f"Reply with:\n"
        f"• Task numbers you finished (e.g. *1 3 5*)\n"
        f"• *all* — everything done ✅\n"
        f"• *none* — nothing done today\n"
        f"• A percentage (e.g. *75%*)\n\n"
        f"You got this! 💪"
    )

    _client().messages.create(body=body, from_=TWILIO_FROM, to=MY_NUMBER)
    mark_poll_sent()
    print(f"[{date.today().isoformat()}] Daily poll sent.")


def send_message(body: str) -> None:
    _client().messages.create(body=body, from_=TWILIO_FROM, to=MY_NUMBER)
