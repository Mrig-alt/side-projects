# Lifelong Learning

> All your IMBA course content in one place — built for how students actually learn, not how Blackboard was designed.

## The problem

IE Business School runs on Blackboard. Blackboard is slow, cluttered, buried in nested folders, and impossible to navigate on mobile. Every piece of content — slides, readings, recordings, case studies — is scattered across dozens of separate course shells with no unified search, no progress tracking, and no way to connect related concepts across courses.

Students end up screenshot-pasting into Notion, emailing PDFs to themselves, or just giving up and using the printed packet.

## The idea

A clean, fast content hub that mirrors the IMBA programme structure:

- **Course library** — all courses in one sidebar, not twelve separate Blackboard shells
- **Unified search** — full-text search across slides, readings, and transcripts
- **Progress tracking** — mark sessions complete, see where you left off
- **Mobile-first** — readable on a phone without zooming or horizontal scrolling
- **Cross-linking** — link a Finance concept to where it appears in Strategy, Accounting, etc.
- **Community layer** — peer notes and highlights visible to cohort (optional, toggleable)

## Collaboration

Built with **Sahana Goel** (IE IMBA cohort). She owns content strategy and student-side validation; this repo covers the technical build.

## GTM potential

If the IE cohort finds it valuable, this could expand to:
1. Other IE programmes (MIM, MBA, Executive)
2. Other European business schools with similarly outdated LMS infrastructure
3. White-label for corporate L&D teams running blended learning

Monetisation paths: institutional licence, freemium cohort access, or alumni subscription for content access after graduation.

## Status

Spec stage. No code yet.

## Stack (planned)

- Next.js (App Router)
- Supabase (Postgres + Storage for PDFs/videos)
- Drizzle ORM
- Meilisearch or Postgres full-text search
- Vercel deployment
