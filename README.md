# NYC Apt Radar

NYC Apt Radar is a private, terminal-first NYC apartment discovery agent.

The product is one loop:

```text
objective -> observe radar state -> plan -> remember -> run configured StreetEasy discovery when useful -> extract facts or URL-only leads -> score and rank -> inspect evidence -> recommend, notify, or request operator review -> evaluate -> audit -> remember -> stop
```

It uses a required OpenAI Responses API supervisor for process control. Deterministic TypeScript code handles source access, extraction, field finalization, commute estimates, scoring, ranking, notifications, storage, and audit checks. SQLite is the local evidence store.

There is no web app, account system, public marketplace, in-app scheduler, deployment framework, browser automation, credentialed scraping, CAPTCHA bypassing, automatic outreach sender, or generic manual intake workflow. Minimal VPS support is plain systemd unit examples in `deploy/`.

## Setup

Requirements:

- Node.js 20 or newer
- npm
- OpenAI API key
- private ntfy topic for live hot-match pushes

Create local config files:

```bash
npm install
cp -n .env.example .env
cp -n data/preferences.example.json data/preferences.json
cp -n data/searches.example.json data/searches.json
```

Edit:

```text
.env
data/preferences.json
data/searches.json
```

Minimum useful `.env` values:

```bash
NYC_APT_RADAR_PREFERENCES_PATH=data/preferences.json
NYC_APT_RADAR_SEARCHES_PATH=data/searches.json
NYC_APT_RADAR_NTFY_TOPIC=your-private-ntfy-topic
NYC_APT_RADAR_NTFY_BASE_URL=https://ntfy.sh
OPENAI_API_KEY=sk-...
```

Useful tuning values:

```bash
NYC_APT_RADAR_DATABASE_PATH=data/nyc-apt-radar-loop.sqlite
NYC_APT_RADAR_SEARCH_RESULT_LIMIT=12
NYC_APT_RADAR_FETCH_TIMEOUT_MS=15000
NYC_APT_RADAR_SOURCE_CONCURRENCY=4
NYC_APT_RADAR_AGENT_MAX_ITERATIONS=6
NYC_APT_RADAR_OPENAI_MODEL=gpt-5.5
NYC_APT_RADAR_OPENAI_REASONING_EFFORT=low
NYC_APT_RADAR_OPENAI_TIMEOUT_MS=30000
NYC_APT_RADAR_NTFY_TIMEOUT_MS=10000
```

Private runtime files are ignored by git:

```text
.env
data/preferences.json
data/searches.json
data/*.sqlite
```

## Run

Start with readiness:

```bash
npm run doctor
```

Run a safe agent pass without live ntfy delivery:

```bash
npm run agent:dry-run
```

Run a live pass after `doctor` is clean and `notify:test` works:

```bash
npm run notify:test
npm run agent:run
```

Inspect output:

```bash
npm run radar
npm run agent:recommendations
npm run agent:trace
```

Answer a structured operator review when `agent:recommendations` shows one:

```bash
npm run agent:review -- --id <review-id> --answer "<option label>"
```

Verify the persisted loop contract:

```bash
npm run agent:verify
```

Inspect a specific persisted loop trace:

```bash
npm run agent:trace -- --run <run-id>
```

## VPS

For a Linux VPS, use the systemd examples in `deploy/`. They run the same
`npm run agent:run` command as the terminal workflow and keep deployment logic
out of the TypeScript app.

```bash
sudo cp deploy/nyc-apt-radar.service.example /etc/systemd/system/nyc-apt-radar.service
sudo cp deploy/nyc-apt-radar.timer.example /etc/systemd/system/nyc-apt-radar.timer
sudo systemctl daemon-reload
sudo systemctl enable --now nyc-apt-radar.timer
```

## Commands

Operator commands:

```bash
npm run doctor
npm run agent:dry-run
npm run agent:run
npm run radar
npm run agent:recommendations
npm run agent:trace
npm run agent:review -- --id <review-id> --answer "<option label>"
npm run agent:verify
npm run notify:test
```

Verification commands:

```bash
npm run typecheck
npm run test
npm run build
```

## Configuration

`data/searches.json` is the only source access list. Paste public StreetEasy search URLs and set them enabled:

```json
{
  "searches": [
    {
      "id": "streeteasy-saved-search",
      "provider": "streeteasy",
      "searchUrl": "https://streeteasy.com/for-rent/...",
      "sourceName": "StreetEasy",
      "enabled": true,
      "resultLimit": 12
    }
  ]
}
```

`data/preferences.json` controls deterministic scoring: budget, neighborhoods, commute targets, bedrooms, bathrooms, pets, fee preference, dealbreakers, nice-to-haves, and hot-score threshold.

Unknown listing facts lower confidence. They do not automatically reject a listing.

## Agent Boundary

The supervisor can call bounded local tools:

- get radar state
- update working memory
- set an episode plan
- run one configured StreetEasy discovery pass
- inspect a listing
- draft outreach for operator review
- inspect recent failures
- request structured operator review
- record an evidence-backed recommendation
- stop with a structured decision

The supervisor cannot fetch outside configured public searches, use credentials, bypass source controls, invent listing facts, send outreach, or directly mutate listing status.

Every ordinary model tool call declares intent. Runtime guardrails allow, rewrite, or block the call before side effects happen. Batched tool calls are blocked after the first. Listing-specific recommendations and review requests require in-run evidence, and outreach/status recommendations require a prior listing inspection.

Completed runs persist initial context, model/tool trace, plans, working memory, guardrails, recommendations, operator reviews, contract audits, strict episode evaluations, reflections, experiments, and playbook directives.

`agent:verify` is the read-only evidence gate. It fails when the latest completed run does not prove the loop contract.

## Troubleshooting

- No active search: edit `data/searches.json`, paste a public StreetEasy URL, and set `"enabled": true`.
- Missing preferences: copy `data/preferences.example.json` to `data/preferences.json`.
- Missing OpenAI: set `OPENAI_API_KEY`, then run `npm run doctor`.
- Missing ntfy: set `NYC_APT_RADAR_NTFY_TOPIC`, then run `npm run notify:test`.
- Empty radar: run `npm run agent:dry-run`, then inspect `npm run agent:recommendations` and the run summary.
- StreetEasy blocks access: the app records the failed source event honestly. It does not bypass controls.

## Architecture

```text
src/agent          model control plane
src/discovery      configured StreetEasy discovery
src/core           deterministic domain logic
src/storage        durable state and audit trail
src/notifications  bounded notification side effects
src/diagnostics    readiness and loop verification
scripts            minimal operator commands
tests              behavior that protects the main loop
```

## Next Work

Make the existing loop more useful before adding surfaces: improve extraction coverage for inspectable StreetEasy structured data, strengthen commute estimates, and make `agent:recommendations` easier to scan without adding a web app.
