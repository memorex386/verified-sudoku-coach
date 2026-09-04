---
id: WP-2026-001
title: Public repository foundation
status: Done
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

- `npm ci`: PASS — clean lockfile install with lifecycle scripts disabled by repository policy.
- `npm run doctor`: PASS — Node/npm pins, branch isolation, and credential-free operation verified.
- `npm run lint`: PASS — zero warnings.
- `npm run verify`: PASS — every foundation gate and all 69 validation tests passed.
- `npm run eval:replay`: PASS — exact truthful bootstrap result: `not_implemented`, zero cases, and
  `claimsMeasured: false`.
- `npm run docs:check`: PASS — documentation, links, ADRs, and generated registry verified.
- `git diff --check`: PASS — no whitespace errors.

The skill-creator validator passed each of the five canonical skill directories. CI repeated the
root verification on Windows and Ubuntu and passed CodeQL and dependency review before acceptance.

## Delivery evidence

Delivery head
[`f781b9ae25a1ab45865c3862d230f218862a09f8`](https://github.com/memorex386/verified-sudoku-coach/commit/f781b9ae25a1ab45865c3862d230f218862a09f8)
was accepted and integrated into `main` through merged
[PR #1](https://github.com/memorex386/verified-sudoku-coach/pull/1) on 2026-09-03. Merge commit
[`619277d4d714be49135918abd977192f2abc1d59`](https://github.com/memorex386/verified-sudoku-coach/commit/619277d4d714be49135918abd977192f2abc1d59)
preserves that audited delivery head in public history. Its
[checks](https://github.com/memorex386/verified-sudoku-coach/pull/1/checks) passed on Windows,
Ubuntu, CodeQL, and dependency review. The
[workflow record](../../evidence/workflows/WF-2026-001-foundation.md) captures implementation,
review, fresh-clone continuity, and human acceptance evidence.

## Known limitations and blockers

No WP-2026-001 blocker remains. GitHub dependency alerts, the read-only dependency graph, private
vulnerability reporting, and Dependabot security updates are enabled and rechecked. This remains a
foundation-only delivery: the replay command reports zero cases and `claimsMeasured: false`, so it
is not evidence of Sudoku correctness, model quality, coaching quality, latency, cost,
accessibility, or player benefit. The 2026-09-04 accepted amendment inserted a portability
foundation as WP-2026-002; that new package is independently governed and does not change this
package's accepted evidence.

## Next action

- No action remains in WP-2026-001; follow the generated registry for the current package.

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
- 2026-09-03 — The maintainer authorized proceeding with the foundation; private vulnerability
  reporting and Dependabot security updates were enabled and rechecked successfully before the
  delivery PRs merged.
- 2026-09-03 — PR #1 merged through merge commit
  `619277d4d714be49135918abd977192f2abc1d59`, preserving audited delivery head
  `f781b9ae25a1ab45865c3862d230f218862a09f8` as an ancestor of `main`; WP-2026-001 was accepted.
- 2026-09-04 — Accepted plan amendment VSC-PLAN-2026-09-04.2 inserted a new portability
  foundation as WP-2026-002 and renumbered the unstarted packages; WP-2026-001 evidence remains
  governed by its original accepted plan.
