# NYC Apt Radar Workflow

## Operating Principle

Use Codex to keep the apartment search loop tight:

```text
discover -> finalize -> commute-score -> rank -> notify -> act -> update facts
```

Every change should make the local operator faster at spotting and acting on a real apartment lead.

Local commands load `.env.local` and `.env` automatically. Keep personal topics and paths there, not in committed files.

## Main Commands

```bash
npm run doctor
npm run verify:loop
npm run intake -- <url-or-file>
npm run discover
npm run logs
npm run sources
npm run watch
npm run watch:plist
npm run ntfy:setup
npm run notify:test
npm run notifications
npm run radar
npm run watch -- --once
npm run listing:draft -- <listing-id>
npm run listing:update -- <listing-id> --pets cats_allowed --fee-status no_fee --notes "showing notes"
npm run listing:status -- <listing-id> interested
```

## Source Intake

Preferred sources:

- `npm run intake -- <url>` for a lead in hand
- `npm run intake -- --file <path>` for listing exports or URL lists
- `pbpaste | npm run intake` for copied listing text
- saved-search email exports
- copied listing alerts
- configured public feeds
- manual one-off listing adds

Do not add credentialed scraping, CAPTCHA bypassing, stealth browsing, or source-specific automation that violates access controls.

## Scoring Loop

The score must remain deterministic:

- price
- location
- subway commute to configured target addresses
- apartment fit
- pet fit
- freshness
- completeness

OpenAI may help structure messy input text, but it does not rank listings or decide whether to act.

## Notification Loop

Hot listings are pushed through ntfy. Missing ntfy configuration is a failed readiness check, and delivery failures are recorded for retry.

Use `npm run ntfy:setup -- --write` to generate a long topic in `.env.local`, then subscribe to it in the ntfy app.

Notification dedupe is by listing and score so rerunning the loop does not spam unchanged matches.

Every discovery/watch cycle checks existing hot listings too, so failed ntfy attempts can be retried when notification setup is fixed.

Use `npm run notify:test` to verify phone push setup before leaving the watch loop running.
After discovery, use `npm run notify:test -- --listing <listing-id>` to verify the actual hot-listing notification format.

`npm run watch` fails fast on failed readiness checks.

Use `npm run watch:plist` to generate a macOS LaunchAgent for background scheduled runs. It prints by default and writes only with `--write`.
The writer refuses failed readiness checks.

## Verification

Before handoff:

```bash
npm run test
npm run typecheck
npm run build
npm run verify:loop
```

For loop smoke:

```bash
npm run reset
npm run doctor
npm run discover
npm run radar
npm run listing:update -- 56-ainslie-st-4g --pets unknown --fee-status unknown --notes "smoke test"
```

## Next Useful Threads

1. Expand `src/core/transit.ts` or replace it with GTFS-backed routing.
2. Add source-specific adapters only for allowed sources.
3. Add better notification summaries after real-world use.
4. Add a notification-history command if local audit inspection becomes annoying.
