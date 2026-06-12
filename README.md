# Stoop

Stoop is a local-first apartment command center for finding a New York City lease fast.

It is not a marketplace, scraper, broker CRM, authentication product, payment product, or chatbot wrapper. Version zero is a working local Next.js app with local SQLite persistence, deterministic listing scoring, a shadcn/ui operational interface, a Today command screen, Candidate Board, Inbox capture surface, Listing Detail page, Tours page, and application-readiness tracking.

## Run Locally

```bash
npm install
npm run db:init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To clear local listings and return to an empty real-data database:

```bash
npm run db:reset
```

`npm run db:seed` remains as a compatibility alias for database initialization only. It does not insert listings.

## Build

```bash
npm run build
```

## What Works

- Listings persist locally through SQLite and Drizzle.
- Database initialization creates required tables without fake listings.
- Today handles an empty database and tells you to capture the first real listing.
- Today ranks saved candidates and surfaces the next action, follow-ups, tour-status listings, risks, and readiness gaps from local records.
- Candidate Board shows the exact allowed statuses: `new`, `contacted`, `tour_scheduled`, `toured`, `applied`, `dead`, and `leased`.
- Candidate Board handles zero listings with a direct capture action.
- Listing Detail shows summary, score breakdown, hard filters, strengths, risks, open questions, outreach facts, tour checklist template, notes, building-risk status, and decision actions.
- Status changes persist through server actions.
- Inbox parses pasted listing text or broker messages into an editable review, then saves the reviewed candidate.
- Parser fallback works without `OPENAI_API_KEY`; when a key exists, the parser can use an OpenAI-backed extraction path and falls back safely on errors.
- No outreach history or generated messages are stored until real draft storage is implemented.
- Daily briefing is generated deterministically from local listings and status queues.
- Tours page shows real listings marked `tour_scheduled` or `toured` and does not invent tour times, notes, checklist state, or verdicts.
- Application readiness shows checklist definitions only; no ready state is pretended or stored.
- The interface uses shadcn/ui components in `src/components/ui/*`.

## Stubbed For Later Threads

- Draft storage and screenshot upload are labeled as future/stubbed surfaces.
- Message sending remains out of scope; any future generated outreach must be copyable draft text only.
- Tour time/checklist/verdict persistence is not implemented yet.
- Application readiness persistence is not implemented yet.
- Building-risk data is explicitly unknown; no live HPD, DOB, 311, or rent-stabilization integrations exist.
- No Supabase, authentication, payments, scraping, autonomous browsing, automatic messaging, or sensitive document storage has been added.
