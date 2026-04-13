# Network Agent

A **local-first** LinkedIn Action Tracker + People Dataset AI agent.

Stores everything in a local SQLite database. No dashboard, no LinkedIn scraping, no automation — just structured tracking of *your* actions and the people in your network.

---

## Guardrails

- **No LinkedIn scraping** – no crawling LinkedIn pages or bypassing auth.
- **No automated actions** – no automatic messages, connection requests, comments, or likes.
- **No credential storage** – no passwords or session cookies.
- **Scraping only from URLs you explicitly provide** – respects `robots.txt`, rate limits, no CAPTCHAs.

---

## Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Database | SQLite via SQLModel + Alembic |
| CLI | Typer + Rich |
| Scraping | requests + BeautifulSoup4 (Playwright optional) |
| AI | Anthropic Python SDK (Messages API) |

---

## Installation

```bash
# Clone and install
git clone <repo>
cd <repo>
pip install -e .

# For Playwright support (JS-heavy pages)
pip install -e ".[playwright]"
playwright install chromium

# For development / tests
pip install -e ".[dev]"
```

---

## Configuration

Copy and fill in the example files:

```bash
cp .env.example .env
cp config.yaml.example config.yaml
```

**.env** (minimum required):
```env
ANTHROPIC_API_KEY=sk-ant-...
```

**config.yaml** controls rate limits, allowed scrape domains, scoring weights, and defaults.

---

## Quick Start

```bash
# 1. Initialise the database (creates network_agent.db)
network_agent init-db

# 2. Add a person
network_agent add-person \
  --name "Alice Smith" \
  --classification "Professional" \
  --company "Acme Corp" \
  --role "Head of Product" \
  --email "alice@acme.com" \
  --linkedin "https://linkedin.com/in/alicesmith" \
  --tie 4 --alignment 5 --influence 4 \
  --tags "product,ml"

# Or interactively:
network_agent add-person --interactive

# 3. Log an action you performed
network_agent log-action \
  --type "message_sent" \
  --person-id 1 \
  --context "Followed up from NeurIPS dinner" \
  --outcome "No response yet" \
  --follow-up "2026-03-10"

# Use fuzzy name matching instead of --person-id:
network_agent log-action \
  --type "profile_view" \
  --target-name "Alice Smith" \
  --context "Pre-call research"

# 4. List people (with optional filters)
network_agent list-people
network_agent list-people --status Active --classification Professional
network_agent list-people --company "Acme" --tags "ml"

# 5. List actions
network_agent list-actions
network_agent list-actions --person-id 1 --type message_sent
network_agent list-actions --since 2026-01-01 --until 2026-02-01

# 6. Import from CSV/JSON
network_agent import-actions --file ./my_export.csv --dry-run
network_agent import-actions --file ./my_export.csv --no-dry-run

# 7. Export
network_agent export --out ./exports/
# → exports/people_<timestamp>.csv
# → exports/actions_<timestamp>.csv

# 8. Find and merge duplicates
network_agent reconcile               # dry-run preview
network_agent reconcile --no-dry-run  # interactive merge
```

---

## Import File Schema

### CSV (header required)

```
action_timestamp, action_type, platform, target_name, linkedin_url,
email, target_url, context, outcome, follow_up_date, metadata_json
```

### JSON

```json
[
  {
    "action_timestamp": "2026-01-15T10:30:00",
    "action_type": "profile_view",
    "platform": "LinkedIn",
    "target_name": "Alice Smith",
    "linkedin_url": "https://linkedin.com/in/alicesmith",
    "context": "Pre-call research"
  }
]
```

---

## Data Model

### `people`

| Column | Type | Notes |
|---|---|---|
| `person_id` | int PK | Auto |
| `full_name` | text | Required |
| `classification` | text | Comma-sep: `Professional,Educational,Personal` |
| `subgroup` | text | Community/subgroup |
| `relationship_type` | text | e.g. "mentor", "peer" |
| `company_or_school` | text | |
| `role_or_program` | text | |
| `location` | text | |
| `email` | text | Nullable |
| `linkedin_url` | text | Nullable, used for identity resolution |
| `tie_strength` | int 1–5 | |
| `alignment` | int 1–5 | |
| `influence` | int 1–5 | |
| `last_interaction_date` | date | |
| `status` | text | `Active / Dormant / Needs Work / Do Not Pursue` |
| `next_action` | text | |
| `notes` | text | |
| `tags` | text | Comma-separated |
| `introduced_by_person_id` | int FK | Self-referential |
| `created_at / updated_at` | datetime | |

### `actions`

| Column | Type | Notes |
|---|---|---|
| `action_id` | int PK | |
| `action_timestamp` | datetime | |
| `action_type` | text | `profile_view / search / follow / connect_request_sent / connect_request_accepted / message_sent / message_received / comment / like / post / share / group_join / event_rsvp / other` |
| `platform` | text | Default `"LinkedIn"` |
| `target_person_id` | int FK | Nullable, links to people |
| `target_name_raw` | text | Stored if person not resolved |
| `target_url` | text | |
| `context` | text | |
| `outcome` | text | |
| `follow_up_date` | date | |
| `metadata_json` | text | JSON string for extras |
| `created_at` | datetime | |

### `sources`

Provenance table for scraped pages (used by `network_agent scrape`).

---

## Identity Resolution

When logging or importing actions, the agent resolves a target to an existing person:

1. **LinkedIn URL match** (exact, normalised)
2. **Email match** (exact)
3. **Fuzzy name match** (RapidFuzz WRatio ≥ 85) + optional company bonus
4. **Ambiguous** → stored as `target_name_raw`, no auto-link

Use `network_agent reconcile` to review and merge unresolved duplicates.

---

## Roadmap (Steps 3–6)

- `network_agent scrape --person-id 17 --url https://example.com/about`
  - robots.txt check, rate limiting, BeautifulSoup / Playwright extraction
  - Anthropic-powered field extraction with **propose-then-apply** diff
- `network_agent summarize-person --person-id 17`
  - Anthropic-generated summary + suggested next action
- `network_agent suggest-next-actions --top 20`
  - Ranked by overdue follow-ups, alignment, influence scores

---

## Running Tests

```bash
pytest tests/ -v
pytest tests/ -v --cov=network_agent --cov-report=term-missing
```

---

## Project Structure

```
network_agent/
├── __init__.py
├── cli/
│   ├── main.py          # CLI entrypoint
│   ├── db_cmd.py        # init-db
│   ├── people_cmd.py    # add-person, list-people, reconcile
│   ├── actions_cmd.py   # log-action, list-actions, import-actions
│   └── export_cmd.py    # export
├── core/
│   ├── config.py        # .env + config.yaml loader
│   ├── database.py      # engine + session factory
│   └── linking.py       # identity resolution
├── models/
│   ├── people.py        # Person SQLModel
│   ├── actions.py       # Action SQLModel
│   └── sources.py       # Source SQLModel
└── migrations/          # Alembic migrations
    └── versions/

tests/
├── conftest.py
├── test_db_init.py
├── test_people_crud.py
├── test_action_logging.py
├── test_dedupe_reconcile.py
└── test_import_export.py
```
