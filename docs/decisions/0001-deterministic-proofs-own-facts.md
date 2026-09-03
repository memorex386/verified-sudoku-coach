---
id: ADR-0001
status: Accepted
date: 2026-09-03
---

# Deterministic proofs own Sudoku facts

## Context

Sudoku correctness is mechanical, while language models can produce fluent unsupported claims. A
teaching product loses trust if an explanation names an invalid candidate, elimination, or move.

## Decision

The deterministic proof engine is the sole authority for board validity, candidates, techniques,
placements, eliminations, proof relationships, and grading. AI receives an opaque set of already
verified opportunities and may select or arrange them; it never creates or approves Sudoku facts.
Every fact can be independently replayed from the supplied board fingerprint.

## Rejected alternatives

- Asking a language model to solve and using the stored solution as a spot check.
- Accepting plausible natural-language reasoning after schema validation alone.
- Letting the host UI calculate candidates independently from the proof engine.

## Consequences

The project invests more in proof representation and validators, but factual failures become
testable invariants. Unsupported puzzle states return an explicit deterministic outcome rather than
falling through to a model guess.

## Verification

`VSC-PROOF-001`, `VSC-PROOF-002`, proof property/metamorphic suites in WP-2026-002, and semantic plan
tests in WP-2026-003.
