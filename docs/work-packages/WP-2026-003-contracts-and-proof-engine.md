---
id: WP-2026-003
title: Contracts and deterministic proof engine
status: Draft
depends_on: WP-2026-002
owner: Maintainer
base_branch: main
accepted_plan: VSC-PLAN-2026-09-04.2
data_classification: Public
acceptance: VSC-ARCH-002, VSC-ARCH-003, VSC-PROOF-001, VSC-PROOF-002
updated: 2026-09-04
---

# Contracts and deterministic proof engine

## Goal

Implement immutable domain values, strict boundary schemas/codecs, unique generated fixtures, and
the six canonical proof techniques with independent verification and application.

## User value

Every future lesson can point to a reproducible proof rather than trusting persuasive model text,
and integrators receive small versioned interfaces instead of private game objects.

## Non-goals

No coaching cadence, model/provider behavior, lesson prose, private puzzle export, Angular/Firebase
integration, publication, or live evaluation belongs here.

## Governing ADRs

ADR-0001, ADR-0002, ADR-0004, and ADR-0005; contract versioning; proof-technique and contract
change runbooks.

## Allowed edit surface

`packages/domain`, `packages/contracts`, `packages/boundary-codecs`, `packages/proof-engine`, the
proof/fixture portions of `packages/testing`, generated public fixtures/schemas, and their docs,
tests, scripts, manifests, and aggregate conformance evidence.

## Affected interfaces

`PuzzleDefinitionV1`, `BoardStateV1`, `BoardActionV1`, `ProofStepV1`, `ProofPathV1`,
`BehaviorIdentityV1`, `TraceEnvelopeV1`, `ProofEngine`, branded IDs, topology/candidate values,
schema exports, boundary codecs, and fixture manifests.

## Architecture and privacy invariants

Domain has no dependencies; proof engine depends only on domain; contracts import no domain;
codecs reject unknown keys before constructing trusted values. Detectors propose and independent
verifiers authorize. Public fixtures are seed-generated and collision-checked only against private
aggregate hashes; no private puzzle or source crosses the boundary.

## Acceptance criteria

Support naked single, hidden single, locked pointing, locked claiming, naked pair, and hidden pair
with the documented tie-break order. Require unique Classic fixtures, no-op rejection, stale/tamper
tests, deterministic hashes, path replay, transformations, and no regression below the frozen
5,147/5,191 private aggregate baseline. Replay and trace schemas require all nine canonical
behavior-identity versions and reject a missing field or mixed event identity hash.

## Validation

These names and arguments are the decision-complete planned validation contract. During
implementation, make them executable and CI-wire them before `Done`:

```powershell
npm run test:contracts
npm run test:proof
npm run fixtures:check
npm run proof:hashes
npm run pack:smoke
npm run verify
```

During implementation, the private Sudoku World counterpart makes this planned credential-free
command executable and runs it from its repository root:

```powershell
node scripts/ops/verify-coach-proof-conformance.mjs
```

The root `npm run verify` may still report the explicit zero-case `eval:replay` bootstrap in this
package. Proof commands and conformance evidence—not that bootstrap—measure WP-2026-003 behavior.

Its publishable output is aggregate-only: corpus count, supported-technique solved count, invalid
application count, ruleset version, public artifact hash, and result hash. It must prove no
regression below 5,147/5,191 and zero invalid placements/eliminations without emitting puzzle rows.

## Delivery evidence

No implementation evidence exists because this package has not started.

## Known limitations and blockers

No dependency blocker remains because WP-2026-001 is accepted and `Done`. Human timing of the
generated showcase remains an experience measurement; generation labels it curated rather than
claiming difficulty or duration.

## Next action

- Finalize the field-level V1 contract tables and generated-fixture seed protocol for explicit readiness review; do not implement while status remains Draft.

## Checkpoints

Implementation has not begun; append dated checkpoints only after the package becomes In progress.
