# Operating Principles

This repo is an automated apartment discovery loop.

The goal is not to build a generic real estate app. The goal is to discover relevant NYC listings, score them against real constraints, explain the tradeoffs, and notify Hunter when a listing deserves attention.

## Product Judgment

Prefer the working loop over a polished surface.

A useful run does this:

1. Collect candidate listings from configured StreetEasy searches.
2. Extract normalized listing facts.
3. Estimate commute quality across configured destinations.
4. Score and rank listings deterministically.
5. Explain the score clearly.
6. Notify only when a listing is worth attention.
7. Preserve enough state to avoid duplicate work.

Anything that does not improve this loop is suspect.

## Engineering Taste

Prefer deletion over abstraction.

Prefer explicit data flow over clever orchestration.

Prefer deterministic scoring over model judgment.

Prefer small CLI commands over framework-shaped interfaces.

Prefer local, inspectable state over remote services.

Prefer boring names.

Prefer tests that protect behavior over tests that mirror implementation.

## Extraction Boundary

Keep extraction deterministic and inspectable.

Good inputs:

- StreetEasy JSON-LD
- structured JSON files for manual intake
- explicit listing URLs saved as URL-only leads

Bad paths:

- model extraction in the hourly loop
- browser automation
- hiding missing data behind confident prose
- automatic outreach

Missing facts should stay missing until the source provides them or the operator updates them.

## Notification Boundary

Notifications are side effects.

They must be deduped, auditable, and limited to high-signal matches.

Never spam. Never send outreach automatically.

## Review Standard

A change is good if it makes the apartment radar more useful, more reliable, or easier to run.

A change is bad if it adds surface area without improving discovery, scoring, explanation, notification, or operator control.

When in doubt, cut the part.
