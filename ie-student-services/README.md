# IE Student Services

> A peer marketplace where current IE students help incoming students settle in — and get paid for it.

## The problem

Every year, a new IMBA or MIM cohort arrives in Madrid. They need the same things:
- A flat (and have no idea which neighbourhoods are safe, close to IE, or worth the price)
- Answers to the same hundred questions the previous cohort already answered
- Help navigating Spanish bureaucracy (NIE, bank accounts, SIM cards)
- Recommendations for tutors, study groups, or specific subject help

Right now this all happens informally over WhatsApp groups, which means:
- Knowledge evaporates when a cohort graduates
- Help is inconsistent — some students get great advice, most get nothing
- There's no way for helpful students to be compensated for their time

## The idea

A lightweight platform where:

### 1. House hunting help
- Outgoing students post flat listings or area guides before they leave
- Incoming students book a 1:1 call or in-person tour with someone who lived there
- Platform facilitates booking + payment (€15–30/session)

### 2. Calendar-linked paid bookings
- Students list services: tutoring, CV review, interview prep, city orientation, NIE appointment help
- Incoming students book a timeslot via the platform (synced to Google Calendar)
- Payment handled at booking; platform takes a small fee

### 3. Knowledge handoff
- Graduating students fill in structured "knowledge cards": flat tips, professor insights, club recommendations, what they wish they'd known
- Searchable by cohort, programme, and topic
- Survives after they graduate — a living wiki built by students, for students

## Why this works at IE specifically

IE has high international student turnover (most programmes are 1–2 years), a dense urban campus, and students who are generally entrepreneurially minded. The community is tight enough that trust exists; the knowledge gap between cohorts is large enough that the service is genuinely valuable.

## Status

Description only. No code yet. Waiting for validation with a few incoming students.

## Stack (planned)

- Next.js (App Router)
- Supabase
- Stripe for payments
- Google Calendar API for booking sync
