---
id: WP-2026-001
title: Public repository foundation
status: In progress
depends_on: none
owner: Maintainer
base_branch: main
accepted_plan: VSC-PLAN-2026-09-03.1
data_classification: Public
acceptance: VSC-FOUND-001, VSC-FOUND-002, VSC-ARCH-001, VSC-PRIV-001
updated: 2026-09-03
---

# Public repository foundation

## Goal

Establish a clean Apache-2.0 repository whose architecture, decisions, work state, acceptance,
privacy, evaluation, provenance, and agent workflow are usable without prior conversation history.

## User value

Reviewers can inspect the engineering method before trusting feature claims, and future agents can
continue from one durable work-package record instead of reconstructing intent.

## Non-goals

No Sudoku behavior, model call, measured result, public release, Pages deployment, private host
integration, or production spend is implemented or claimed in this package.

## Governing ADRs

ADR-0001 through ADR-0006 establish deterministic authority, inward dependencies, structured-plan
validation, visible safe failure, public/private ownership, and versioned evaluation releases.

## Allowed edit surface

Repository metadata; root/scoped agent guidance; `docs/`; `.agents/skills/`; workspace boundary
manifests and empty entrypoints; architecture, documentation, work-package, security, and CI
verification scripts.

## Affected interfaces

Workspace names and dependency edges, documentation authority, work-package schema, acceptance IDs,
skill entrypoints, contributor workflow, and credential-free root commands.

## Architecture and privacy invariants

The package graph matches the accepted functional-core/imperative-shell boundaries. Public history
contains only independently authored public material; no private identifiers, source, puzzles,
configuration, user/model traces, credentials, or hidden reasoning may appear.

## Acceptance criteria

All cited acceptance gates must have observable local and CI evidence. Review confirms the source
entrypoints are boundary markers only and every public claim remains explicitly unmeasured.

## Validation

On Windows, these exact commands passed on 2026-09-03:

```powershell
npm ci
npm run doctor
npm run lint
npm run verify
npm run eval:replay
npm run docs:check
git diff --check
```

The skill-creator validator also passed each of the five canonical skill directories. CI must
repeat the root verification on Windows and Ubuntu before acceptance.

## Delivery evidence

The foundation implementation is commit
[`1e0ca4a4d19c04820a51e103c0492883de8bc6ef`](https://github.com/memorex386/verified-sudoku-coach/commit/1e0ca4a4d19c04820a51e103c0492883de8bc6ef)
on `codex/coach-foundation`. [PR #1](https://github.com/memorex386/verified-sudoku-coach/pull/1)
is open and clean; its [checks](https://github.com/memorex386/verified-sudoku-coach/pull/1/checks)
passed on Windows, Ubuntu, CodeQL, and dependency review. The
[workflow record](../../evidence/workflows/WF-2026-001-foundation.md) captures implementation,
review, and fresh-clone continuity evidence. Merge and maintainer acceptance remain pending and are
not claimed.

## Known limitations and blockers

Feature work is intentionally gated on maintainer acceptance of this foundation. The replay command
reports zero cases and `claimsMeasured: false`; it is not evidence of model or coaching quality.
GitHub dependency alerts and the read-only dependency graph were enabled on 2026-09-03, after which
dependency review passed. Private vulnerability reporting and Dependabot security updates remain
disabled. The maintainer must enable and recheck both settings before accepting the foundation;
until then, `SECURITY.md` directs reporters to the profile contact fallback.

## Next action

- Enable and recheck private vulnerability reporting and Dependabot security updates before foundation acceptance; do not merge or begin WP-2026-002.

## Checkpoints

- 2026-09-03 — Clean repository bootstrapped; governance, boundaries, validators, and public-safety controls implemented for review.
- 2026-09-03 — Independent review corrected package ownership, project references, skill/work-package drift, verifier gaps, and an unpushed private-identifier disclosure; local credential-free validation passed.
- 2026-09-03 — A sibling read-only `main` worktree was established before the foundation commit; the feature checkout remains isolated on `codex/coach-foundation`.
- 2026-09-03 — Fresh-agent continuity and all five independent skill forward checks passed; the agent identified the foundation PR as the only unblocked next action.
- 2026-09-03 — Final adversarial review closed historical-disclosure, work-state, remote-evidence,
  lint, dependency-alias, TypeScript-configuration, architecture-policy/source-closure,
  runtime-identity/version, endpoint-authorization, stale-outcome, and future-lifecycle gaps; the
  complete validation suite passes.
- 2026-09-03 — Independent final review passed after CI policy, npm lifecycle isolation,
  public-boundary path/history handling, and architecture false-pass regressions were locked; only
  documented maintainer settings and pull-request review remain before foundation acceptance.
- 2026-09-03 — Public PR #1 opened; all five remote checks passed after enabling GitHub dependency
  alerts and the read-only dependency graph. No merge, release, deployment, spend, or feature work
  occurred.
- 2026-09-03 — A fresh agent given only the public repository URL and WP-2026-001 passed the
  repository-defined authority, trust-boundary, credential-free validation, and next-action
  checklist at PR head `1e0ca4a4d19c04820a51e103c0492883de8bc6ef`.
