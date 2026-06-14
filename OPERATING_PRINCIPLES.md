# Operating Principles

This repo is a bounded apartment discovery agent loop.

The goal is not to build a generic real estate app or another manual data-entry CLI. The goal is to discover relevant NYC listings, score them against real constraints, let a model-directed supervisor decide what evidence to inspect next, and notify or recommend only when a listing deserves attention.

## Product Judgment

Prefer the working loop over a polished surface.

A useful run does this:

1. Start from an explicit objective.
2. Observe local radar state through tools.
3. Set an explicit episode plan with success criteria, steps, stop conditions, risk checks, and confidence.
4. Update explicit working memory when focus, hypotheses, or next actions change.
5. Let the supervisor choose the next safe tool call and declare why it is useful now.
6. Take one tool action per model turn, observe the result, and only then choose the next action.
7. Apply runtime guardrails before executing the proposed tool call.
8. Collect candidate listings from configured StreetEasy searches when useful.
9. Extract normalized listing facts from inspectable structured surfaces.
10. Estimate commute quality across configured destinations.
11. Score and rank listings deterministically.
12. Inspect/critique the highest-signal evidence.
13. Notify, record evidence-carrying recommendations, or request structured operator review only when a listing is worth attention.
14. Stop with a structured decision against the episode plan.
15. Audit the episode against the local loop contract.
16. Evaluate the episode through a strict structured call, persist metric scores, and distill durable playbook directives for the next run.

Anything that does not improve this loop is suspect.

## Engineering Taste

Prefer deletion over abstraction.

Prefer explicit data flow over clever orchestration.

Prefer deterministic scoring over model judgment.

Prefer model-directed process over hardcoded data-entry choreography.

Prefer small CLI commands over framework-shaped interfaces.

Prefer inspectable state over hidden services.

Prefer boring names.

Prefer tests that protect behavior over tests that mirror implementation.

## Extraction Boundary

Keep extraction deterministic and inspectable.

Good inputs:

- StreetEasy JSON-LD
- configured public StreetEasy search results
- structured JSON fixtures in tests

Bad paths:

- model extraction of unsupported listing facts in the agent loop
- browser automation
- hiding missing data behind confident prose
- automatic outreach
- manual intake as a product workflow

Missing facts should stay missing until the source provides them or the operator updates them.

## Agent Boundary

The OpenAI supervisor may choose tools, inspect local evidence, critique the current state, draft outreach text, record recommendations, and request structured operator review.

It must not fetch outside configured public searches, use credentials, bypass access controls, send outreach, directly mutate listing status, or invent facts.

Runtime guardrails arbitrate proposed tool calls before execution. Rewrites and blocks are environment feedback, not silent behavior.

Model traces, episode plans, working memory, contract audits, episode evaluations, active experiments, playbook directives, and reflections are product data. Persist them and make them inspectable.

The initial run context is product data too. Persist which playbook entries, recent reflections, evaluations, audits, active experiment, and resumed operator review were available before the first model turn.

Reflections explain what happened. Experiments define what to try. Playbook entries define what future runs should obey by default. Do not collapse these into one vague memory blob.

Active experiments are episode constraints, not passive notes. When a run starts with one, the episode plan or working memory should show how the supervisor is testing it.

Do not synthesize fallback learning artifacts when the critic output is malformed. Failed evaluation is honest signal; fake lessons are worse than no lessons.

Verification is evidence, not vibes. `npm run agent:verify` should stay read-only and should fail when persisted runs do not prove the loop contract.

Loop causality is part of that contract. A passing run should not batch multiple tools before feedback, plan before observation, write operator-facing output before post-observation memory, or stop before plan and memory have shaped the decision.

Runtime should enforce that boundary, not merely diagnose it later: execute only the first tool call in a model turn and block any additional calls before side effects.

Recommendations and operator review requests are product data too. They must carry structured evidence from tool outputs, not just persuasive prose. Listing-specific writes must be trace-grounded in the same run; outreach and status recommendations require a prior `inspect_listing` call.

Operator review is the correct pause point when the loop reaches a subjective decision boundary. The request should ask one precise question, present bounded options, recommend one option, cite evidence, and mark itself blocking when the next autonomous action should wait.

Answered operator reviews are loop feedback. Persist the selected option, note, and resolution time, claim one resolved blocking review as continuation context for the next run, and keep review history visible to future agent runs through radar state.

## Notification Boundary

Notifications are side effects.

They must be deduped, auditable, and limited to high-signal matches.

Never spam. Never send outreach automatically.

## Review Standard

A change is good if it makes the apartment radar more useful, more reliable, or easier to run.

A change is bad if it adds surface area without improving discovery, scoring, explanation, notification, or operator control.

When in doubt, cut the part.
