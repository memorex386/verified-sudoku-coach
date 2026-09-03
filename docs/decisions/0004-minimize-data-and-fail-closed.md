---
id: ADR-0004
status: Accepted
date: 2026-09-03
---

# Minimize data and fail closed

## Context

An adaptive coach could accumulate full boards, action histories, identities, prompts, responses,
and retries. That would expand privacy, security, cost, and reliability risk without being required
for one teaching decision.

## Decision

Project only the minimal verified facts and coarse learner state needed for one model call. Do not
send identity, unrelated games, full account context, or retained conversation. Bound input,
output, latency, retries, events, and spend. Schema, semantic, provider, quota, or budget failure
pauses AI visibly and offers deterministic alternatives. A response for an obsolete board revision
is discarded as typed `stale`, never displayed or treated as a failure fallback. Neither path
silently weakens a gate or automatically loops.

## Rejected alternatives

- Sending the full session so the model can infer context freely.
- Storing provider transcripts indefinitely for debugging.
- Automatic retries and a second model fallback that can amplify cost and duplicate requests.

## Consequences

Some personalization signals are unavailable and private hosts must implement lifecycle controls.
Failures are more visible, but user agency, bounded cost, and data minimization remain inspectable.

## Verification

`VSC-AI-002`, `VSC-PRIV-001`, `VSC-PRIV-002`, request-projection/sentinel tests, and private host
integration tests.
