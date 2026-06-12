# NYC Apt Radar shadcn/ui Design System

NYC Apt Radar uses shadcn/ui as the component foundation. The interface should feel like a calm scanner console: fast to scan, hard to misread, and focused on the next action.

Primary files:

- `components.json`
- `src/components/ui/*`
- `src/components/layout/app-shell.tsx`
- `src/components/listings/listing-badges.tsx`
- `src/app/globals.css`

Core principles:

- Rent, neighborhood, address, source, score, classification, risk, next action, tour time, and readiness gaps stay visible.
- Use shadcn cards, buttons, badges, separators, progress bars, and real form controls before inventing primitives.
- Keep cards shallow: do not nest cards inside cards.
- Favor compact rows, stable columns, and obvious primary actions over hero sections or decorative effects.
- Future parser, outreach, upload, map, commute, and draft-storage features must stay out of the Radar console until they work.
- Preserve local-first boundaries: no scraping, automatic messaging, authentication, payments, or sensitive document storage.
