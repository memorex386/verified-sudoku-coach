# Public contract catalog

This catalog fixes ownership and semantic boundaries before WP-2026-002 defines exact fields and
Zod schemas. A name ending in `V1` is a serialized contract family; internal branded/immutable values
remain separate and cross the boundary only through codecs.

## Canonical behavior identity

`BehaviorIdentityV1` is an exact object containing `rulesetVersion`, `schemaVersion`,
`promptVersion`, `modelProfileVersion`, `rendererVersion`, `fixtureVersion`, and
`evaluationSuiteVersion`. Every `ReplayArtifactV1` and every `TraceEnvelopeV1` embeds all seven
fields; none is optional or inferred from the current deployment. A trace freezes the identity at
session start, and each event carries the envelope's identity hash so a partial/mixed export fails
validation. Versions identify behavior definitions, not merely a source commit.

## Sudoku and proof DTOs

| Contract | Meaning | Authority |
| --- | --- | --- |
| `PuzzleDefinitionV1` | Topology plus givens and provenance identity; never a trusted solution | Contracts decode; proof engine verifies uniqueness |
| `BoardStateV1` | Puzzle identity, monotonic revision, entered values, and notes | Host supplies; codecs validate; notes never define candidates |
| `BoardActionV1` | Stable command ID and one bounded player action against an expected revision | Host/player only |
| `ProofStepV1` | One explicit placement or elimination proof with technique, premises, conclusions, ruleset, and before/after fingerprints | Proof verifier only |
| `ProofPathV1` | Ordered verified steps plus solved/stalled/contradiction outcome | Proof engine only |
| `CoachObservationV1` | Minimal coarse session signals and registered opportunity references | Coach core projection |

## Model and lesson DTOs

| Contract | Meaning | Authority |
| --- | --- | --- |
| `ObserverDecisionV1` | Silence or selection of one supplied opportunity by opaque ID | Untrusted until schema/reference/revision validation |
| `TeacherPlanV1` | Ordered references to supplied proof facts, templates, stages, and allowed branches | Untrusted until semantic validation |
| `LessonViewV1` | Deterministically rendered factual content and bounded player choices | Coach core after re-verification |
| `CoachErrorV1` | Allowlisted machine code, retryability, and recovery choices | Application boundary; no arbitrary/provider message |
| `CoachTurnResultV1` | Exact union of `silent`, `lesson`, `paused`, or `stale` | Coach application |
| `ReplayArtifactV1` | Generated puzzle, synthetic action/result sequence, and required `BehaviorIdentityV1` | Replay loader after strict decoding |
| `TraceEnvelopeV1` | Bounded session trace with immutable `BehaviorIdentityV1`; events bind its identity hash | Host/trace sink after strict decoding |

Model output never carries trusted board values or prose facts. It carries references; the core
resolves those references against the current registered facts and renders facts from controlled
templates.

## Domain/application interfaces

- `ProofEngine`: derive candidates/opportunities, independently verify a proposed proof, apply only a
  verified proof, and produce a canonical proof path.
- `ObserverModelPort` and `TeacherModelPort`: accept minimal packets and return untrusted typed
  provider outcomes; implementations cannot mutate application state.
- `CoachSessionRepository`: load and compare-and-swap an expected revision outside model calls.
- `BudgetLedger`: atomically reserve and reconcile an identified call without exposing provider
  content.
- `TraceSink`: create one behavior-identified bounded trace and append events that match its immutable
  identity hash and explicit data classification.
- `OperationalTelemetry`: record allowlisted counts, durations, versions, acceptance, and cost only.
- `Clock` and `IdFactory`: supply time and stable IDs to the imperative shell, never the core.
- `PuzzleCatalog`: resolve approved puzzle/version metadata without granting proof authority.

## Command processing contract

`decide(state, command)` returns events and effects without I/O. `evolve(state, event)` returns the
next immutable state. The shell persists an accepted transition with compare-and-swap, executes at
most one billable model effect at a time, then submits the result as a new command. Stable
`commandId` and `callId` values make retries idempotent. An older revision returns `stale`; failures
return `paused`; neither can display a lesson.

Exact keys, bounds, schema literals, JSON Schema snapshots, compatibility fixtures, and package
exports land in WP-2026-002 under the [versioning policy](versioning.md).
