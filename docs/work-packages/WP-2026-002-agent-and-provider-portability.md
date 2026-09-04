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
`TriggerEventV1`, `ExecutionRecordV1`, runtime registration identity, browser/provider-boundary
policy, repository instruction discovery, skill discovery, future branch names, and PR/release
authorization states.

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
npm run skills:check
npm test
npm run typecheck
npm run verify
git diff --check
```

Record exact results before handoff. Independent review must also test a foreign-provider browser
escape, a stale/over-privileged work order, a repeated dependency failure fingerprint, and one
fresh-agent discovery path without using credentials.

## Delivery evidence

No delivery PR or release exists yet. This package records the accepted maintainer decision and the
implementation branch remains under review.

## Known limitations and blockers

Only static discovery and credential-free conformance are in scope. OpenAI remains the first
planned runtime adapter; Claude, Gemini, and open-weight quality, latency, cost, and data-handling
remain unmeasured until their own registered adapters and authorized comparative evaluations exist.

## Next action

- Complete credential-free validation and independent portability/threat review, then open the foundation-amendment pull request without merging it.

## Checkpoints

- 2026-09-04 — Maintainer accepted a single-provider reviewer cohort and provider-/agent-neutral contracts; portability foundation implementation began before WP-2026-003 readiness.
