# Stoop Build Prompt

You are working in a new repository named `stoop-app`.

Build Stoop: a local-first, liquid-glass New York City apartment command center.

## Mission

Create a working version zero that Hunter can use for his real apartment search.

Stoop is not a marketplace, scraper, broker customer relationship manager, or chatbot-first application. It is a personal command center for turning chaotic apartment listings into a ranked, actionable pipeline.

The product must help Hunter do three things faster:

1. Capture serious listings.
2. Decide which listings deserve action.
3. Move fast on the best candidates.

If a feature does not improve that loop, cut it.

## Core Loop

1. Capture a listing from pasted text, pasted web-address context, broker email text, or manual entry.
2. Parse the listing into structured fields.
3. Let the user edit parsed fields before saving.
4. Score the listing deterministically against a search profile.
5. Show the listing on a ranked Today dashboard.
6. Move the listing through a candidate pipeline.
7. Generate outreach drafts for manual sending.
8. Track tours and application readiness.
9. Keep the interface calm, readable, and visually distinctive.

## Stack

Use:

- Next.js
- TypeScript
- Tailwind CSS, the Cascading Style Sheets utility framework
- Custom Cascading Style Sheets liquid-glass system
- SQLite local database
- Drizzle Object Relational Mapper
- OpenAI server routes when `OPENAI_API_KEY` exists
- Deterministic fallback behavior when no OpenAI key exists
- Vitest

Do not create a monorepo.

Ask before installing dependencies that require network access.

## Hard Constraints

Do not build:

- Automated scraping
- Website terms bypasses
- Autonomous browsing
- Automatic message sending
- Public authentication
- Payments
- Broker marketplace features
- Native mobile application
- Roommate matching
- Lease signing
- Sensitive document storage
- Fake live New York City data integrations

Keep the engineering boring, typed, local-first, and maintainable. Taste belongs in the product and interface, not in clever infrastructure.

## Product Screens

Build these screens:

1. Today dashboard
2. Inbox and capture page
3. Candidate Board
4. Listing Detail page
5. Tours page or tour section
6. Application Readiness section

### Today Dashboard

The Today screen answers one question:

```text
What should Hunter do next?
```

It must include:

- Top candidates
- Needs outreach
- Needs follow-up
- Scheduled tours
- Recently killed listings
- Application readiness
- Daily briefing

Each candidate card must show:

- Score
- Eligibility
- Rent
- Neighborhood
- Status
- Next action
- Main risk
- Move-in fit

### Inbox and Capture

The Inbox captures:

- Listing web address used only as context
- Pasted listing text
- Broker email or text message
- Manual entry

The primary action is `Parse Listing`.

After parsing, show an editable review step before saving. Every extracted field must be editable.

Screenshot upload may appear only as a disabled or clearly stubbed future control.

### Candidate Board

Use this exact listing status set:

- `new`
- `contacted`
- `tour_scheduled`
- `toured`
- `applied`
- `dead`
- `leased`

Each board card must show:

- Title
- Rent
- Neighborhood
- Score
- Eligibility
- Status
- Next action
- Risk pill
- Last updated time

### Listing Detail

The Listing Detail page is the decision page.

It must include:

- Listing summary
- Score breakdown
- Hard filters
- Strengths
- Risks
- Open questions
- Outreach draft panel
- Tour checklist
- Notes
- Building-risk panel
- Decision actions

Decision actions:

- Contact
- Follow up
- Schedule tour
- Mark toured
- Apply
- Kill

### Tours

Track tour records with:

- Listing
- Start time
- End time
- Notes
- Checklist
- Post-tour verdict

Tour checklist:

- Noise
- Light
- Smell
- Water pressure
- Heat or air conditioning
- Cell signal
- Laundry
- Trash area
- Package area
- Street feel
- Building condition
- Stairs or elevator
- Broker answers

### Application Readiness

Track readiness only. Do not upload or store sensitive documents.

Checklist:

- Photo identification ready
- Employment letter ready
- Recent pay stubs ready
- Bank statements ready
- Landlord reference ready
- Credit screenshot or report ready
- Guarantor documents ready, if needed
- Pet documents ready, if needed

## Visual Direction

Stoop should feel like:

```text
Apple Weather + visionOS glass + Linear discipline + New York City apartment urgency
```

It should not feel like:

- Real estate Pinterest
- A glassmorphism demo
- A generic software as a service dashboard
- An artificial intelligence chat wrapper

Use:

- Frosted translucent panels
- Large rounded corners
- Subtle borders
- Inner highlights
- Soft shadows
- High-contrast readability layers
- Small saturated accents
- Dense, scannable apartment data

Critical apartment data must never sit directly on chaotic imagery. Readability beats decoration every time.

The Today screen must make the next action obvious without needing explanation text.

## Scoring

Implement deterministic scoring in `src/lib/scoring.ts`.

Separate hard filters from weighted score.

Hard filters include:

- Rent exceeds max budget beyond tolerance
- Impossible move-in date
- Hard-no neighborhood
- Missing address after parse
- Suspicious or unresolved fee language
- Obvious scam language
- Already unavailable

Weighted score:

- 30 points: location and commute
- 25 points: price
- 15 points: apartment fit
- 10 points: move-in fit
- 10 points: risk
- 5 points: responsiveness
- 5 points: subjective pull

Return:

- `eligible`
- `totalScore`, from 0 to 100
- `scoreBreakdown`
- `hardFilters`
- `strengths`
- `risks`
- `openQuestions`
- `confidence`

An unaffordable or ineligible listing may be stored, but it must be visually marked and ranked accordingly. A beautiful unaffordable apartment is not a strong candidate.

## Server Workflows

Implement workflows as plain typed server functions. Do not add an agent framework.

Required functions:

- `parseListing(input)`
- `scoreListing(listing, profile)`
- `draftOutreach(listing, profile, kind)`
- `generateDailyBriefing(listings, tours, profile)`

### Parser

The parser must:

- Handle pasted listing text
- Handle broker-email-like text
- Accept web-address context without scraping
- Extract structured fields
- Return confidence
- Flag fees and red flags
- Generate open questions
- Use deterministic fallback behavior when `OPENAI_API_KEY` is absent

### Outreach

Generate drafts for:

- First contact
- Follow-up
- Fee clarification
- Tour request
- Post-tour interest

Never send automatically.

### Daily Briefing

Generate a daily briefing that includes:

- Best candidates
- Follow-up queue
- Dead or risky listings
- Upcoming tours
- Application-readiness gaps
- Recommended next actions

## New York City Rental Logic

Encode local rental assumptions carefully:

- Flag landlord-side broker fee language for clarification.
- Flag unclear tenant-paid fees.
- Treat rent stabilization as possible or unknown unless verified.
- Stub official building-risk integrations honestly.
- Do not claim live New York City Department of Housing Preservation and Development, Department of Buildings, or 311 data unless implemented and tested.

## Files to Create or Update

Create or update:

- `README.md`
- `AGENTS.md`
- `.env.example`
- `docs/product.md`
- `docs/design-system.md`
- `docs/agent-workflows.md`
- `docs/nyc-rental-rules.md`
- `docs/operating-loop.md`
- `src/styles/glass.css`
- `src/app` routes
- `src/components/glass/*`
- `src/components/listings/*`
- `src/components/board/*`
- `src/components/inbox/*`
- `src/components/briefing/*`
- `src/server/db/*`
- `src/server/agents/*`
- `src/lib/scoring.ts`
- `tests/scoring.test.ts`
- `tests/parser-fallback.test.ts`
- `tests/fixtures/listings/*`

## Implementation Sequence

1. Inspect the current directory.
2. If the repository is empty, propose the exact scaffold command before running it.
3. Scaffold the Next.js TypeScript application.
4. Add `AGENTS.md` with concise repository guidance.
5. Add documentation.
6. Add the liquid-glass design system.
7. Add realistic demo New York City listing data.
8. Build the static Today dashboard and Candidate Board.
9. Add SQLite, Drizzle, schema, and local persistence.
10. Add listing capture and create, read, update, delete routes.
11. Add deterministic scoring and tests.
12. Add parser route with OpenAI-backed implementation and fallback parser.
13. Add Listing Detail page.
14. Add outreach draft generation.
15. Add tour checklist and application-readiness tracker.
16. Run lint, tests, and build.
17. Summarize what works, what is stubbed, and what the next thread should do.

## Acceptance Criteria

Design:

- The application looks visually distinctive on first run.
- The glass interface remains readable.
- The Today screen makes the next action obvious.
- Demo data feels like realistic New York City apartment-search data.
- The application is usable on a phone browser.

Engineering:

- TypeScript is clean.
- Scoring logic is deterministic and tested.
- Parser fallback is tested.
- No fake live integrations exist.
- No dead buttons exist without clear disabled or stubbed states.
- `README.md` contains local run instructions.
- Tests pass.
- Build passes.

## Subagent Policy

Do not spawn subagents during the initial implementation.

After the first working application exists, ask before spawning read-only review subagents for:

- Interface quality and readability
- Data model quality
- Scoring reliability
- Workflow reliability
- Test coverage
