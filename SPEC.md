# SPEC.md - NYC Apartment Radar

## Goal

Build a private, local-first apartment discovery agent loop for a New York City apartment search.

```text
StreetEasy search -> discovery event -> extract listing -> finalize fields -> estimate commute -> score -> rank -> notify -> draft outreach -> track status
```

The product is acceptable when the local operator can leave the loop running, receive ntfy push notifications for interesting matches, inspect why a listing scored well or poorly, and act quickly without the app sending messages automatically.

## User

Primary user: the local operator.

This is not a public marketplace or general real estate product. Optimize for speed, signal, and honest automation.

## Product Principles

- Speed over completeness.
- Signal over volume.
- Human in control.
- Deterministic scoring before model judgment.
- Local-first persistence.
- Plain automation over theatrical demos.
- Respect source access controls.
- No fake live integrations.

## In Scope

- Run configured StreetEasy public search URLs on demand or through launchd/systemd.
- Intake one-off URLs, structured files, pasted text, and stdin from a terminal command.
- Extract candidate listings into a normalized shape.
- Store discovery events for dedupe and audit.
- Score listings against the configured preferences.
- Estimate subway commute quality to multiple target addresses.
- Show ranked listings in the terminal.
- Send ntfy push notifications for hot matches.
- Generate editable outreach drafts.
- Track status.
- Extract StreetEasy JSON-LD and structured JSON listing data without model calls.

## Out Of Scope

- Credentialed scraping.
- CAPTCHA bypassing.
- Stealth browser automation.
- Platform evasion.
- Automatic message sending.
- Public marketplace features.
- Multi-user features.
- Payments.
- Authentication.
- Sensitive document storage.
- Native mobile app.
- Decorative web UI.

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

## Statuses

Supported statuses:

```text
new, interested, contacted, scheduled, rejected, viewed, applied
```

## Preferences

The preference profile must support:

- budget
- preferred, acceptable, and avoided neighborhoods
- multiple commute target addresses
- bedroom and bathroom preference
- pet requirements
- fee preference
- dealbreakers
- nice-to-haves
- hot-score threshold

Unknown values should lower confidence, not automatically reject a listing.

The default profile may live in TypeScript, but the running loop must support a JSON preference file so budget, neighborhoods, and any number of commute target addresses can change without code edits.

## Commute Model

For each listing and each target address, estimate:

- nearest useful station
- walk time to train
- train lines
- train switches
- train time
- destination station
- walk time from train
- total time

The first implementation may use a small local subway graph. It must be inspectable and easy to expand. GTFS-backed routing is future hardening.

## Scoring

Scoring is deterministic from 0 to 100:

- price fit: 25
- location fit: 20
- commute fit: 20
- apartment fit: 15
- pet fit: 10
- freshness: 5
- completeness/confidence: 5

Each score must include a human-readable explanation.

Example:

```text
86/100 - Strong match. Within budget, preferred neighborhood, Bryant Park: 31 min via M, cats allowed, fee status unknown.
```

## Notification Logic

A listing is hot when:

- score is at or above the configured hot threshold
- status is not rejected
- the listing and score have not already triggered a notification

Notifications:

- Send through ntfy when `NYC_APT_RADAR_NTFY_TOPIC` is configured.
- Record failed notification attempts when ntfy is not configured or delivery fails.
- `npm run agent:run` should fail fast on failed readiness checks, including missing StreetEasy search or ntfy configuration.
- Never send outreach messages.
- `npm run notify:test` should fail loudly unless an ntfy topic is configured.

## Extraction Boundary

The autonomous loop must not require an API key or model call. Extract only from inspectable local/public source data:

- StreetEasy search JSON-LD -> `ListingDraft[]`
- Structured JSON manual intake files -> `ListingDraft[]`
- Plain listing URLs -> URL-only leads

Do not use model calls for ranking, scoring, source access, stealth browsing, extraction, or automatic outreach. If source text is unstructured and no structured fields can be found, record the failure honestly or save an explicit URL-only lead.

## Commands

Required commands:

```bash
npm run doctor
npm run agent:run
npm run agent:install
npm run agent:uninstall
npm run agent:logs
npm run searches
npm run events
npm run notify:test
npm run radar
npm run intake
npm run listing:update
npm run listing:status
npm run listing:draft
npm run test
npm run typecheck
npm run build
```

## Acceptance Criteria

- The project runs locally from a clean install.
- One-off listing input works from a pasted URL, a file path, pasted text, or stdin.
- Configured StreetEasy searches can be fetched with plain HTTP.
- One failed search is recorded honestly.
- A doctor command reports database, search, preference, commute-target, agent interval, and ntfy readiness.
- A doctor command fails when no active StreetEasy search is configured or `NYC_APT_RADAR_NTFY_TOPIC` is missing.
- Duplicate source events do not create notification spam.
- Listings are normalized and persisted.
- Listings are scored and ranked.
- Commute estimates include train lines, transfers, walking time, and total time.
- Hot listings are sent to ntfy or recorded as failed notification attempts.
- Outreach drafts are generated but never sent automatically.
- CLI commands load local environment files before reading source, preference, database, and ntfy settings.
- Tests pass.
- Typecheck/build pass.
