# SPEC.md - NYC Apt Radar

## Product Thesis

NYC Apt Radar is a private, model-supervised NYC apartment discovery loop.

```text
objective -> observe radar state -> plan -> remember -> run configured StreetEasy discovery when useful -> extract listing facts or URL-only leads -> score/rank -> inspect evidence -> notify, recommend, or request operator review -> evaluate -> audit -> remember -> stop
```

The product is acceptable when the local operator can run the loop, receive ntfy notifications for high-signal matches, inspect why listings scored well or poorly, review evidence-backed recommendations, answer structured human-review requests, and audit the model-directed trace.

## User

Primary user: the local operator.

This is not a public real estate product. Optimize for speed, signal, honesty, and operator control.

## In Scope

- Run configured public StreetEasy search URLs on demand.
- Extract StreetEasy JSON-LD and structured JSON listing facts without model calls.
- Save URL-only leads when configured search pages reveal listing URLs but detail extraction is blocked.
- Normalize listings and persist source events for dedupe and audit.
- Score and rank listings deterministically against JSON preferences.
- Estimate subway commute quality to configured targets.
- Record ntfy notification decisions and send live hot-match pushes only when explicitly running live.
- Generate outreach drafts for operator review without sending them.
- Run an OpenAI Responses API supervisor that chooses bounded local tools, records a trace, persists plans and working memory, writes evidence-backed recommendations or structured operator-review requests, and stops clearly.
- Persist initial run context, guardrails, recommendations, reviews, contract audits, strict episode evaluations, playbook directives, experiments, and reflections.
- Verify the latest completed run with a read-only persisted-evidence gate.

## Out Of Scope

- In-app scheduler or deployment framework.
- Credentialed scraping.
- CAPTCHA bypassing.
- Stealth browser automation.
- Platform evasion.
- Model-controlled source access or extraction of unsupported facts.
- Automatic message sending.
- Public marketplace features.
- Multi-user features.
- Payments.
- Authentication.
- Sensitive document storage.
- Native mobile app.
- Decorative web UI.
- Manual URL/file/stdin intake as a primary workflow.

Minimal VPS operation through static systemd example units is allowed. Installer scripts and deployment frameworks are not.

## Listing Model

A normalized listing should include:

- `id`
- `source`
- `sourceUrl`
- `title`
- `address`
- `neighborhood`
- `borough`
- `rent`
- `bedrooms`
- `bathrooms`
- `availableDate`
- `description`
- `amenities`
- `pets`
- `feeStatus`
- `latitude`
- `longitude`
- `status`
- `firstSeenAt`
- `lastSeenAt`
- `score`
- `scoreExplanation`

Optional practical fields:

- `contactName`
- `appointmentAt`

Supported statuses:

```text
new, interested, contacted, scheduled, rejected, viewed, applied
```

## Preferences

The preference profile must support budget, preferred/acceptable/avoided neighborhoods, commute targets, bedroom and bathroom preference, pet requirements, fee preference, dealbreakers, nice-to-haves, and hot-score threshold.

The running loop must support a JSON preference file so budget, neighborhoods, and commute targets change without code edits.

Unknown values lower confidence. They do not automatically reject a listing.

## Scoring

Scoring is deterministic from 0 to 100:

- price fit: 25
- location fit: 20
- commute fit: 20
- apartment fit: 15
- pet fit: 10
- freshness: 5
- completeness/confidence: 5

Each score includes a human-readable explanation.

## Notification Logic

A listing is hot when its score is at or above the configured hot threshold, it is not rejected, and that listing/score pair has not already triggered a notification.

Notifications:

- Send through ntfy when `NYC_APT_RADAR_NTFY_TOPIC` is configured and the run is live.
- Record skipped decisions during dry runs.
- Record failed notification attempts when configuration or delivery fails.
- Never send outreach messages.

## Agent Supervisor

The main loop is a bounded agent:

- It receives a clear objective and local tool set.
- It observes radar state before acting.
- It records an episode plan with success criteria, planned steps, stop conditions, risk checks, and confidence.
- It maintains working memory for focus, hypotheses, next actions, open questions, and confidence.
- It chooses one tool action per model turn and declares intent.
- It uses tool outputs as ground truth.
- Runtime guardrails allow, rewrite, or block tool calls before side effects happen.
- Batched model tool calls execute only the first call and block the rest.
- Listing-specific writes require prior in-run observation, and outreach/status recommendations require prior listing inspection.
- It writes recommendations and operator-review requests only with structured evidence.
- It stops with a structured decision against the episode plan.
- It evaluates the compact trace through a strict structured function call.
- It fails evaluation rather than fabricating fallback lessons, experiments, or playbook entries when critic output is malformed.
- It persists a deterministic contract audit covering the minimum loop contract and causal ordering.

First-class tools:

- inspect radar state
- update working memory
- set episode plan
- run one configured StreetEasy discovery pass
- inspect a listing
- draft outreach for review
- inspect recent failures
- request structured operator review
- record recommendation
- stop the loop

## Commands

Operator commands:

```bash
npm run doctor
npm run agent:dry-run
npm run agent:run
npm run agent:trace
npm run radar
npm run agent:recommendations
npm run agent:review
npm run agent:verify
npm run notify:test
```

Verification commands:

```bash
npm run typecheck
npm run test
npm run build
```

## Acceptance Criteria

- The project runs locally from a clean install.
- `doctor` reports database, search, preference, commute-target, OpenAI, ntfy, and local-runtime readiness.
- `doctor` fails when no active StreetEasy search is configured, `OPENAI_API_KEY` is missing, or live ntfy configuration is missing.
- Configured StreetEasy searches can be fetched with plain HTTP.
- One failed search is recorded honestly.
- Duplicate source events do not create notification spam.
- Listings are normalized, persisted, scored, and ranked.
- Commute estimates include train lines, transfers, walking time, and total time.
- Hot listings are sent to ntfy in live mode or recorded as skipped in dry-run mode.
- Outreach drafts are generated but never sent automatically.
- The OpenAI supervisor dynamically chooses tools, records a trace, persists plans and working memory, and records safe recommendations or operator-review requests.
- Runtime guardrail decisions are persisted and visible to the model when a call is rewritten or blocked.
- Stop decisions are structured against the episode plan.
- Completed runs persist strict episode evaluations, contract audits, reflections, playbook directives, and experiment state.
- Malformed evaluator output does not create fallback learning artifacts.
- Operator-facing recommendations include structured evidence and listing-specific provenance.
- Operator review answers are persisted and visible to future runs.
- `agent:verify` fails unless the latest completed run proves the persisted loop contract.
- Tests pass.
- Typecheck/build pass.
