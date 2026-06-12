# Stoop

Stoop is a local-first apartment command center for finding a New York City lease fast.

It is not a marketplace, scraper, broker CRM, authentication product, payment product, or chatbot wrapper. Version zero is a working local Next.js app with local SQLite persistence, deterministic listing scoring, a shadcn/ui operational interface, a Today command screen, Candidate Board, Inbox capture surface, Listing Detail page, Tours page, and application-readiness tracking.

## Run Locally

```bash
npm install
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

## What Works

- Listings persist locally through SQLite and Drizzle.
- Seed data can be restored with `npm run db:seed`.
- Today ranks candidates and surfaces the next action, follow-ups, tours, risks, and readiness gaps.
- Candidate Board shows the exact allowed statuses: `new`, `contacted`, `tour_scheduled`, `toured`, `applied`, `dead`, and `leased`.
- Listing Detail shows summary, score breakdown, hard filters, strengths, risks, open questions, outreach draft, tour checklist, notes, building-risk status, and decision actions.
- Status changes persist through server actions.
- Inbox parses pasted listing text or broker messages into an editable review, then saves the reviewed candidate.
- Parser fallback works without `OPENAI_API_KEY`; when a key exists, the parser can use an OpenAI-backed extraction path and falls back safely on errors.
- Outreach drafts generate for first contact, follow-up, fee clarification, tour request, and post-tour interest. Drafts are editable text only and are never sent automatically.
- Daily briefing is generated from local listings, tours, follow-ups, risks, and application-readiness gaps. It works without `OPENAI_API_KEY`; when a key exists, it can use an OpenAI-backed generation path and falls back safely on errors.
- Tours page tracks checklist state and verdicts from local data.
- Application readiness tracks checklist state without uploading or storing sensitive documents.
- The interface uses shadcn/ui components in `src/components/ui/*`.

## Stubbed For Later Threads

- Draft storage and screenshot upload are labeled as future/stubbed surfaces.
- Message sending remains out of scope; generated outreach is copyable draft text only.
- Building-risk data is explicitly unknown; no live HPD, DOB, 311, or rent-stabilization integrations exist.
- No Supabase, authentication, payments, scraping, autonomous browsing, automatic messaging, or sensitive document storage has been added.
