---
id: WP-2026-004
title: Provider-neutral coach application
status: Draft
depends_on: WP-2026-003
owner: Maintainer
base_branch: main
accepted_plan: VSC-PLAN-2026-09-04.2
data_classification: Public
acceptance: VSC-AI-001, VSC-AI-002, VSC-UX-001
updated: 2026-09-04
---

# Provider-neutral coach application

## Goal

Implement pure session reduction, learner bands, cadence/coalescing, intervention policy,
observer/teacher ports, trusted-reference validation, deterministic lessons, and typed outcomes.

## User value

The coach can adapt timing and teaching depth without receiving authority to invent facts or alter
the board, and provider failure cannot strand normal play.

## Non-goals

No OpenAI SDK, network, wall clock, storage, IDs, production telemetry, private identity, React,
Angular, Firebase, live spend, or owner-alpha prose belongs in the functional core.

## Governing ADRs

ADR-0001 through ADR-0005 plus architecture principles, trust boundaries, contract versioning, and
the accepted cadence/failure portions of the product charter.

## Allowed edit surface

`packages/coach-core`, coaching DTOs/codecs, coaching fakes/builders in `packages/testing`, public
prompts' interface documentation without provider prompts, and directly affected tests/docs.

## Affected interfaces

Design input: [coach interaction concept](../product/concepts/coach-interaction.md), including
progressive guidance and synchronized verified-reference storytelling. It does not change this
package's Draft status, pure-core boundary, or acceptance contract.

`CoachObservationV1`, `ObserverDecisionV1`, `TeacherPlanV1`, `LessonViewV1`,
`CoachTurnResultV1`, `CoachErrorV1`, model/repository/budget/trace/telemetry/clock/ID/catalog ports,
`BehaviorIdentityV1`, `TraceEnvelopeV1`, commands, events, effects, `decide`, and `evolve`.

## Architecture and privacy invariants

All state transitions are pure. Time, IDs, budget, persistence, and models enter as effects/ports.
Only registered proof/fact/template references survive semantic validation; factual rendering is
deterministic. Outcomes are exactly `silent`, `lesson`, `paused`, or `stale`; arbitrary provider
content never appears. `silent` is valid only for an accepted observer no-intervention decision;
invalid/provider/limit failures visibly pause and an obsolete revision is stale.

## Acceptance criteria

Latest-wins permits at most one call in flight, a five-second background minimum, and immediate
explicit help. Retry IDs are stable, stale responses are discarded, trace limit and every failure
are visible, and deterministic replay targets 8–15 displayed interventions without placing moves.
Trace creation freezes the seven-field behavior identity, and mixed/missing event identities are
rejected before persistence or replay.

## Validation

These names and arguments are the decision-complete planned validation contract. During
implementation, make them executable and CI-wire them before `Done`:

```powershell
npm run test:coach
npm run eval:replay
npm run verify
```

`eval:replay` may still return the explicit zero-case bootstrap here; its inclusion preserves the
CLI/CI contract, while `test:coach` supplies this package's behavioral evidence. WP-2026-005 owns
the credential-free evaluation implementation.

`test:coach` must cover reducer/effect determinism, fake-clock cadence, idempotency/stale results,
semantic references, renderer goldens, the typed failure matrix, data minimization, adversarial
responses, and property tests.

## Delivery evidence

No implementation evidence exists because this package has not started.

## Known limitations and blockers

WP-2026-003 is incomplete. This package defines provider-neutral behavior only; model quality and player
value remain unmeasured.

## Next action

- Specify the complete command/event/effect table and intervention state machine without writing implementation code.

## Checkpoints

Implementation has not begun; append dated checkpoints only after the package becomes In progress.
