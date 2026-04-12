# JobRadar

> Track internships and job applications — live data, no manual updates.

## What it is

JobRadar is a personal job-hunt command centre. Instead of maintaining a spreadsheet, you connect your email and it automatically surfaces new applications, interview invites, rejections, and offer letters in a unified feed. You can also manually add leads and track custom stages.

## Core features (planned)

- **Auto-import** — parse Gmail/Outlook for application confirmations, interview invites, and status emails
- **Pipeline board** — Kanban-style view: Applied → Screening → Interview → Offer → Closed
- **Company cards** — role, salary range, recruiter contact, notes, next action
- **Reminders** — nudge when a stage has been stale for N days
- **Analytics** — conversion rates per stage, response rate by source

## Status

Code exists locally. Not yet pushed to GitHub.

To be pushed to this repository once the initial scaffolding is cleaned up.

## Stack (planned)

- Next.js (App Router)
- Supabase (Postgres + Auth)
- Drizzle ORM
- Gmail API / Outlook Graph API for email parsing
