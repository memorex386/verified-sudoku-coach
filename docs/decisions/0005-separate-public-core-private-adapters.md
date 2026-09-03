---
id: ADR-0005
status: Accepted
date: 2026-09-03
---

# Separate the clean public core from private product adapters

## Context

Sudoku World contains private configuration, historical material, product operations, and content
whose redistribution provenance is not established. Making that repository public or copying it
here would expose risk and weaken the portfolio evidence.

## Decision

Build this repository from an empty clean history using original generic code and independently
generated fixtures. Keep proofs, coaching contracts/policy, provider adapter, eval harness, and
static replay public. Keep auth, Firebase persistence, allowlists, budgets, private telemetry,
production traces, native integration, and product business records in the private host. Sudoku
World consumes an exact public release/commit and records compatibility; no private fork is allowed.

## Rejected alternatives

- Flipping the existing private monorepo to public after a shallow secret scan.
- Copying selected private folders and preserving their history.
- Keeping the entire coach private and publishing only a prose case study.

## Consequences

Integration requires explicit adapters and version management. The public evidence is cleaner,
reviewers can run the core safely, and a future public app must still be a separate sanitized export
rather than a visibility change to private history. That export requires clean history, rotation of
signing credentials, replacement public configuration, and explicit puzzle, font, and asset
provenance review before any publication decision.

## Verification

`VSC-PRIV-001`, `VSC-ARCH-002`, the public-boundary scan/playbook, provenance records, and private
compatibility tests.
