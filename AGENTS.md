# NYC Apt Radar Agent Guide

## Product Boundary

Build NYC Apt Radar as a local-first New York City apartment discovery loop:

```text
watched source -> source event -> extract listing -> finalize fields -> estimate commute -> score -> notify if hot -> draft outreach -> track status
```

Do not add Supabase, authentication, payments, CAPTCHA bypassing, stealth automation, credentialed scraping, automatic message sending, public broker marketplace features, native mobile work, lease signing, roommate matching, fake live integrations, or sensitive document storage.

Plain fetch against explicitly configured public URLs is allowed. If a source blocks normal access, record the failure honestly.

## Current State

The app is a terminal-first TypeScript project with local SQLite persistence, deterministic scoring, watched source ingestion, subway commute estimates, and ntfy notification support.

There is no web app. Do not reintroduce Next.js, React, shadcn/ui, Tailwind, Drizzle, or browser automation unless the user explicitly changes the product direction.

Preserve these root planning files unless the user explicitly asks to change them:

- `PROMPT.md`
- `SPEC.md`
- `WORKFLOW.md`

## Architecture

- `src/core/*`: listing model, preferences, field finalization, transit, scoring, ranking, outreach.
- `src/discovery/*`: source config, source collection, extraction, agent loop.
- `src/discovery/intake.ts`: one-off URL, file, text, and stdin intake.
- `src/notifications/*`: ntfy notification behavior and failed-attempt recording.
- `src/diagnostics/*`: operator readiness checks.
- `src/storage/*`: SQLite schema and repositories.
- `scripts/*`: terminal commands.
- `tests/*`: loop behavior tests.
- `data/preferences.example.json`: operator-editable preference and commute-target template.
- `data/source-events/appointment-leads.json`: real operator-provided starter source event.

## Engineering Notes

- Keep implementation typed and boring.
- Prefer deterministic scoring over LLM ranking.
- Unknown listing facts lower confidence; they do not automatically reject a listing.
- Use OpenAI only at extraction boundaries. Structured JSON source events may bypass OpenAI because they are already data.
- Do not send outreach automatically.
- Do not add fake listings. Starter source data must be user-supplied.
- Keep comments sparse; prefer clear names and small functions.
- Run `npm run test`, `npm run typecheck`, and `npm run build` before handoff.
