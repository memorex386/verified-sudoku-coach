---
id: ADR-0006
status: Accepted
date: 2026-09-03
---

# Gate runtime AI changes with versioned evaluation

## Context

Behavior can change when a prompt, model alias, returned model, schema, inference setting, fixture,
scorer, or provider changes even if application code does not. Anecdotal examples and cherry-picked
outputs cannot support a reliability claim.

## Decision

Register every runtime route by prompt/schema hashes, model request/settings, bounds, storage choice,
visible failure policy, and eval-suite version. Require deterministic frozen replay in CI and protected live
comparison before approving behavior changes. Reports account for every case, subgroup, failure,
latency, token, cost, exclusion, and limitation. Release evidence binds these versions to a commit.

## Rejected alternatives

- Testing a few prompts manually and storing screenshots.
- Tracking only the provider model name.
- Publishing raw transcripts so reviewers can judge quality themselves.
- Moving thresholds after results are known.

## Consequences

AI changes take longer and live results are protocol-reproducible rather than byte-identical. The
project gains a reviewable quality history and can choose the least expensive model that clears the
same gates without changing factual authority.

## Verification

`VSC-AI-003`, `VSC-EVAL-001`, runtime-manifest validation, comparative reports, and
`VSC-EVID-001`.
