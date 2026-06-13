# NYC Apt Radar Agent Guide

## General Comments

Before changing architecture or product behavior, read `SPEC.md`, `README.md`, and `OPERATING_PRINCIPLES.md`.

## Product Boundary

Build NYC Apt Radar as a local-first New York City apartment discovery loop:

```text
StreetEasy search -> discovery event -> extract listing -> finalize fields -> estimate commute -> score -> notify if hot -> draft outreach -> track status
```

Do not add Supabase, authentication, payments, CAPTCHA bypassing, stealth automation, credentialed scraping, automatic message sending, public broker marketplace features, native mobile work, lease signing, roommate matching, fake live integrations, or sensitive document storage.

Plain fetch against explicitly configured StreetEasy public search URLs is allowed. If a search blocks normal access, record the failure honestly.

## Current State

The app is a terminal-first TypeScript project with local SQLite persistence, deterministic scoring, configured StreetEasy search execution, subway commute estimates, and ntfy notification support.

There is no web app. Do not reintroduce Next.js, React, shadcn/ui, Tailwind, Drizzle, or browser automation unless the user explicitly changes the product direction.

## Architecture

- `src/core/*`: listing model, preferences, field finalization, transit, scoring, ranking, outreach.
- `src/discovery/*`: StreetEasy search config, search collection, extraction, agent loop.
- `src/discovery/intake.ts`: one-off URL, structured file, and stdin intake.
- `src/notifications/*`: ntfy notification behavior and failed-attempt recording.
- `src/diagnostics/*`: operator readiness checks.
- `src/storage/*`: SQLite schema and repositories.
- `scripts/*`: terminal commands.
- `tests/*`: loop behavior tests.
- `data/preferences.example.json`: operator-editable preference and commute-target template.
- `data/searches.example.json`: operator-editable StreetEasy search template.

## Engineering Notes

- Keep implementation typed and boring.
- Prefer deterministic scoring over LLM ranking.
- Unknown listing facts lower confidence; they do not automatically reject a listing.
- Do not add model extraction to the autonomous loop. Structured JSON and StreetEasy JSON-LD are the supported extraction surfaces.
- Do not send outreach automatically.
- Do not add fake listings. Starter source data must be user-supplied.
- Keep comments sparse; prefer clear names and small functions.
- Run `npm run test`, `npm run typecheck`, and `npm run build` before handoff.
