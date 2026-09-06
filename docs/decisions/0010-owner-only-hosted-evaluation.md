---
id: ADR-0010
status: Accepted
date: 2026-09-06
---

# Owner-only hosted evaluation

## Context

The local adaptive interaction was accepted. The maintainer requested a minimal authenticated
hosted follow-up before expanding technique coverage or reviewer exposure.

## Decision

The maintainer accepted the owner-only pilot proposal and instructed implementation after
merging PR #24. Permit its default-off private gateway and subsequent isolated screen using
only the unchanged original generated local puzzle and verified single-hint behavior.

For this screen only, defer private corpus conformance: no ordinary host boards, legacy solver
replacement, parity or full proof acceptance are included. Permit candidate teacher evaluation
under an explicitly provisioned owner trial, retaining mutable-model and provider-retention
disclosures. This is not approved cohort admission. Permit compiled development artifacts built from one
exact reviewed merged public commit, checked by integrity and consumed without source forks.
These artifacts are not a public release or evidence that release gates passed.

The private host owns verified authentication, exact owner matching, atomic attempt reservation,
deduplication, expiry, secret handling and metadata-only durable state. Conversation remains
transient. Preserve deterministic factual authority, independent validation and all limits in
the accepted pilot contract. Existing local trial permission does not authorize hosted spend.

Deploying, enabling an account or paying for hosted inference each require separate explicit
authorization after the implementation is reviewable. Reviewer and commercial rollout gates
remain unchanged. Verify with mocked transport and local Auth/Firestore emulators first.

## Rejected alternatives

Ordinary-board integration would require private compatibility evidence. A full showcase release
would expand this small owner evaluation. Neither is needed to evaluate the existing interaction.

## Consequences

The host can prepare one isolated evaluation while preserving the full release gates. Candidate
model quality and development artifact evidence stay explicitly limited; no learning claim follows.

## Verification

Run public `npm run verify` and the host's focused `npm run test:coach-owner-alpha` with demo
Auth/Firestore emulators and mocked inference. The pilot contract defines access, grant, stale
delivery and privacy checks. Deployment and live hosted measurement are separate checkpoints.
