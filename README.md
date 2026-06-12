# NYC Apt Radar

NYC Apt Radar is a local-first scanner for finding a New York City lease before good listings disappear.

It is not a marketplace, broker CRM, authentication product, payment product, or chatbot wrapper. Version zero is a local Next.js app with SQLite persistence, deterministic scoring, source-event ingestion, ntfy push, copy-only outreach, and a dense Radar console.

## Run Locally

```bash
npm install
npm run db:init
npm run radar:run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To clear local listings and return to an empty real-data database:

```bash
npm run db:reset
```

`npm run db:seed` remains as a compatibility alias for database initialization only. It does not insert listings.

## Radar Loop

NYC Apt Radar ingests source messages from `.txt` or `.eml` files:

```bash
mkdir -p data/source-events
cp ~/Downloads/streeteasy-alert.eml data/source-events/
npm run radar:run
```

For a local watch loop:

```bash
NYC_APT_RADAR_WATCH_INTERVAL_MINUTES=10 npm run radar:watch
```

Optional phone push through the ntfy iOS app:

```bash
NYC_APT_RADAR_NOTIFY_CHANNEL=ntfy
NYC_APT_RADAR_NTFY_TOPIC=nyc-apt-radar-long-random-secret
```

Legacy `APARTMENT_RADAR_*` and `STOOP_*` environment variables are still read as compatibility aliases.

## Build

```bash
npm run build
```

## What Works

- Listings persist locally through SQLite and Drizzle.
- Database initialization creates required tables without fake listings.
- Radar imports watched source messages, dedupes them, scores listings, classifies hot leads, records notification history, and prepares copy-only outreach.
- Radar is the primary UI: loop health, action queue, source ledger, and push history.
- Today and Board remain secondary local views over saved records.
- Board shows the exact allowed statuses: `new`, `contacted`, `tour_scheduled`, `toured`, `applied`, `dead`, and `leased`.
- Listing Detail shows summary, score breakdown, hard filters, strengths, risks, open questions, outreach facts, tour checklist template, notes, building-risk status, and decision actions.
- Status changes persist through server actions.
- Inbox remains a fallback parser surface, but it is no longer the primary scanner workflow.
- Parser fallback works without `OPENAI_API_KEY`; when a key exists, the parser can use an OpenAI-backed extraction path and falls back safely on errors.
- No automatic outreach sending exists. Copyable contact packets are shown for real listings only.
- Daily briefing is generated deterministically from local listings and status queues.
- Tours page shows real listings marked `tour_scheduled` or `toured` and does not invent tour times, notes, checklist state, or verdicts.
- Application readiness shows checklist definitions only; no ready state is pretended or stored.
- The interface uses shadcn/ui components in `src/components/ui/*`.

## Stubbed For Later Threads

- Draft storage and screenshot upload are not implemented.
- Message sending remains out of scope; any future generated outreach must be copyable draft text only.
- Tour time/checklist/verdict persistence is not implemented yet.
- Application readiness persistence is not implemented yet.
- Building-risk data is explicitly unknown; no live HPD, DOB, 311, or rent-stabilization integrations exist.
- No Supabase, authentication, payments, autonomous browsing, automatic messaging, or sensitive document storage has been added.
