---
id: WP-2000-000
title: Replace with a bounded outcome
status: Draft
depends_on: none
owner: Maintainer
base_branch: main
accepted_plan: VSC-PLAN-2000-01-01.1
data_classification: Public
acceptance: VSC-FOUND-001
updated: 2000-01-01
---

# Replace with a bounded outcome

Copy this file to the next numbered path and replace every example before requesting `Ready`.

## Goal

State the observable outcome.

## User value

State who benefits and how.

## Non-goals

Bound the work explicitly.

## Governing ADRs

Link the decisions and contracts that control this work.

## Allowed edit surface

List directories and generated artifacts this package may change.

## Affected interfaces

List public, wire, host, storage, or operational interfaces.

## Architecture and privacy invariants

State the invariants that must remain true.

## Acceptance criteria

Translate the cited IDs into package-specific observable outcomes.

## Validation

List exact commands and evidence expectations; replace with actual results during implementation.
For `Done`, record every deduplicated command from the fenced blocks as
`- \`<exact command>\`: PASS — <evidence>`, including `npm run verify`; failed, cancelled,
ambiguous, omitted, or separately passing prose is not accepted.

## Delivery evidence

Record commits, PRs, releases, reports, and CI links when they exist.
For `Done`, use a Markdown link to this repository's merged PR or published GitHub Release and cite
its full 40-digit SHA. The cited remote head/tag must touch this work-package record and be
integrated into `main`; unavailable or ambiguous GitHub evidence fails closed.

## Known limitations and blockers

State current limitations and external decisions without hiding uncertainty.

## Next action

- Leave exactly one concrete unblocked action.

## Checkpoints

After implementation begins, append dated checkpoints and never rewrite earlier entries.
