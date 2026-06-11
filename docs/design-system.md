# Stoop shadcn/ui Design System

Stoop now uses shadcn/ui as the component foundation. The interface should feel like a calm, dense apartment command center: fast to scan, hard to misread, and focused on the next decision.

Primary files:

- `components.json`
- `src/components/ui/*`
- `src/components/layout/app-shell.tsx`
- `src/components/listings/listing-badges.tsx`
- `src/app/globals.css`

Core principles:

- Rent, neighborhood, address, score, eligibility, status, risk, next action, tour time, and readiness gaps stay visible.
- Use shadcn cards, buttons, badges, inputs, textareas, tabs, checkboxes, separators, and progress bars before inventing primitives.
- Keep cards shallow: do not nest cards inside cards.
- Favor compact rows, stable columns, and obvious primary actions over hero sections or decorative effects.
- Stubbed parser, outreach, upload, and draft-storage features must be labeled as stubs or disabled.
- Preserve local-first boundaries: no scraping, automatic messaging, authentication, payments, or sensitive document storage.
