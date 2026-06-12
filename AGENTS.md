# NYC Apt Radar Agent Guide

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing code that depends on App Router, route handlers, layout/page props, caching, or CSS behavior.
<!-- END:nextjs-agent-rules -->

## Product Boundary

Build NYC Apt Radar as a local-first New York City apartment scanner. The core loop is:

```text
watched source event -> parse listing -> score listing -> notify if hot -> act fast -> track outcome
```

Do not add Supabase, authentication, payments, scraping, autonomous browsing, automatic message sending, public broker marketplace features, native mobile work, lease signing, roommate matching, fake live integrations, or sensitive document storage.

## Current State

The app uses local SQLite persistence with Drizzle, deterministic listing scoring, watched source-event ingestion, and ntfy notification support. Parser, outreach, upload, map, commute, and draft-storage surfaces are bounded future work unless a later thread explicitly implements them.

Preserve these root planning files unless the user explicitly asks to change them:

- `PROMPT.md`
- `SPEC.md`
- `WORKFLOW.md`
- `STYLE.md`
- `TASTE.md`

## Visual Direction

Use shadcn/ui as the design-system foundation in `src/components/ui/*`. NYC Apt Radar should feel like a calm, dense, high-quality scanner console, not a glassmorphism demo or generic SaaS dashboard. Keep loop health, hot leads, source, rent, neighborhood, address, score, status, blocker, push state, and next action visible.

Avoid giant heroes, marketing composition, decorative glass, animation-heavy UI, cards nested inside cards, and controls that look active but do nothing. Stubbed controls must be disabled or clearly labeled.

## Engineering Notes

- Keep implementation typed and boring.
- Prefer existing components and data shapes before inventing new ones.
- Be honest about stubs and future official-data boundaries.
- Do not add fake source data, fake live integrations, fake map pins, or controls that imply the loop can do work it cannot do.
- Run `npm run build` before handing off meaningful UI changes.
