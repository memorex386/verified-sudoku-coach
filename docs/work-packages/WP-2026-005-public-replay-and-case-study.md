---
id: WP-2026-005
title: Public replay and pre-results case study
status: Draft
depends_on: WP-2026-004
owner: Maintainer
base_branch: main
accepted_plan: VSC-PLAN-2026-09-03.1
data_classification: Public
acceptance: VSC-UX-002, VSC-EVID-001
updated: 2026-09-03
---

# Public replay and pre-results case study

## Goal

Build an evaluated static React/Vite replay, architecture visualization, one-command local demo,
AI-workflow narrative, evidence map, limitations, and immutable package/demo release candidate.
Prepare the public-safe URL/evidence handoff for a companion Sudoku World information page.

## User value

Hiring reviewers can experience and audit the verified-orchestration design without an account,
credential, live model, or unsupported claim.

## Non-goals

No live inference, private puzzle or recording, participant result claim, Sudoku World source,
automatic Pages publication, production deployment, invitation, or automatic Sudoku World demo
link is part of this package. The private repository owns that information page and link change.

## Governing ADRs

ADR-0005 and ADR-0006; release, public-boundary, evaluation, provenance, and accessibility guidance;
the product charter and evidence acceptance gate.

## Allowed edit surface

`apps/replay-web`, approved generated fixture and synthetic recording artifacts, architecture
visualization, public evidence/case-study docs, package/release tooling, Pages workflow disabled by
default, a public-safe release URL/evidence handoff for the private information page, and directly
affected tests/manifests.

## Affected interfaces

`ReplayArtifactV1`, browser-safe package exports, replay route/state, accessibility semantics,
release manifest, artifact hashes/provenance, evidence map, recruiter-oriented documentation, and
the publication-authorized demo URL consumed by the private information page.

## Architecture and privacy invariants

Replay data is generated or reviewed synthetic material. The browser performs no provider call and
contains no provider adapter/key name. Recorded behavior is labeled replay; results are labeled
technical evaluation or goals, never live personalization or demonstrated learning.

## Acceptance criteria

The canonical recording shows the six-technique story and 8–15 interventions, reproduces locally,
passes keyboard/touch/screen-reader and responsive checks, and binds every factual display to a
proof. Release JSON reproduces its Markdown evidence and artifact hashes. A companion private work
item owns the Sudoku World information page; its demo link remains absent or disabled until the
maintainer explicitly authorizes publication and the published URL/hash has been verified.

## Validation

These names and arguments are the decision-complete planned validation contract. During
implementation, make them executable and CI-wire them before `Done`:

```powershell
npm run build:replay
npm run test:replay
npm run test:a11y
npm run proof:hashes
npm run pack:smoke
npm run eval:replay
npm run eval:adversarial
npm run sbom:check
npm run release:verify
npm run verify
```

`release:verify` owns bundle/provider inspection, manifest/hash reproduction, license/history checks,
and clean-clone rehearsal. Windows and Ubuntu CI must both pass before an artifact is presented for
separate publication authorization.

## Delivery evidence

No implementation evidence exists because this package has not started.

## Known limitations and blockers

WP-2026-004 is incomplete. Publication remains a separate human authorization even after a release
candidate passes; the case study must remain pre-results until cohort evidence is sealed. The
private information-page change cannot activate its demo link before that authorization and URL
verification.

## Next action

- Draft the truthful replay storyboard and evidence-map schema using only acceptance-backed claims.

## Checkpoints

Implementation has not begun; append dated checkpoints only after the package becomes In progress.
