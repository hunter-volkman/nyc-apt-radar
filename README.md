# Stoop

Stoop is a local-first apartment command center for finding a New York City lease fast.

It is not a marketplace, scraper, broker CRM, authentication product, payment product, or chatbot wrapper. Version zero is a working local Next.js app with realistic demo data, a liquid-glass visual system, a Today dashboard, a Candidate Board, Inbox capture surface, Listing Detail page, Tours page, and application-readiness tracking.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

## What Works In Thread 0

- Today dashboard ranks realistic demo listings.
- Candidate Board shows the exact allowed statuses: `new`, `contacted`, `tour_scheduled`, `toured`, `applied`, `dead`, and `leased`.
- Listing Detail shows summary, score breakdown, hard filters, strengths, risks, open questions, outreach draft, tour checklist, notes, building-risk status, and decision actions.
- Inbox shows capture inputs and editable parsed-field review.
- Tours page tracks checklist items and verdicts.
- Application readiness tracks checklist state without uploading or storing sensitive documents.
- Liquid-glass design system exists in `src/styles/glass.css` and `src/components/glass/*`.

## Stubbed For Later Threads

- Data is static TypeScript demo data in `src/lib/demo-data.ts`; there is no SQLite persistence yet.
- Scores are demo evaluations, not the final `scoreListing` engine.
- Parse, save, board status changes, and decision action buttons are visual only.
- Outreach drafts are demo drafts and are never sent automatically.
- Building-risk data is explicitly unknown; no live HPD, DOB, 311, or rent-stabilization integrations exist.
- No Supabase, authentication, payments, scraping, autonomous browsing, automatic messaging, or sensitive document storage has been added.

## Next Thread

Thread 1 should add local SQLite persistence with Drizzle: schema, seed data, listing CRUD routes, and status updates while preserving the current interface and visual system.
