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
updated: 2026-09-05
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
tests, scripts, manifests, and aggregate conformance evidence. The package-consumer slice may
seal the empty `packages/coach-core` manifest/compiler output as a transitive codec dependency;
coaching implementation remains outside this package.
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
npm run test:fixture-tools
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

The maintainer authorized the next step, and reviewed
[PR #6](https://github.com/memorex386/verified-sudoku-coach/pull/6) merged at
`ee8aec101bae522ad393d92f3705c71df00f653c`, preserving head
`3e747c96e3ff3ab44081ae1dbc26501f15422083` after Windows, Ubuntu, dependency review and CodeQL passed.
The [boundary codec checkpoint](../contracts/boundary-codecs.md) implements all eight top-level
V1 wire schemas, board/identity/action semantics, and explicitly unverified proof/trace/replay
framing. Generated schema/API/compatibility artifacts are checked by `npm run test:contracts`.

Contract-slice validation on Windows, 2026-09-04:

- `npm run test:contracts`: PASS — 19 tests, ten JSON Schema snapshots, API hashes, synthetic
  compatibility examples, ESM/CommonJS workspace roots and deep-import rejection.
- `npm run test:domain`: PASS — 14 tests, including trailing-newline token regressions.
- `npm run architecture:check`: PASS — inward imports and provider/core boundaries preserved.
- `npm run licenses:check`: PASS — Zod 4.5.4 MIT license and installed dependency tree reviewed.
- `npm audit --omit=dev --audit-level=low`: PASS — zero reported vulnerabilities.
- `npm run verify`: PASS with `WORK_PACKAGE_BASE_REF=origin/main` — all 145 tests and strict compilation.
- `npm run work-packages:generate`: PASS — registry regenerated with one active package/next action.
- `git diff --check`: PASS — no whitespace errors.

Package versions remain `0.0.0`. The wire reader requires exact safe decimal integer spelling;
snapshot/consumer notes distinguish JSON Schema structure from semantic and proof authority.

The maintainer authorized [PR #7](https://github.com/memorex386/verified-sudoku-coach/pull/7),
merged at `9089db2af7d97808a7fc4444484e09dda3b5a643`, preserving reviewed head
`e7bb4faac045462e1dba826a6bad894390353b73` after Windows, Ubuntu, dependency review and CodeQL passed.
The [packed consumer checkpoint](../contracts/package-conformance.md) adds reproducible tarballs,
offline clean installs, sealed root exports, strict Angular AOT and pinned-Chromium compatibility.
Its snapshot explicitly covers initial domain and wire-boundary behavior only.

Packed-consumer validation on Windows, 2026-09-04:

- `npm run pack:smoke`: PASS — two archive/lock adversarial tests; five repeatable tarballs;
  independent integrity checks; two clean offline consumers; root/deep-import checks; strict
  Angular 21.2.22 AOT/linking; real Chromium 151.0.7922.34 and Node 22 matched the checked snapshot.
- `npm run verify`: PASS with `WORK_PACKAGE_BASE_REF=origin/main` — all 147 tests, strict
  compilation, existing API/schema artifacts and all foundation gates, including `pack:smoke`.
- `npm audit --audit-level=low`: PASS — zero reported runtime/development vulnerabilities.
- `npm run licenses:check`: PASS — reviewed tooling and version-scoped caniuse-lite attribution.
- `npm run work-packages:generate`: PASS — one active package and exactly one review next action.
- `git diff --check`: PASS — no whitespace errors.

The maintainer authorized [PR #8](https://github.com/memorex386/verified-sudoku-coach/pull/8),
merged at `80340d2e48ff68b9b8cbcf2a85ff2f7a6b54c628`, preserving reviewed head
`b159d0945a87990e33060f4196072077b88772d2` after Windows, Ubuntu, dependency review and CodeQL passed.
The [fixture tooling checkpoint](../architecture/fixture-tools.md) implements deterministic seeds,
complete grids, D4 transforms, an independent exact counting solver and symmetric clue removal.
Candidates remain explicitly unfiltered; no showcase artifacts or proof capabilities are produced.

Fixture-tooling validation on Windows, 2026-09-04:

- `npm ci --ignore-scripts`: PASS — unchanged dependencies, zero reported vulnerabilities.
- `npm run test:fixture-tools`: PASS — nine tests, including the independent exact-cover oracle,
  seed-zero removal replay, seven selected attempts and eight D4 transforms.
- `npm run architecture:check`: PASS — inward dependencies and core boundaries preserved.
- `npm run verify`: PASS with `WORK_PACKAGE_BASE_REF=origin/main` — all 156 tests, strict
  compilation, existing API/schema artifacts and matching packed Node/Chromium conformance.
- `npm run work-packages:generate`: PASS — one active package and exactly one review next action.
- `git diff --check`: PASS — no whitespace errors.

PR #10 subsequently merged at `1b0d0426de4ce48df822143d810e0025bb37adb2`, preserving head
`e1a1b7841a17db02f81e833b43da0365a17580d1`. The fixture-transform work is in open
[PR #11](https://github.com/memorex386/verified-sudoku-coach/pull/11), reviewed head
`9fc2a28ca6c8c5d5e932d6048f7ac4a2340405b6`; its merge remains unauthorized.
The [fixture artifact boundary checkpoint](../contracts/fixture-artifacts.md) proceeds independently
from main after PR #10: exact schemas, canonical-file decoders and compatibility evidence for
receipts/manifests/registry, all explicitly unverified. No showcase artifact is produced.

Fixture-artifact boundary validation on Windows, 2026-09-05:

- `npm ci --ignore-scripts`: PASS — unchanged dependencies, zero reported vulnerabilities.
- `npm run test:contracts`: PASS — 28 tests, thirteen JSON Schema snapshots, checked API/export
  snapshots and original board/fixture compatibility examples.
- `npm run pack:smoke`: PASS — repeatable tarballs and all three artifact decoders exercised in
  clean Node and strict Angular AOT/pinned Chromium consumers, retaining unverified results.
- `npm run verify`: PASS with `WORK_PACKAGE_BASE_REF=origin/main` — all 165 tests, strict
  compilation and every foundation/package gate. This independent branch excludes PR #11's tests.
- `npm run work-packages:generate`: PASS — one active package and exactly one review next action.
- `git diff --check`: PASS — no whitespace errors.

## Known limitations and blockers

WP-2026-001 and WP-2026-002 are accepted and `Done`. Human timing of the generated showcase remains
an experience measurement; generation labels it curated rather than claiming difficulty or
duration. The private aggregate conformance command does not yet exist in Sudoku World; domain,
schema, and codec work may proceed, but the proof-technique runbook blocks detector/verifier changes
until the private counterpart and its linked evidence package are executable.
The domain slice is only an initial-state API. Technique application and replay retention of
verified eliminations remain unimplemented, as do generated showcase fixtures, executable replay
acceptance and private conformance. Chromium/Angular and packed-consumer checks cover only
the implemented domain and wire-boundary surfaces.
Proof/trace/replay codecs check framing and integrity only and return explicit `unverified` data.
`test:domain`, `test:contracts`, `test:fixture-tools` and `pack:smoke` are executable; `test:proof`, `fixtures:check`
and `proof:hashes` remain required before Done. Packed empty proof-engine/coach-core exports do
not count as implementation of those services.

## Next action

- Review the fixture-artifact boundary implementation PR and obtain explicit merge authorization; retain the separate open PR #11 and private conformance gate.

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
- 2026-09-04 — PR #6 CI exposed Git-base leakage in the synthetic Ready-state test on both OSes.
  Isolated only that unit fixture from the real base and restored its environment after the test;
  production history checks remain intact. `npm run verify` with `WORK_PACKAGE_BASE_REF=origin/main`
  then passed all 112 foundation and 14 domain tests locally. PR #6 remains open, not authorized
  for merge.
- 2026-09-04 — Maintainer authorized PR #6 integration and the next implementation slice; merged
  its checked head and created a fresh worktree from updated main. Implemented exact V1 schemas,
  bounded JSON preflight, immutable board/identity/action codec results and explicitly unverified
  proof/trace/replay framing. Added schema/API snapshots and synthetic compatibility cases,
  Zod license/integrity review, and strict trailing-newline token regressions. No technique
  detector/verifier, provider call, private corpus operation, live automation or deployment occurred.
- 2026-09-04 — Contract-slice full verification passed all 145 tests with the CI base-ref setting,
  including artifact drift, workspace entrypoint and malformed-wire checks. The implementation is
  ready for review; this checkpoint does not claim packed/browser conformance, proof soundness,
  uniqueness, executable replay acceptance or private corpus parity.
- 2026-09-04 — Maintainer authorized PR #7 integration and the next WP-2026-003 slice. Merged
  its checked head, created a fresh worktree from updated main, and implemented packed Node/Angular
  consumers with pinned Chromium, archive inspection and portable artifact evidence. Sealed the
  empty proof-engine/coach-core build exports without adding service behavior. The private
  conformance gate remains blocking for technique implementation; no private material was accessed.
- 2026-09-04 — Packed-consumer verification and the full CI-base-ref verifier passed locally:
  147 tests plus matching Node/Chromium results and reproducible archive evidence. The new gate
  is CI-wired; this implementation stops at its review PR and does not authorize merge or release.
- 2026-09-04 — Maintainer authorized PR #8 integration and the next unblocked WP-2026-003 slice.
  Merged the checked head and created a fresh worktree from updated main. Implemented fixture
  seed/grid/orbit tools, independent capped solution counting and symmetric clue removal, with
  an independent exact-cover test oracle. No technique code, showcase selection, private data,
  provider call, live automation, release or deployment was added.
- 2026-09-04 — Full local CI-base-ref verification passed all 156 tests and existing package
  conformance. The fixture-tooling slice is ready for its review PR; it does not establish
  showcase selection, proof soundness, private collision clearance or private corpus parity.
- 2026-09-05 — Continued the next independent WP-2026-003 slice from main after PR #10, leaving
  PR #11 open without merge authorization. Implemented exact receipt/manifest/registry schemas,
  bounded canonical-file decoders returning unverified claims, compatibility snapshots and
  adversarial tests. No private data, technique verifier, solver acceptance or live-product change
  was introduced. Integrating both open slices must preserve their checkpoints and rerun combined
  snapshot/verification checks.
- 2026-09-05 — Full local CI-base-ref verification passed all 165 tests on this independent
  artifact-contract branch, plus matching Node/Chromium and regenerated API/schema compatibility
  evidence. It stops at its review PR; no uniqueness/proof acceptance or private clearance is claimed.
