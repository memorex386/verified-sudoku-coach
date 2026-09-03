# Product charter

- Accepted plan: [VSC-PLAN-2026-09-03.1](plans/VSC-PLAN-2026-09-03.1.md)
- Status authority: Generated [work-package registry](../work-packages/)
- Evidence: Planned / unmeasured
- Audience: Invite-only cohort of 8–12 adult hiring reviewers, engineers, or recruiters; public
  engineering reviewers; and future maintainers

## Problem

Ordinary Sudoku hints often reveal an answer without helping a player learn why the move is valid.
An unconstrained language model can sound helpful while inventing candidates or logic, which is an
unacceptable failure mode for instruction.

## Goal

Demonstrate that deterministic software can prove the puzzle facts while a bounded AI layer adapts
the timing, question, and depth of a calm Socratic lesson. Demonstrate the engineering method as
clearly as the eventual experience: explicit boundaries, versioned prompts/contracts, adversarial
evaluation, privacy controls, failure handling, and honest evidence.

## Planned first experience

- One independently generated 9x9 Classic Sudoku showcase targeting approximately 20 minutes and
  exposing locked candidates plus a naked pair early; timing remains unmeasured until observed.
- Easy through Hard reasoning using naked singles, hidden singles, locked candidates (pointing and
  claiming), naked pairs, and hidden pairs.
- Calm Socratic interventions with progressive nudges and exact-move explanations where the player
  still places the move.
- Every player action enters a deterministic trace. Latest-wins cadence allows one billable call in
  flight, at least five seconds between background calls, and immediate explicit-help processing.
- A target of 8–15 displayed interventions with no score, rank, ads, hint currency, Journey reward,
  challenge, race, or normal-statistics effect.
- A small local learner profile with coarse technique bands and a learning recap rather than a
  score or rank.
- Optional browser text-to-speech, off by default, with no microphone input.
- A static public replay using approved synthetic model plans. Live model access remains local or
  server-side and is never embedded in the public browser bundle.
- Provider, validation, trace-limit, kill-switch, or budget failure visibly pauses Coach Mode while
  preserving board play. Recovery is explicit Retry, uncoached continuation, or a requested
  deterministic verified clue; there is no silent fallback. A response for an obsolete board
  revision is discarded as typed `stale` and never displayed as a lesson.

## Non-goals for the first release

- Training or fine-tuning a model.
- Letting a model solve, grade proof correctness, invent moves, or directly mutate a board.
- Free-form player chat, microphone input, or open-ended personal advice.
- Fast, Expert, Killer, Daily, race, challenge, ranked, ad, achievement, or normal-statistics modes.
- A claim of proven player learning, retention, revenue, or general product-market fit.
- Publishing Sudoku World source, private infrastructure, private puzzle corpora, or production
  traces.

## Success and claim boundary

Technical claims require the [acceptance catalog](../acceptance/catalog.md) and versioned evaluation
reports. Reviewer feedback will be reported as exact counts over a small invited cohort with stated
selection bias. “Verified AI orchestration” and “AI-assisted engineering” are accurate descriptions;
“model training” is not.

Until a report is committed, every feature-quality, latency, cost, accessibility, and player-value
claim remains **Planned / unmeasured**.
