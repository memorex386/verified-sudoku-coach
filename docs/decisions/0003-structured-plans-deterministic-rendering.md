---
id: ADR-0003
status: Accepted
date: 2026-09-03
---

# Use structured plans and deterministic factual rendering

## Context

Free prose offers personality but is difficult to prove safe. JSON schema prevents malformed
shape, not a false digit, unrelated cell, premature reveal, or invented technique.

## Decision

Observer and teacher models return strict structured decisions referencing allowed opportunity,
fact, template, and branch identifiers. Coach core performs runtime schema and semantic validation,
then renders all factual text from verified values and controlled templates. Bounded non-factual
transitions may be evaluated later as a separately gated capability.

## Rejected alternatives

- Rendering arbitrary model prose after keyword or digit filtering.
- Trusting tool/function-call structure as proof of semantic correctness.
- Removing AI entirely and labeling randomized templates as adaptive intelligence.

## Consequences

The AI role is pedagogical planning rather than factual authorship. Natural variation is narrower,
but every displayed claim has a deterministic source and unsafe output can be withheld before it
reaches a player.

## Verification

`VSC-AI-001`, `VSC-AI-002`, adversarial plan fixtures, and factual-renderer snapshot/property tests.
