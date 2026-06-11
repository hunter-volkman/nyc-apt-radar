# Stoop Build Workflow

## Operating Principle

Use Codex like a small engineering team, not like one magic prompt.

The failure mode is asking for the whole dream in one unbounded run. The better workflow is:

- One repository
- One clear main thread
- Small worktree threads
- Frequent commits
- Tests after meaningful changes
- Subagents only for review

First get a usable local application. Then harden it.

## Repository Start

Manual setup:

```bash
mkdir stoop-app
cd stoop-app
git init
```

Open this folder in Codex.

Start with a local thread. Use the kickoff prompt in `PROMPT.md`.

## Thread 0: Foundation

Mode: local

Purpose:

- Scaffold the application.
- Create `AGENTS.md`.
- Create product and engineering documentation.
- Create the visual shell.
- Create a demo-data Today dashboard and Candidate Board.

Prompt:

```text
Use PROMPT.md as the Stoop kickoff prompt. Build the first working local application. Do not spawn subagents.
```

Done when:

- The application runs locally.
- Today dashboard exists.
- Candidate Board exists.
- Demo data appears.
- Initial interface exists.
- `README.md` exists.
- `AGENTS.md` exists.
- Build passes.

Commit:

```bash
git add .
git commit -m "Create Stoop foundation"
```

## Thread 1: Persistence

Mode: worktree

Purpose:

- SQLite
- Drizzle Object Relational Mapper
- Schema
- Seed data
- Listing create, read, update, delete routes
- Status updates

Prompt:

```text
Create a worktree thread for persistence only.

Add local SQLite persistence with Drizzle. Implement schema, seed data, listing create/read/update/delete routes, and status updates.

Preserve the existing interface and visual system. Do not change scoring, parser, or outreach behavior beyond what persistence requires.

Run tests/build and summarize the files changed.
```

Done when:

- Listings persist locally.
- Seed script works.
- Status changes persist.
- No interface regression is obvious.
- Build passes.

Commit:

```bash
git commit -m "Add local listing persistence"
```

## Thread 2: Scoring

Mode: worktree

Purpose:

- Deterministic score engine
- Hard filters
- Unit tests
- Score display

Prompt:

```text
Create a worktree thread for listing scoring only.

Implement deterministic listing scoring in src/lib/scoring.ts. Separate hard filters from weighted score.

Use this weighting:
- 30 location and commute
- 25 price
- 15 apartment fit
- 10 move-in fit
- 10 risk
- 5 responsiveness
- 5 subjective pull

Add tests for:
- Strong candidate
- Over-budget candidate
- Missing-address candidate
- Suspicious-fee candidate
- Hard-no-neighborhood candidate

Display score and eligibility on listing cards and Listing Detail. Do not change parser or outreach logic.

Run tests/build and summarize edge cases.
```

Done when:

- Scoring has tests.
- Hard filters work.
- Cards show score and eligibility.
- Listing Detail shows score breakdown.
- Build passes.

Commit:

```bash
git commit -m "Add deterministic listing scoring"
```

## Thread 3: shadcn UI Migration

Mode: worktree

Purpose:

- shadcn/ui setup
- Operational visual system
- Today command screen
- Faster Candidate Board scanning
- Inbox capture workflow
- Listing Detail decision page
- Phone-usable Tours screen

Prompt:

```text
Create a worktree thread for shadcn UI migration only.

Use shadcn/ui as the component foundation. Replace the old decorative visual direction with a calm, dense apartment command center.

Make Today, Board, Inbox, Listing Detail, and Tours easier to scan and act on. Do not change database schema, scoring logic, parser behavior, outreach behavior, or persistence behavior.

Run tests, seed, lint, build, and browser smoke tests.
```

Done when:

- shadcn/ui is initialized.
- Current screens use shadcn-based components.
- Critical listing data is more readable.
- Stubs are clearly disabled or labeled.
- Tests, seed, lint, and build pass.

Commit:

```bash
git commit -m "Migrate interface to shadcn design system"
```

## Thread 4: Parser

Mode: worktree

Purpose:

- Pasted-text parser
- Broker email parser
- OpenAI-backed extraction
- Deterministic fallback extraction
- Editable parse review

Prompt:

```text
Create a worktree thread for listing parsing only.

Implement parseListing as a typed server workflow. It should handle pasted listing text, broker-email-like text, and web-address context. If OPENAI_API_KEY exists, use an OpenAI-backed extraction route. If no key exists, use a deterministic fallback parser.

The parser must return structured fields, confidence, fees, red flags, open questions, and parser mode. Add fixtures and tests for fallback parsing.

Add an editable parse review interface before saving a listing.

Do not build scraping. Do not build screenshot upload yet. Do not change scoring except to connect parsed listings to existing scoring.

Run tests/build and summarize failure modes.
```

Done when:

- User can paste listing text.
- Parser extracts useful fields.
- User can edit before saving.
- Fallback parser works without an OpenAI key.
- Tests pass.

Commit:

```bash
git commit -m "Add listing parser workflow"
```

## Thread 5: Outreach and Briefing

Mode: worktree

Purpose:

- Outreach draft generation
- Daily briefing
- Follow-up queue
- Application readiness

Prompt:

```text
Create a worktree thread for outreach and briefing only.

Implement draftOutreach and generateDailyBriefing as typed server workflows. Generate drafts for first contact, follow-up, fee clarification, tour request, and post-tour interest. Never send messages automatically.

The daily briefing should summarize best candidates, follow-ups, dead or risky listings, upcoming tours, and application-readiness gaps.

Add interface panels to Listing Detail and Today. Do not change core scoring rules or persistence schema unless strictly necessary.

Run tests/build and summarize what is deterministic versus model-generated.
```

Done when:

- Outreach drafts generate.
- Daily briefing appears.
- Follow-up queue is visible.
- Application readiness is tracked.
- Build passes.

Commit:

```bash
git commit -m "Add outreach and daily briefing"
```

## Thread 6: Interface Polish

Mode: worktree

Purpose:

- Refine the shadcn-based interface without damaging usability.

Prompt:

```text
Create a worktree thread for visual polish only.

Improve the shadcn-based interface, responsive layout, empty states, listing cards, status badges, dashboard hierarchy, and readability. Do not change business logic, database schema, parser behavior, or scoring rules.

The application should feel like a calm, dense apartment command center for New York City apartment hunting. Critical information must remain readable.

Run build and summarize visual changes.
```

Done when:

- Application feels visually distinct.
- Mobile layout works.
- Readability is strong.
- Product logic is unchanged.
- Build passes.

Commit:

```bash
git commit -m "Polish shadcn interface"
```

## Thread 7: New York City Building-Risk Stubs

Mode: worktree

Purpose:

- Risk architecture
- Honest stubs
- Future official-data boundaries

Prompt:

```text
Create a worktree thread for New York City building-risk architecture only.

Add typed building-risk report structures and stub clients for future New York City Department of Housing Preservation and Development, Department of Buildings, and 311 integrations. Add a Listing Detail building-risk panel that clearly distinguishes unknown, manually noted, and future official-data-backed risks.

Do not claim live official data unless it is actually implemented and tested. Update docs/nyc-rental-rules.md with source notes and implementation boundaries.

Run build and summarize what is real versus stubbed.
```

Done when:

- Building-risk types exist.
- Risk panel exists.
- Documentation is honest.
- No fake live integrations exist.
- Build passes.

Commit:

```bash
git commit -m "Add New York City building risk architecture"
```

## Review With Subagents

Use subagents only after the first working application exists.

Mode: worktree or local read-only review

Prompt:

```text
Review this repository with parallel read-only subagents. Spawn one subagent per review area, wait for all results, and return a prioritized fix list with file references.

Areas:
1. Interface taste and readability
2. Data model correctness
3. Scoring reliability
4. Workflow reliability
5. New York City rental assumptions and source honesty
6. Test coverage and failure modes

Do not edit files. Do not run destructive commands. Return only findings, severity, rationale, and recommended fixes.
```

Use subagents for criticism, not authorship.

## Daily Build Loop

Morning:

- Pull latest.
- Run the application.
- Paste real listings.
- Note friction.
- Write bugs as issues or task notes.
- Fix the friction that blocks real use.

Night:

- Commit working state.
- Write what failed.
- Write what was missing.
- Feed that into the next Codex thread.

The application should improve because it is being used under pressure.

## Merge Discipline

Before merging any worktree:

```bash
npm test
npm run build
git diff --check
git status
```

Reject changes that:

- Make the application prettier but less usable
- Add fake integrations
- Weaken scoring determinism
- Hide critical data
- Introduce dependency bloat
- Touch unrelated files

## Decision Rule

Always prefer the change that helps Hunter take the next apartment action faster.

The application is not done when it is impressive. It is done when it helps Hunter get housed.
