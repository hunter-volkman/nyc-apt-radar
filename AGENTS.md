# Stoop Agent Guide

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing code that depends on App Router, route handlers, layout/page props, caching, or CSS behavior.
<!-- END:nextjs-agent-rules -->

## Product Boundary

Build Stoop as a local-first New York City apartment command center. The core loop is:

```text
capture listing -> parse listing -> score listing -> choose next action -> track outcome
```

Do not add Supabase, authentication, payments, scraping, autonomous browsing, automatic message sending, public broker marketplace features, native mobile work, lease signing, roommate matching, fake live integrations, or sensitive document storage.

## Current State

The app uses local SQLite persistence with Drizzle and deterministic listing scoring. Parser, outreach, upload, and draft-storage surfaces are still bounded stubs unless a later thread explicitly implements them.

Preserve these root planning files unless the user explicitly asks to change them:

- `PROMPT.md`
- `SPEC.md`
- `WORKFLOW.md`
- `STYLE.md`
- `TASTE.md`

## Visual Direction

Use shadcn/ui as the design-system foundation in `src/components/ui/*`. Stoop should feel like a calm, dense, high-quality apartment command center, not a glassmorphism demo or generic SaaS dashboard. Keep rent, neighborhood, address, score, eligibility, status, risk, next action, tour time, and readiness gaps visible.

Avoid giant heroes, marketing composition, decorative glass, animation-heavy UI, cards nested inside cards, and controls that look active but do nothing. Stubbed controls must be disabled or clearly labeled.

## Engineering Notes

- Keep implementation typed and boring.
- Prefer existing components and data shapes before inventing new ones.
- Be honest about stubs and future official-data boundaries.
- Do not change database schema, scoring rules, parser behavior, outreach behavior, or persistence behavior during visual-only work.
- Run `npm run build` before handing off meaningful UI changes.
