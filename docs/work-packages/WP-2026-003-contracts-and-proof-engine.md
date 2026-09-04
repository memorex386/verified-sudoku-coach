---
id: WP-2026-003
title: Contracts and deterministic proof engine
status: In progress
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

[ADR-0001](../decisions/0001-deterministic-proofs-own-facts.md),
[ADR-0002](../decisions/0002-enforce-inward-package-dependencies.md),
[ADR-0004](../decisions/0004-minimize-data-and-fail-closed.md), and
[ADR-0005](../decisions/0005-separate-public-core-private-adapters.md);
[contract versioning](../contracts/versioning.md),
[proof policy](../architecture/proof-policy.md),
[proof-technique](../runbooks/change-proof-technique.md) and
[contract change](../runbooks/change-contract.md) runbooks.

## Allowed edit surface

`packages/domain`, `packages/contracts`, `packages/boundary-codecs`, `packages/proof-engine`, the
proof/fixture portions of `packages/testing`, generated public fixtures/schemas, and their docs,
tests, scripts, manifests, and aggregate conformance evidence.
The transition PR contains documentation only; schemas, compatibility fixtures, API artifacts,
and codecs required by the change matrix land with their implementing slices before package Done.

## Affected interfaces

`PuzzleDefinitionV1`, `BoardStateV1`, `BoardActionV1`, `ProofStepV1`, `ProofPathV1`,
`BehaviorIdentityV1`, `TraceEnvelopeV1`, `ReplayArtifactV1`, `ProofEngine`, branded IDs,
topology/candidate/logical-state values, schema exports, boundary codecs, and fixture manifests.

## Architecture and privacy invariants

Domain has no dependencies; proof engine depends only on domain; contracts import no domain;
codecs reject unknown keys before constructing trusted values. Detectors propose and independent
verifiers authorize. Public fixtures are seed-generated and collision-checked only against private
aggregate hashes; no private puzzle or source crosses the boundary.

## Acceptance criteria

Support naked single, hidden single, locked pointing, locked claiming, naked pair, and hidden pair
with the documented tie-break order. The exact fields, bounds, candidate-bearing logical state,
hash projections, trace/replay variants, and package surface are fixed in
[Sudoku and proof contracts V1](../contracts/sudoku-proof-v1.md). Require unique Classic fixtures,
no-op rejection, stale/tamper tests, deterministic hashes, path replay, transformations, and no
regression below the frozen 5,147/5,191 private aggregate baseline. The
[fixture protocol](../architecture/fixture-generation.md) fixes seed parsing, PRNG vectors,
generation/removal order, uniqueness authority, lowest-attempt selection, canonical artifacts,
collision transforms, and honest claim limits.

## Validation

These names and arguments are the decision-complete planned validation contract. During
implementation, make them executable and CI-wire them before `Done`:

```powershell
npm run test:contracts
npm run test:proof
npm run fixtures:check
npm run proof:hashes
npm run pack:smoke
npm run test:domain
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

The transition review locks the V1 contract and fixture-generation decisions before code starts. No
runtime package, fixture, public artifact, release, provider call, or private corpus output is yet
claimed by this checkpoint.

Transition validation on 2026-09-04: `npm run work-packages:generate` passed;
`npm run verify` passed all 112 foundation/adversarial tests and strict compilation;
`git diff --check` passed. GitHub confirmed PR #4's reviewed head and merge; the registry's
remote Done checks passed. The seed-zero SHA-256 and ten PRNG outputs were independently
reproduced. These checks validate readiness and foundation behavior, not implemented proof quality.
The Ready-command regression now selects the active package instead of assuming a fixed array
position; the production verifier's dependency and lifecycle rules are unchanged.

The transition was accepted in merged
[PR #5](https://github.com/memorex386/verified-sudoku-coach/pull/5), merge commit
`8708fa24ae528c3ddeab24c4dd1302724f9af774`. The first implementation slice is documented in
[domain primitives](../contracts/domain-primitives.md), with a checked declaration snapshot.
It implements topology, consistent puzzles, player snapshots, initial logical-state projections,
and canonical SHA-256. It does not construct or apply a verified proof.

Domain-slice validation on Windows, 2026-09-04:

- `npm ci --ignore-scripts`: PASS — no new dependencies, zero reported vulnerabilities.
- `npm run test:domain`: PASS — 14 synthetic domain tests and declaration snapshot check.
- `npm run architecture:check`: PASS — domain remains dependency-free and pure.
- `npm run typecheck`: PASS — strict project references compile.
- `npm run verify`: PASS — 112 foundation tests plus 14 domain tests and every existing gate.
- `npm run work-packages:generate`: PASS — one active package and one review next action.
- `git diff --check`: PASS — no whitespace errors.

The doctor now locks the expanded test command and `test:domain` command exactly, preserving
all existing gates and disallowing lifecycle hooks around the new command. Public SHA-256 vectors
and independently calculated empty-6x6 puzzle/logical hashes provide fixed compatibility evidence.

## Known limitations and blockers

WP-2026-001 and WP-2026-002 are accepted and `Done`. Human timing of the generated showcase remains
an experience measurement; generation labels it curated rather than claiming difficulty or
duration. The private aggregate conformance command does not yet exist in Sudoku World; domain,
schema, and codec work may proceed, but the proof-technique runbook blocks detector/verifier changes
until the private counterpart and its linked evidence package are executable.
The domain slice is only an initial-state API. Technique application and replay retention of
verified eliminations remain unimplemented, as do DTO schemas/codecs, generated fixtures,
Chromium/Angular checks and packed distribution. Only `test:domain` among the new package commands
is executable in this slice; the other commands remain required before package Done.

## Next action

- Review the domain-primitives implementation PR; preserve the private conformance gate and obtain explicit merge authorization before integrating this slice.

## Checkpoints

- 2026-09-04 — After WP-2026-002 merged, the maintainer authorized WP-2026-003 to start. Exact V1
  fields/bounds, candidate-bearing logical state, portable hash projections, bounded trace/replay
  forms, package exports, deterministic fixture generation, and claim limitations are recorded for
  acceptance through the authorized transition PR;
  the first implementation slice is dependency-free domain/hash behavior.
- 2026-09-04 — After transition PR #5 merged, implemented the dependency-free domain slice in a
  fresh worktree from updated main: strict copied/frozen values, initial candidates independent of
  notes, exact hash projections, pure SHA-256, declaration drift checking and synthetic adversarial
  tests wired into the root verifier. No detector, verifier, proof-application rule, private data,
  provider call, release, or deployment was added.
- 2026-09-04 — Full local verification passed 112 foundation and 14 domain tests, strict compilation,
  API snapshot and architecture checks. The domain implementation is ready for PR review; merge
  requires new explicit maintainer authorization and remaining WP-2026-003 gates stay unfinished.
