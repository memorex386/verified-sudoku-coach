---
id: WP-2026-008
title: Owner alpha and reviewer pilot
status: Draft
depends_on: WP-2026-007
owner: Maintainer
base_branch: main
accepted_plan: VSC-PLAN-2026-09-03.1
data_classification: Public metadata only
acceptance: VSC-EVAL-002, VSC-OPS-003, VSC-PILOT-001
updated: 2026-09-03
---

# Owner alpha and reviewer pilot

## Goal

Verify disabled-first production controls, run a separately labeled owner alpha, freeze an approved
cohort manifest, and issue 8–12 one-use reviewer invitations only after the release gate passes.

## User value

The portfolio receives honest small-cohort evidence from a deliberately bounded experience without
exposing participants or converting an experiment into a commercial claim.

## Non-goals

No owner-alpha data in reviewer results, open signup, causal learning claim, Academy pricing test,
automatic invite issuance, unreviewed transition prose, public trace, or permission implied across
spend/deploy/exposure/publication boundaries.

## Governing ADRs

ADR-0006; the preregistered private experiment and accepted business decision; model/eval/privacy
policies; incident, retention/deletion, and pilot-operation runbooks; reviewer release gate.

## Allowed edit surface

Private environment configuration, deployment evidence, owner-alpha/reviewer operations, aggregate
projection and reviewed public-safe evidence records. No raw participant or provider content enters
the public repository.

## Affected interfaces

Kill switch, budget/alert dashboards, model registry approval, cohort manifest, invite admin,
consent, trace review, completion/survey aggregation, withdrawal/deletion verification, and release
gate checklist.

## Architecture and privacy invariants

Backend deploys disabled. Prompt/schema/model/renderer/fixture/eval versions freeze before reviewer
access. Every invite is single-use; access is checked every call. Owner-alpha records use a separate
partition and denominator. Raw reviewer material remains private, access-limited, withdrawable, and
30-day bounded.

## Acceptance criteria

Before invitations: zero displayed factual errors, full schema-plus-semantic validator acceptance at
least 98% overall, every technique subgroup and every player self-rating subgroup at or above 95%,
observer p95 at most four seconds, and verified budget, monitoring, kill switch, access, retention,
and deletion. At the unchanged preregistered stop rule, close the cohort, account for every outcome,
and report VSC-PILOT-001's fixed success threshold as pass or fail. A failed result does not block
truthful evidence sealing in WP-2026-009.

## Validation

From the public repository root, run the exact frozen release checks:

```powershell
npm ci
npm run eval:replay
npm run release:verify
npm run verify
```

During implementation, make these planned private-root read-only or emulator-backed operational
gates executable and run them before `Done`:

```powershell
node scripts/ops/verify-coach-release-gate.mjs --mode owner-alpha
node scripts/ops/verify-coach-release-gate.mjs --mode reviewer
node scripts/ops/verify-coach-retention.mjs --mode rehearsal
node --test scripts/ops/lib/*.test.mjs scripts/ops/*.test.mjs
node scripts/ops/verify-business-docs.mjs
node scripts/ops/verify-engineering-docs.mjs
git diff --check
```

From private `firebase/functions`, run `npm run test:emulator`. The gates cover disabled deploy
smoke, budget/alert/kill-switch drills, access/invite/native-denial tests, the frozen manifest,
owner-alpha exclusion, consent/withdrawal, and deletion rehearsal. Deployment, model spend, invite
issuance, and cohort sealing remain separately authorized operations, never side effects of these
commands.

## Delivery evidence

No operational or participant evidence exists because this package has not started. Goals remain
labeled as goals until reviewed aggregates are available.

## Known limitations and blockers

WP-2026-007, business measurement/configuration gates, credentials, and four distinct human
authorizations—spend, deploy, invite exposure, and aggregate publication—remain outstanding.

## Next action

- Review the preregistered survey, cohort-freeze, and release-gate checklist for exact agreement before any operational setup.

## Checkpoints

Implementation has not begun; append dated public-safe checkpoints only after the package becomes In progress.
