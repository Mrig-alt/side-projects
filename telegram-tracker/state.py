from dataclasses import dataclass, field


@dataclass
class ChecklistSession:
    poll_type: str           # "morning" or "evening"
    message_id: str          # used as key in tracker / progress.json
    display_tasks: list      # task strings shown to user (may be a subset for evening)
    selected: set            # currently toggled indices into display_tasks
    planned_indices: list | None = None  # for evening: maps display index → real task index


@dataclass
class PendingAdd:
    name: str  # task name waiting for type selection (recurring / one-off)


# Keyed by chat_id
sessions: dict[int, ChecklistSession] = {}
pending_adds: dict[int, PendingAdd] = {}
