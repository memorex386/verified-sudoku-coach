---
id: WP-2026-002
title: Agent and provider portability foundation
status: In progress
depends_on: WP-2026-001
owner: Maintainer
base_branch: main
accepted_plan: VSC-PLAN-2026-09-04.2
data_classification: Public
acceptance: VSC-ARCH-007, VSC-OPS-004, VSC-EVID-003
updated: 2026-09-04
---

# Agent and provider portability foundation

## Goal

Establish one vendor-neutral control-plane contract for product-model adapters and engineering
agents, plus a bounded dependency/release stewardship policy, before product contracts freeze.

## User value

Contributors and reviewers can replace a model provider or coding-agent runtime through a small
adapter while retaining the same proof, privacy, validation, cost, evidence, and authorization
controls. Recruiter-facing automation claims can point to executable boundaries rather than a
brand-specific demonstration.

## Non-goals

No Sudoku feature, live provider call, alternate-provider quality claim, automated merge,
deployment, production credential, reviewer provider switch, remote-agent service, MCP server, or
public release is implemented or authorized here.

## Governing ADRs

ADR-0001 through ADR-0006 remain in force. ADR-0007 owns capability-based adapter composition and
ADR-0008 owns bounded dependency/release stewardship. Architecture principles, trust boundaries,
runtime-manifest versioning, AI-development provenance, and the agent workflow also govern.

## Allowed edit surface

Public architecture, contract, acceptance, threat, provenance, playbook, runbook, plan, work-package,
and ADR records; root and thin agent entrypoints; canonical skills and their adapters; provider and
architecture policy manifests; foundation verification scripts, fixtures, and focused tests; empty
workspace comments whose work-package IDs changed.

## Affected interfaces

`ProviderProfileV1`, `ExtensionManifestV1`, `WorkOrderV1`, `WorkResultV1`, `AutomationSpecV1`,
`TriggerEventV1`, `TrustedPullRequestEventV1`, `DependencyChangeV1`, `ExecutionRecordV1`, runtime
registration identity, browser/provider-boundary policy, repository instruction discovery, skill
discovery, future branch names, and PR/release authorization states.

## Architecture and privacy invariants

Sudoku truth and workflow authorization remain deterministic. Imported instructions, events,
provider output, and agent output are untrusted data. Effective capability is the intersection of
the registered adapter, workflow, work order, and current human authorization. Provider and agent
identities remain visible in provenance; capability abstraction never erases them. Credentials and
private content stay outside public requests and evidence. No fallback, retry, merge, deploy, or
rollback can occur merely because a model requests it.

## Acceptance criteria

The cited gates require machine-checked neutral entrypoints, an exact provider-policy descriptor,
cross-provider browser exclusions, unambiguous runtime behavior identity, portable contracts, and
a finite dependency/release state machine. OpenAI is retained as the initial candidate adapter,
while structural claims about Claude/Gemini entrypoints are distinguished from unmeasured runtime
quality or live-agent behavior.

## Validation

```powershell
npm run docs:check
npm run architecture:check
npm run runtime-ai:check
npm run automation:check
npm run automation:fixture
npm run skills:check
npm test
npm run typecheck
npm run verify
git diff --check
```

Record exact results before handoff. Independent review must also test a foreign-provider browser
escape, a stale/over-privileged work order, a repeated dependency failure fingerprint, and one
fresh-agent discovery path without using credentials.

On Windows, these exact commands passed on 2026-09-04:

- `npm run docs:check`: PASS — documentation, links, ADR, acceptance, and registry rules passed.
- `npm run architecture:check`: PASS — dependency, core purity, provider, and browser boundaries
  passed.
- `npm run runtime-ai:check`: PASS — exact provider/runtime policy and transition checks passed.
- `npm run automation:check`: PASS — the admitted shadow policy and fixture identity passed.
- `npm run automation:fixture`: PASS — TypeScript 7.0.2 was deterministically `deferred` for
  `compiler-or-build-tool` and `peer-conflict`, with zero model, repair, mutation, or network calls.
- `npm run skills:check`: PASS — canonical skills and thin Claude/Gemini adapters matched.
- `npm test`: PASS — all 112 validation and adversarial tests passed.
- `npm run typecheck`: PASS — strict project-reference compilation passed.
- `npm run verify`: PASS — the complete credential-free aggregator passed.
- `git diff --check`: PASS — no whitespace errors.

`npm ci` also passed with zero reported vulnerabilities, and the external skill-creator validator
reported `Skill is valid!` for `steward-dependency-pr`.

## Delivery evidence

Implementation is recorded on `codex/agent-portability`, including audited controller head
[`d486c5236deb4caa2e065a4b6c464f01ed1418ba`](https://github.com/memorex386/verified-sudoku-coach/commit/d486c5236deb4caa2e065a4b6c464f01ed1418ba),
and is under review in open
[PR #4](https://github.com/memorex386/verified-sudoku-coach/pull/4). No release exists, and no
merge, deployment, provider spend, or live automation is authorized. Its
[checks](https://github.com/memorex386/verified-sudoku-coach/pull/4/checks) pass on Windows, Ubuntu,
CodeQL, and dependency review.

## Known limitations and blockers

Only static discovery and credential-free conformance are in scope. OpenAI remains the first
planned runtime adapter; its current hosted routes are mutable candidates with provider-default
abuse monitoring and unverified private-host retention control, so they cannot yet be approved.
Claude, Gemini, and open-weight quality, latency, cost, and data handling remain unmeasured until
their own registered adapters and authorized comparative evaluations exist. The in-memory result
and lineage stores are conformance fakes, not production persistence; host authentication, durable
compare-and-swap storage, and time/token/cost budget enforcement remain live-runner work. The
credential-free reference controller should be split into focused codec, state/history, and store
modules before such a runner is accepted.
Until PR #4 is merged, the amended WP-2026-002 exists only on its review branch; a fresh agent must
discover the open PR rather than relying on the older default-branch ID mapping. A feature-only
single-branch clone must fetch `origin/main` before the work-package verifier can compare its base.

## Next action

- Await maintainer review and remote CI for PR #4; make only evidence-backed corrections without merging, deploying, spending, or publishing.

## Checkpoints

- 2026-09-04 — Maintainer accepted a single-provider reviewer cohort and provider-/agent-neutral contracts; portability foundation implementation began before WP-2026-003 readiness.
- 2026-09-04 — Independent claim review rejected broad storage, alternate-provider, open-weight, and frozen-route claims; exact policy variants and approval blockers replaced them.
- 2026-09-04 — Integrated architecture/threat review exercised policy admission, persisted-state
  decoding, work-order renewal, grants, replay storage, lineage caps, exact-SHA mutation, terminal
  paths, and rollback. Findings were converted into regressions; all 112 tests and the full
  credential-free verifier pass with the live runner explicitly out of scope.
- 2026-09-04 — Public PR #4 opened from the validated branch. The work package remains In progress
  pending remote CI and maintainer review; no merge, release, deployment, spend, publication, or
  live automation occurred.
- 2026-09-04 — A fresh agent given only the public repository URL and WP-2026-002 found PR #4 and
  governing authorities, explained the trust/authority split, passed a clean credential-free
  verifier with 112/112 tests, and chose the exact review-only next action (4/4 checklist PASS).
  It recorded the pre-merge default-branch ID mapping and shallow-feature-clone base-ref caveats.
