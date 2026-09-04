---
id: ADR-0008
status: Accepted
date: 2026-09-04
---

# Bound autonomous maintenance and release

## Context

Dependency pull requests are repetitive and measurable, but failures can arise from ecosystem
incompatibility, compromised dependencies, unsafe scripts, major toolchain shifts, CI
infrastructure, or application regressions. Combining diagnosis, repository write, merge, and
production credentials in one agent would turn an incorrect judgment or injected instruction into
an unbounded side effect. Recursive repair/deploy loops also obscure cost and final responsibility.

## Decision

Use a deterministic, finite state machine for dependency stewardship. Verify source and exact SHA,
classify without a model when possible, allow one inexpensive diagnosis, at most one stronger
escalation, one repair, and one recognized-infrastructure rerun. The model returns a strict proposal;
separate brokers enforce file/dependency allowlists, compare-and-swap publication, required checks,
and merge policy. Every run terminates as completed, deferred, stale, awaiting approval, escalated,
or failed terminal.

Begin in shadow mode. Initial future auto-merge eligibility is semver-patch, existing npm
development dependencies with an untouched manifest/lockfile-only Dependabot change and all exact-
SHA checks green. AI-authored repairs require human review during the evidence phase. A human owns
the versioned eligibility policy and can revoke it.

Release is a different authority. Production stays human-gated during the evidence phase. A later
eligible reversible deployment may run once and roll back once to a known immutable artifact; it
then verifies the rollback and stops. Irreversible or stateful releases never enter automatic
rollback.

## Rejected alternatives

- Give one agent repository administration and production credentials.
- Ask a model to choose models, retries, permissions, or deployment strategy recursively.
- Merge any Dependabot change whose visible checks happen to be green.
- Bypass peer constraints or weaken tests to repair an update.
- Retry repair, deployment, or rollback until the system appears healthy.
- Automatically fix forward after a failed production verification.

## Consequences

Many updates will defer or request review, especially early. The workflow can demonstrate lower
cost through deterministic decisions and safer autonomy through bounded privileges. Full
automation expands only after public evaluation supports the policy change. A terminal escalation
is an expected safe result rather than a workflow failure.

## Verification

`VSC-OPS-004`, the machine-readable automation policy, adversarial workflow fixtures, exact-SHA,
replay-dedupe, and monotonic lineage-cap tests, public execution records, protected required checks
before activation, and rollback rehearsal before any release authority expands.
