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

## Thread 0 State

The app currently uses typed static demo data. Treat the UI as the contract for later persistence, scoring, parser, outreach, and briefing threads.

Preserve these root planning files unless the user explicitly asks to change them:

- `PROMPT.md`
- `SPEC.md`
- `WORKFLOW.md`
- `STYLE.md`
- `TASTE.md`

## Visual Direction

Use the liquid-glass system in `src/styles/glass.css` and `src/components/glass/*`. Keep glass readable: high-contrast text, subtle borders, inner highlights, soft shadows, and no decorative clutter that hides listing facts.

## Engineering Notes

- Keep implementation typed and boring.
- Prefer existing components and data shapes before inventing new ones.
- Be honest about stubs and future official-data boundaries.
- Run `npm run build` before handing off meaningful UI changes.
