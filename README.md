# NYC Apt Radar

NYC Apt Radar is a private, local-first New York City apartment discovery loop. On a cadence, it runs configured StreetEasy public search URLs, records discovery events, extracts listing facts, estimates subway commutes, scores and ranks listings, sends ntfy pushes for hot matches when configured, drafts outreach for a human to edit, and tracks listing status.

It is a terminal-first TypeScript project with local SQLite persistence. There is no web app.

## What This App Does

```text
StreetEasy search -> result links -> extract or save URL-only leads -> finalize fields -> estimate commute -> score -> notify if hot -> draft outreach -> track status
```

The loop is intentionally honest: plain fetch against configured public search URLs is allowed, but blocked searches are recorded as failures instead of bypassed. Extraction is deterministic from StreetEasy JSON-LD or structured JSON intake files. When structured facts are not available, the app saves explicit URL-only leads instead of reaching for a model or browser.

## Use It Today

```bash
cp .env.example .env
cp data/searches.example.json data/searches.json
# edit .env
# edit data/searches.json if you want different StreetEasy searches
npm install
npm run doctor
npm run reset
npm run agent:run -- --no-notify
npm run radar
npm run notifications
npm run notify:test
npm run agent:install -- --interval-minutes=60
```

`npm run notify:test` sends only this benign message:

```text
NYC Apt Radar test notification. If you see this, ntfy is configured.
```

## Configure StreetEasy Searches

The autonomous loop is driven by:

```text
data/searches.json
```

Copy the template:

```bash
cp data/searches.example.json data/searches.json
```

Put the exact public StreetEasy URLs you want the loop to run in `data/searches.json`:

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

That file is the leash: the loop will not wander to other sites or generic source URLs.

Inspect configured searches with:

```bash
npm run searches
```

Inspect discovery history and failures with:

```bash
npm run events
```

Manual intake still exists for one-off URLs, structured JSON, and saved HTML. It does not use model calls or browser automation.

## Configure Commute Targets

Create an editable preference profile:

```bash
cp data/preferences.example.json data/preferences.json
```

Then set:

```bash
NYC_APT_RADAR_PREFERENCES_PATH=data/preferences.json
```

Each commute target needs `label`, `address`, `latitude`, `longitude`, and `maxMinutes`.

## Configure ntfy

Set a private topic and optional server in `.env`:

```bash
NYC_APT_RADAR_NTFY_TOPIC=nyc-apt-radar-long-random-secret
NYC_APT_RADAR_NTFY_BASE_URL=https://ntfy.sh
```

Subscribe to the topic in the ntfy app. The app redacts the topic in command output and never commits `.env`.

## Local Dry Run

This checks the configured StreetEasy searches and records notification decisions without sending live pushes:

```bash
npm run doctor
npm run searches
npm run agent:run -- --no-notify
npm run radar
npm run notifications
npm run events
```

It exercises search fetch, extraction, scoring, commute output, and notification decision recording without pushing to ntfy.

## Real ntfy Test

After setting `NYC_APT_RADAR_NTFY_TOPIC`, run:

```bash
npm run notify:test
```

This sends exactly one generic test push and no apartment details.

## Run One Agent Pass

With searches and preferences configured:

```bash
npm run doctor
npm run searches
npm run agent:run -- --no-notify
npm run radar
npm run notifications
```

`agent:run` records duplicate discovery events, search failures, listing updates, scores, and notification decisions. Remove `--no-notify` only after `npm run notify:test` succeeds.

## Deploy On An Ubuntu VPS With systemd

The cloud deployment is the same one-shot worker command on a timer:

```bash
npm run agent:run
```

Recommended VPS shape:

- Ubuntu with Node 20 or newer, npm, git, and systemd.
- Repo at `/opt/nyc-apt-radar`.
- SQLite at the default `data/nyc-apt-radar-loop.sqlite`, or an explicit persistent path in `NYC_APT_RADAR_DATABASE_PATH`.
- Secrets only in `/opt/nyc-apt-radar/.env`.
- ntfy remains the notification channel.

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

Edit these files on the VPS:

```text
/opt/nyc-apt-radar/.env
/opt/nyc-apt-radar/data/preferences.json
/opt/nyc-apt-radar/data/searches.json
```

Minimum `.env` values for the always-on worker:

```bash
NYC_APT_RADAR_PREFERENCES_PATH=data/preferences.json
NYC_APT_RADAR_SEARCHES_PATH=data/searches.json
NYC_APT_RADAR_NTFY_TOPIC=nyc-apt-radar-long-random-secret
NYC_APT_RADAR_NTFY_BASE_URL=https://ntfy.sh
# Optional if you want SQLite outside the repo data directory:
# NYC_APT_RADAR_DATABASE_PATH=/opt/nyc-apt-radar/data/nyc-apt-radar-loop.sqlite
```

Do not put the ntfy topic in the systemd unit. Keep secrets in `.env`; `.env*` is ignored by git except `.env.example`.

Verify before installing the timer:

```bash
npm run doctor
npm run notify:test
npm run agent:dry-run
npm run radar
npm run notifications
```

Install and start the systemd timer:

```bash
npm run agent:install:systemd -- --interval-minutes=60
```

Useful install options:

```bash
npm run agent:install:systemd -- --dry-run
npm run agent:install:systemd -- --interval-minutes=30
npm run agent:install:systemd -- --user=nyc-apt-radar
npm run agent:install:systemd -- --no-start
```

The helper runs app preflight as the current user, then uses `sudo` only to write:

```text
/etc/systemd/system/nyc-apt-radar.service
/etc/systemd/system/nyc-apt-radar.timer
```

By default, the installed service runs as the current Linux user. Use `--user=...` only when the repo is owned by a dedicated service account.

Example units are checked in for review or manual install:

```text
deploy/nyc-apt-radar.service.example
deploy/nyc-apt-radar.timer.example
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

## Deploy Locally With launchd

The LaunchAgent runs the one-shot command on an interval:

```bash
npm run agent:run
```

Install and start it:

```bash
npm run agent:install -- --interval-minutes=60
```

Useful install options:

```bash
npm run agent:install -- --dry-run
npm run agent:install -- --interval-minutes=30
npm run agent:install -- --no-load
```

The job uses this repo as its working directory, loads `.env.local` and `.env` through the app, and writes logs under ignored local files:

```text
data/logs/agent.log
data/logs/agent.err.log
```

View logs with:

```bash
npm run agent:logs
```

## Stop Local Deployment

```bash
npm run agent:uninstall
```

This unloads the LaunchAgent and removes the installed plist.

## Troubleshooting

Run:

```bash
npm run doctor
```

Common fixes:

- Missing ntfy: set `NYC_APT_RADAR_NTFY_TOPIC`, then run `npm run notify:test`.
- Empty radar: run `npm run reset`, then `npm run agent:run -- --no-notify`.
- Search failures: run `npm run searches`, then `npm run events`.
- Discovery history: run `npm run events`.
- Notification history: run `npm run notifications`.
- Deployment logs: run `npm run agent:logs`.
- VPS timer logs: run `journalctl -u nyc-apt-radar.service -n 80 --no-pager`.

## What Is Intentionally Out Of Scope

- Credentialed scraping
- CAPTCHA bypassing
- Stealth browser automation
- Platform evasion
- Automatic outreach sending
- Public broker marketplace features
- Multi-user features
- Payments
- Authentication
- Sensitive document storage
- Native mobile app
- Decorative web UI
