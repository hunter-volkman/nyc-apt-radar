# NYC Apt Radar Interface Style

NYC Apt Radar is not a lease CRM. It is a scanner console for a time-sensitive NYC apartment hunt.

The interface should feel like a calm operations desk:

- Radar is the primary surface.
- The first screen must show loop health, hot leads, review leads, last run, push state, and recent source events.
- Avoid explanatory product copy. Use short operational labels.
- Avoid fake controls. If the app cannot do something yet, do not render an active-looking control for it.
- Keep rows dense, readable, and phone-safe.
- Use shadcn cards, badges, buttons, separators, progress, and form controls where they are doing real work.
- No decorative map panel, glassmorphism, giant hero, marketing section, or placeholder visualization.
- Prioritize speed of action over completeness: open original listing, copy outreach, mark contacted, kill.

Copy rules:

- Say "hot lead", "needs review", "watch", "rejected", "last run", "source event", and "push".
- Do not say "demo", "sample", "mock", or "manual import" in app-visible scanner UI.
- Do not mention personal names in variables, copy, fixtures, or generated outreach.
- Use "NYC Apt Radar" for the product name and `nyc-apt-radar` for package/repo naming.
