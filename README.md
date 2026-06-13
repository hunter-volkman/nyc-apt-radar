# NYC Apt Radar

NYC Apt Radar is a private apartment discovery worker for a New York City rental search.

```text
StreetEasy search -> score -> notify -> track
```

It is a terminal-first TypeScript app with local SQLite persistence. It runs configured public StreetEasy search URLs, records what it found, extracts listing facts when structured data is available, estimates commute quality, scores listings against your preferences, sends ntfy alerts for hot matches, drafts outreach for you to edit, and tracks listing status.

There is no web app, account system, payment flow, public marketplace, automatic outreach sender, browser automation, CAPTCHA bypassing, or model extraction in the autonomous loop.

## Requirements

- Node.js 20 or newer
- npm
- A terminal
- Optional: an ntfy topic for phone notifications
- Optional for always-on cloud runs: an Ubuntu VPS with systemd
- Optional for always-on local Mac runs: launchd

## Quick Start

Install dependencies and create local config files:

```bash
npm install
cp -n .env.example .env
cp -n data/preferences.example.json data/preferences.json
cp -n data/searches.example.json data/searches.json
```

Edit these files before the first run:

```text
.env
data/preferences.json
data/searches.json
```

Then run a safe pass:

```bash
npm run doctor
npm run agent:dry-run
npm run radar
npm run notifications
```

`agent:dry-run` checks configured searches, saves listings, scores them, and records notification decisions without sending live ntfy pushes.

When ntfy is configured and the test push works, run the live worker:

```bash
npm run notify:test
npm run agent:run
```

## Configuration

Local operator files are intentionally ignored by git:

```text
.env
data/preferences.json
data/searches.json
data/nyc-apt-radar-loop.sqlite
data/logs/
```

The checked-in `.example` files are safe templates. Copy them locally and edit the copies.

Treat `.env`, preference/search copies, SQLite files, and log files as private operator data. They can contain search constraints, listing history, notification attempts, and local workflow notes, so keep them on trusted storage and out of commits, shared tickets, and public logs.

### `.env`

Minimum useful local values:

```bash
NYC_APT_RADAR_PREFERENCES_PATH=data/preferences.json
NYC_APT_RADAR_SEARCHES_PATH=data/searches.json
NYC_APT_RADAR_NTFY_TOPIC=your-private-ntfy-topic
NYC_APT_RADAR_NTFY_BASE_URL=https://ntfy.sh
```

Optional values:

```bash
NYC_APT_RADAR_DATABASE_PATH=data/nyc-apt-radar-loop.sqlite
NYC_APT_RADAR_SEARCH_RESULT_LIMIT=12
NYC_APT_RADAR_FETCH_TIMEOUT_MS=15000
NYC_APT_RADAR_SOURCE_CONCURRENCY=4
NYC_APT_RADAR_AGENT_INTERVAL_MINUTES=60
NYC_APT_RADAR_NTFY_TIMEOUT_MS=10000
```

Secrets belong in `.env`, not in systemd units, launchd plists, README snippets, or committed JSON files.

### `data/searches.json`

This file controls where the worker looks. The app does not wander to generic sources.

Example:

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

The template starts disabled. Paste a real public StreetEasy search URL and set `"enabled": true`.

Inspect configured searches:

```bash
npm run searches
```

### `data/preferences.json`

This file controls scoring and commute evaluation. Edit budget, neighborhoods, commute targets, pet requirements, fee preference, dealbreakers, nice-to-haves, and the hot-score threshold.

Each commute target needs:

```json
{
  "label": "Bryant Park",
  "address": "Bryant Park, New York, NY",
  "latitude": 40.7536,
  "longitude": -73.9832,
  "maxMinutes": 35
}
```

Unknown listing facts lower confidence; they do not automatically reject a listing.

### ntfy

Create a private ntfy topic, put it in `.env`, and subscribe to that topic in the ntfy app.

Test it with:

```bash
npm run notify:test
```

The test command sends one generic message:

```text
NYC Apt Radar test notification. If you see this, ntfy is configured.
```

The worker never sends outreach messages automatically.

## Operator Commands

Setup and health:

```bash
npm run doctor
npm run reset
npm run test
npm run typecheck
npm run build
```

Run the worker:

```bash
npm run agent:dry-run
npm run agent:run
```

Inspect state:

```bash
npm run searches
npm run events
npm run radar
npm run notifications
```

Work with listings:

```bash
npm run intake
npm run listing:update
npm run listing:status
npm run listing:draft
```

Local macOS deployment:

```bash
npm run agent:install -- --interval-minutes=60
npm run agent:logs
npm run agent:uninstall
```

Ubuntu VPS deployment:

```bash
npm run agent:install:systemd -- --interval-minutes=60
npm run agent:uninstall:systemd
```

## Is It Working?

Start with:

```bash
npm run doctor
```

A healthy doctor report should show:

- database readiness
- at least one active StreetEasy search
- a readable preference profile
- at least one commute target
- a valid agent interval
- ntfy configured for live runs

Then run:

```bash
npm run agent:dry-run
```

A healthy dry run should report searches checked, documents seen, listings found or saved, ranked listings, and skipped notification decisions. Skipped notifications are expected in dry-run mode.

Inspect ranked listings:

```bash
npm run radar
```

Healthy radar output should show listings ordered by score with explanation text and commute details.

Inspect discovery history:

```bash
npm run events
```

Healthy events output should show successful search documents, duplicates, or honest fetch/extraction failures. If StreetEasy blocks normal public access, the app records that failure instead of bypassing it.

Inspect notification decisions:

```bash
npm run notifications
```

Healthy notification output should show sent, skipped, duplicate, or failed notification attempts. This is the audit trail that prevents repeated hot-listing spam.

## Deploy On An Ubuntu VPS

The VPS deployment runs the same worker command on a systemd timer:

```bash
npm run agent:run
```

Recommended shape:

- Ubuntu with Node 20 or newer, npm, git, and systemd
- Repo at `/opt/nyc-apt-radar`
- SQLite in the repo `data/` directory, or an explicit persistent path in `NYC_APT_RADAR_DATABASE_PATH`
- Secrets in `/opt/nyc-apt-radar/.env`
- ntfy as the notification channel

One-time setup:

```bash
sudo mkdir -p /opt/nyc-apt-radar
sudo chown "$USER" /opt/nyc-apt-radar
git clone <repo-url> /opt/nyc-apt-radar
cd /opt/nyc-apt-radar
npm install
cp -n .env.example .env
cp -n data/preferences.example.json data/preferences.json
cp -n data/searches.example.json data/searches.json
```

Edit the VPS config files:

```text
/opt/nyc-apt-radar/.env
/opt/nyc-apt-radar/data/preferences.json
/opt/nyc-apt-radar/data/searches.json
```

Verify before installing the timer:

```bash
npm run doctor
npm run notify:test
npm run agent:dry-run
npm run radar
npm run notifications
```

Install and start the timer:

```bash
npm run agent:install:systemd -- --interval-minutes=60
```

Preview what would be installed:

```bash
npm run agent:install:systemd -- --dry-run
```

Inspect the timer and worker:

```bash
systemctl status nyc-apt-radar.timer
systemctl status nyc-apt-radar.service
journalctl -u nyc-apt-radar.service -n 80 --no-pager
```

Stop the VPS timer:

```bash
npm run agent:uninstall:systemd
```

Example systemd units are checked in under `deploy/` for review or manual installation.

## Deploy Locally With launchd

The macOS LaunchAgent also runs:

```bash
npm run agent:run
```

Install and start it:

```bash
npm run agent:install -- --interval-minutes=60
```

Preview the plist:

```bash
npm run agent:install -- --dry-run
```

Read local launchd logs:

```bash
npm run agent:logs
```

Stop local deployment:

```bash
npm run agent:uninstall
```

## Architecture

The code is intentionally small and boring:

- `src/core/*`: listing model, preferences, field finalization, commute estimates, scoring, ranking, outreach drafts, and statuses
- `src/discovery/*`: StreetEasy search configuration, public fetch collection, extraction, intake, and the one-pass agent loop
- `src/storage/*`: local SQLite schema and repositories for listings, discovery events, and notifications
- `src/notifications/*`: ntfy delivery and notification decision recording
- `src/diagnostics/*`: readiness checks used by `doctor` and deployment installers
- `src/automation/*`: launchd and systemd unit rendering
- `scripts/*`: terminal commands for the operator
- `tests/*`: behavior tests for the radar loop

The persistence model is local-first. The scoring model is deterministic. The extraction boundary is inspectable. Notifications are side effects, so they are deduped and auditable.

## Troubleshooting

Run:

```bash
npm run doctor
```

Common fixes:

- No active search: edit `data/searches.json`, paste a public StreetEasy URL, and set `"enabled": true`.
- Missing preferences: copy `data/preferences.example.json` to `data/preferences.json`.
- Missing ntfy: set `NYC_APT_RADAR_NTFY_TOPIC`, then run `npm run notify:test`.
- Empty radar: run `npm run agent:dry-run`, then `npm run events` to see whether searches returned listings or failures.
- Duplicate-looking runs: check `npm run events` and `npm run notifications`; duplicates should be recorded without notification spam.
- VPS logs: run `journalctl -u nyc-apt-radar.service -n 80 --no-pager`.
- Mac logs: run `npm run agent:logs`.

## Related Docs

- `SPEC.md`: product boundary and acceptance criteria
- `OPERATING_PRINCIPLES.md`: product and engineering judgment
- `AGENTS.md`: instructions for future coding agents

## Out Of Scope

- Credentialed scraping
- CAPTCHA bypassing
- Stealth browser automation
- Platform evasion
- Model extraction in the autonomous loop
- Automatic outreach sending
- Public marketplace features
- Multi-user features
- Payments
- Authentication
- Sensitive document storage
- Native mobile app
- Decorative web UI
