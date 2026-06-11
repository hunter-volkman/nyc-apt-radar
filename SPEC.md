# Stoop Product and Engineering Specification

## Product Definition

Name: `Stoop`

Repository: `stoop-app`

One-line description:

```text
Stoop is a liquid-glass apartment command center for finding a New York City lease fast.
```

Tagline:

```text
Your apartment hunt, ranked.
```

Version zero must be a usable local application, not a pitch deck, mockup, marketplace, scraper, or chat wrapper.

## Product Thesis

Stoop should not help Hunter browse more apartments. Browsing is already abundant. The bottleneck is judgment under time pressure.

Stoop should help Hunter:

1. Eliminate weak listings faster.
2. Act on strong listings immediately.
3. Keep follow-up, tours, notes, and application readiness in one local system.

Core loop:

```text
capture listing -> parse listing -> score listing -> choose next action -> track outcome
```

No feature matters until this loop works end to end.

## Primary User

Primary user:

```text
Hunter, actively looking for a New York City apartment under time pressure.
```

Assumed user state:

- Stressed
- Time-constrained
- Decision-fatigued
- Needs clarity
- Needs confidence
- Does not need more feeds to browse

The product should make the search feel finite.

## Version Zero Objective

Version zero succeeds only if Hunter can:

1. Paste five real listings.
2. Parse them into structured fields.
3. Edit parsed fields before saving.
4. Score them against his search profile.
5. Rank them.
6. Move them through a pipeline.
7. Draft outreach messages.
8. Track tours.
9. Kill weak candidates.
10. Decide what to do today.

## Non-Goals

Do not build these in version zero:

- Automated scraping
- Autonomous browsing
- Automatic message sending
- Public user accounts
- Payments
- Broker marketplace features
- Native mobile application
- Roommate matching
- Lease signing
- Sensitive document storage
- Full New York City building-data warehouse
- Fake live integrations

Do not build a future company. Build the tool needed now.

## Core Screens

### Today

The Today screen is the home screen. It answers:

```text
What should Hunter do right now?
```

Required sections:

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

The Today screen should be calm to look at and sharp to use.

### Inbox

The Inbox captures raw listing material.

Supported inputs:

- Listing web address used only as context
- Pasted listing text
- Pasted broker email or message
- Manual entry

Primary action:

```text
Parse Listing
```

After parsing, the user must be able to edit every extracted field before saving.

Screenshot upload may be stubbed for later, but it must be visibly disabled or labeled as a future feature.

### Candidate Board

The board is a status pipeline.

Allowed listing statuses:

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

No card should be decorative filler.

### Listing Detail

The Listing Detail page is the decision page.

Required sections:

- Listing summary
- Score breakdown
- Hard filters
- Strengths
- Risks
- Open questions
- Outreach draft
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

A tour record includes:

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

Track readiness, not files.

Checklist:

- Photo identification ready
- Employment letter ready
- Recent pay stubs ready
- Bank statements ready
- Landlord reference ready
- Credit screenshot or report ready
- Guarantor documents ready, if needed
- Pet documents ready, if needed

The application must not upload or store these documents in version zero.

## Visual System

Stoop should feel like:

```text
Apple Weather + visionOS glass + Linear discipline + New York City apartment urgency
```

It should not feel like:

- Real estate Pinterest
- A glassmorphism demo
- A generic software as a service dashboard
- An artificial intelligence chat wrapper

Design principles:

- Calm over cute
- Clarity over decoration
- Glass as a layer, not a gimmick
- Readability over visual flourish
- Status and next action always visible
- Dense apartment data without clutter

Use:

- Frosted glass panels
- Large rounded corners
- Subtle inner highlights
- Soft shadows
- Dark city or map-inspired background
- High-contrast foreground text
- Small saturated accents
- Clean status pills

Critical listing data must never sit directly on chaotic imagery without a readability layer.

Required design files:

- `src/styles/glass.css`
- `src/components/glass/glass-panel.tsx`
- `src/components/glass/glass-button.tsx`
- `src/components/glass/glass-input.tsx`
- `src/components/glass/glass-shell.tsx`
- `src/components/glass/status-pill.tsx`

## Technical Stack

Use one repository.

Initial stack:

- Next.js
- TypeScript
- Tailwind CSS, the Cascading Style Sheets utility framework
- Custom Cascading Style Sheets glass system
- SQLite local database
- Drizzle Object Relational Mapper
- OpenAI server routes gated by `OPENAI_API_KEY`
- Vitest

Defer:

- Supabase or Postgres
- Authentication
- Cloud sync
- Mapbox or MapLibre
- Playwright
- Official New York City data integrations

Optimize for a working personal tool first.

## Domain Model

These TypeScript shapes define the product contract. The database schema may differ internally, but it must preserve these semantics.

### SearchProfile

```ts
type SearchProfile = {
  id: string;
  name: string;
  targetMoveInDate: string | null;
  maxRentMonthly: number | null;
  budgetToleranceMonthly: number | null;
  preferredNeighborhoods: string[];
  acceptableNeighborhoods: string[];
  hardNoNeighborhoods: string[];
  commuteDestinations: Array<{
    label: string;
    address: string;
    maxMinutes: number;
  }>;
  bedroomsMin: number | null;
  bedroomsMax: number | null;
  mustHaves: string[];
  niceToHaves: string[];
  hardNos: string[];
};
```

### Listing

```ts
type ListingStatus =
  | "new"
  | "contacted"
  | "tour_scheduled"
  | "toured"
  | "applied"
  | "dead"
  | "leased";

type Listing = {
  id: string;
  sourceName: string | null;
  sourceUrl: string | null;
  rawText: string | null;

  title: string;
  address: string | null;
  unit: string | null;
  neighborhood: string | null;
  borough: string | null;

  rentMonthly: number | null;
  netEffectiveRent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  availableDate: string | null;

  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;

  status: ListingStatus;

  amenities: string[];
  fees: string[];
  redFlags: string[];
  openQuestions: string[];

  personalNotes: string | null;

  createdAt: string;
  updatedAt: string;
};
```

### ListingEvaluation

```ts
type Confidence = "high" | "medium" | "low";

type ListingEvaluation = {
  id: string;
  listingId: string;
  eligible: boolean;
  totalScore: number;
  scoreBreakdown: {
    location: number;
    price: number;
    apartmentFit: number;
    moveInFit: number;
    risk: number;
    responsiveness: number;
    subjectivePull: number;
  };
  hardFilters: string[];
  summary: string;
  strengths: string[];
  risks: string[];
  openQuestions: string[];
  confidence: Confidence;
  evaluatedAt: string;
};
```

### ParsedListing

```ts
type ParsedListing = {
  listing: Omit<Listing, "id" | "status" | "createdAt" | "updatedAt">;
  confidence: Confidence;
  fees: string[];
  redFlags: string[];
  openQuestions: string[];
  parserMode: "openai" | "fallback";
};
```

### OutreachMessage

```ts
type OutreachKind =
  | "first_contact"
  | "follow_up"
  | "fee_clarification"
  | "tour_request"
  | "post_tour_interest";

type OutreachMessage = {
  id: string;
  listingId: string;
  kind: OutreachKind;
  body: string;
  approved: boolean;
  sentAt: string | null;
  createdAt: string;
};
```

### Tour

```ts
type TourVerdict = "unknown" | "kill" | "maybe" | "apply";

type Tour = {
  id: string;
  listingId: string;
  startsAt: string;
  endsAt: string | null;
  notes: string | null;
  verdict: TourVerdict;
  checklist: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
};
```

### DailyBrief

```ts
type DailyBrief = {
  generatedAt: string;
  bestCandidates: string[];
  followUps: string[];
  upcomingTours: string[];
  deadOrRiskyListings: string[];
  applicationReadinessGaps: string[];
  recommendedNextActions: string[];
};
```

## Scoring Model

The score is deterministic. Model-generated text may explain or summarize the score, but the model does not own the score.

Hard filters are separate from weighted score. A listing that fails a hard filter can be stored, but it must be marked ineligible and ranked accordingly.

Hard filters:

- Rent exceeds max budget plus tolerance.
- Move-in date cannot work.
- Neighborhood is in the hard-no list.
- Address is missing after parse.
- Fee language is suspicious or unresolved.
- Scam language is obvious.
- Listing is already unavailable.

Weighted score:

| Category | Points |
| --- | ---: |
| Location and commute | 30 |
| Price | 25 |
| Apartment fit | 15 |
| Move-in fit | 10 |
| Risk | 10 |
| Responsiveness | 5 |
| Subjective pull | 5 |

Required output:

- `eligible`
- `totalScore`
- `scoreBreakdown`
- `hardFilters`
- `strengths`
- `risks`
- `openQuestions`
- `confidence`

The score must be stable for the same listing and profile. Do not use model calls, current time beyond explicit inputs, random values, or hidden state to compute it.

## Server Workflows

Use plain typed server functions first. Do not use an agent framework in version zero.

Required functions:

```ts
parseListing(input): ParsedListing
scoreListing(listing, profile): ListingEvaluation
draftOutreach(listing, profile, kind): OutreachMessage
generateDailyBriefing(listings, tours, profile): DailyBrief
```

### Listing Parser

Input:

- Pasted text
- Web address as context only
- Broker email
- Manual notes

Output:

- Structured listing fields
- Confidence
- Fees
- Red flags
- Open questions
- Parser mode

The parser must use deterministic fallback behavior when no OpenAI key exists.

### Outreach Drafter

Generate drafts for:

- First contact
- Follow-up
- Fee clarification
- Tour request
- Post-tour interest

The application must never send messages automatically.

### Daily Briefing

The daily briefing should produce:

- Best candidates today
- Dead or risky candidates
- Follow-up queue
- Tour schedule
- Application-readiness gaps
- Recommended next actions

This is the emotional center of the product: it turns the apartment hunt from noise into a short action list.

## New York City Rental Logic

Encode these assumptions carefully:

- Landlord-side broker fee language should be flagged for clarification.
- Tenant-paid fees should be treated as unresolved until clear.
- Rent stabilization should be `unknown` unless verified by an official or user-provided source.
- Building complaints and violations are risk signals, not final judgments.
- Official New York City Department of Housing Preservation and Development, Department of Buildings, and 311 data must be stubbed before it is claimed live.

Do not claim certainty about rent stabilization, complaints, violations, or building risk unless the application has real source data and the result is implemented and tested.

## Suggested Repository Structure

```text
stoop-app/
  README.md
  AGENTS.md
  .env.example
  docs/
    product.md
    design-system.md
    agent-workflows.md
    nyc-rental-rules.md
    operating-loop.md
  src/
    app/
      page.tsx
      inbox/
        page.tsx
      board/
        page.tsx
      listings/
        [id]/
          page.tsx
      tours/
        page.tsx
      api/
        listings/
          route.ts
        agents/
          parse-listing/
            route.ts
          draft-outreach/
            route.ts
          daily-briefing/
            route.ts
    components/
      glass/
        glass-panel.tsx
        glass-button.tsx
        glass-input.tsx
        glass-shell.tsx
        status-pill.tsx
      listings/
        listing-card.tsx
        listing-detail.tsx
        listing-score.tsx
        listing-risk-panel.tsx
      board/
        candidate-board.tsx
      inbox/
        capture-listing-panel.tsx
      briefing/
        daily-briefing.tsx
      tours/
        tour-checklist.tsx
    server/
      db/
        schema.ts
        client.ts
        seed.ts
      agents/
        parse-listing.ts
        draft-outreach.ts
        daily-briefing.ts
      nyc/
        building-risk.ts
    lib/
      scoring.ts
      search-profile.ts
      demo-data.ts
      dates.ts
      money.ts
    styles/
      globals.css
      glass.css
  tests/
    scoring.test.ts
    parser-fallback.test.ts
    fixtures/
      listings/
        broker-email.txt
        streeteasy-like.txt
        zillow-like.txt
```

## Acceptance Criteria

Version zero is done when:

- The application runs locally.
- The interface looks visually distinctive.
- Glass panels remain readable.
- Hunter can paste a listing.
- The application parses the listing.
- Hunter can edit parsed fields.
- The listing is saved.
- The listing receives a deterministic score.
- The listing appears on Today and Board.
- Hunter can move it through statuses.
- Hunter can generate outreach drafts.
- Hunter can create a tour checklist.
- Tests pass.
- The build passes.
- `README.md` explains how to run the application.

Version zero is not done if it is only a pretty mockup.

## Operating Loop

Daily cadence during the real search:

- 08:00 import new listings.
- 08:20 review ranked Today list.
- 08:45 send approved outreach manually.
- 11:30 follow up on nonresponses.
- 13:00 schedule tours.
- 18:00 tour, review, and kill weak candidates.
- 21:00 update notes and decide tomorrow's actions.

Daily targets:

- Review 30 to 50 listings.
- Capture 10 to 20 serious candidates.
- Send 10 to 20 serious contacts.
- Schedule as many tours as quality allows.
- Kill weak candidates quickly.
- Apply within 24 hours when a strong candidate clears the tour.

The software exists to compress decision time.
