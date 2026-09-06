---
id: WP-2026-003
title: Contracts and deterministic proof engine
status: In progress
depends_on: WP-2026-002
owner: Maintainer
base_branch: main
accepted_plan: VSC-PLAN-2026-09-05.3
data_classification: Public
acceptance: VSC-ARCH-002, VSC-ARCH-003, VSC-PROOF-001, VSC-PROOF-002
updated: 2026-09-05
---

# Contracts and deterministic proof engine

## Goal

Deliver the accepted [local tutor milestone](../product/plans/VSC-PLAN-2026-09-05.3.md) first:
one playable generated puzzle, independently verified naked/hidden singles and explicit progressive
hints. The original full-package goal remains deferred: immutable domain values, strict codecs,
showcase fixtures and all six canonical techniques with verified application.

## User value

Every future lesson can point to a reproducible proof rather than trusting persuasive model text,
and integrators receive small versioned interfaces instead of private game objects.

## Non-goals

The local amendment permits minimal deterministic lessons and local presentation. It adds no
background cadence, model/provider behavior, private puzzle export, Angular/Firebase
integration, publication, or live evaluation.

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
the local amendment additionally permits minimal deterministic lesson code in `packages/coach-core`
and the local tutor UI in `apps/replay-web`. Broader coaching policy remains deferred.
The transition PR contains documentation only; schemas, compatibility fixtures, API artifacts,
and codecs required by the change matrix land with their implementing slices before package Done.

## Affected interfaces

`PuzzleDefinitionV1`, `BoardStateV1`, `BoardActionV1`, `ProofStepV1`, `ProofPathV1`,
`BehaviorIdentityV1`, `TraceEnvelopeV1`, `ReplayArtifactV1`, `ProofEngine`, branded IDs,
topology/candidate/logical-state values, schema exports, boundary codecs, and fixture manifests.

## Architecture and privacy invariants

Domain has no dependencies; proof engine depends only on domain; contracts import no domain;
codecs reject unknown keys before constructing trusted values. Detectors propose and independent
verifiers authorize. Public fixtures are seed-generated; accepted showcase fixtures additionally
require private aggregate collision clearance. The local puzzle makes no collision-clearance claim.
No private puzzle or source crosses the boundary.

## Acceptance criteria

The local milestone uses the acceptance and commands in the linked amendment; completing it does
not complete the full gates below or authorize private integration.

For full-package acceptance, support naked single, hidden single, locked pointing, locked claiming, naked pair, and hidden pair
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

The maintainer resumed the authorized merge after pausing for a progress review.
[PR #10](https://github.com/memorex386/verified-sudoku-coach/pull/10) merged at
`1b0d0426de4ce48df822143d810e0025bb37adb2`, preserving reviewed head
`e1a1b7841a17db02f81e833b43da0365a17580d1` after Windows, Ubuntu, dependency review and CodeQL passed.
The fixture transform checkpoint implements all fourteen 9x9 grid transforms and the public
exact/digit-D4 key protocol. It corrects rejection of the pre-specified `fixture-digit-d4` hash
projection without changing existing hashes. No private comparison or proof transformation is claimed.

Fixture-transform validation on Windows, 2026-09-05:

- `npm ci --ignore-scripts`: PASS — unchanged dependencies, zero reported vulnerabilities.
- `npm run test:fixture-tools`: PASS — sixteen tests, including exact transform order, 28
  transformed grids checked with exact cover, 32 digit/D4 cases and independent hash vectors.
- `npm run test:domain`: PASS — fourteen tests and unchanged declaration snapshot; numeric-name
  and trailing-whitespace regressions cover the narrow hash-name correction.
- `npm run pack:smoke`: PASS — updated domain archive integrity and a new matching Node/Chromium
  collision-projection result; existing board/logical/codec fingerprints remain unchanged.
- `npm run verify`: PASS with `WORK_PACKAGE_BASE_REF=origin/main` — all 163 tests, strict
  compilation, API/schema snapshots and every foundation/package gate.
- `npm run work-packages:generate`: PASS — one active package and exactly one review next action.
- `git diff --check`: PASS — no whitespace errors.

Historical artifact-branch evidence: PR #10 subsequently merged at `1b0d0426de4ce48df822143d810e0025bb37adb2`, preserving head
`e1a1b7841a17db02f81e833b43da0365a17580d1`. At that checkpoint, the fixture-transform work was in open
[PR #11](https://github.com/memorex386/verified-sudoku-coach/pull/11), reviewed head
`9fc2a28ca6c8c5d5e932d6048f7ac4a2340405b6`; its merge was not yet authorized.
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
duration. The private aggregate command remains unavailable. The accepted local amendment permits
only isolated naked/hidden-single implementation with generated tests before that gate; private
integration and full six-technique/showcase acceptance remain blocked on its command and evidence.
The domain now includes initial state and immutable player-action application. Technique application and replay retention of
verified eliminations remain unimplemented, as do generated showcase fixtures, executable replay
acceptance and private conformance. Chromium/Angular and packed-consumer checks cover only
the implemented domain and wire-boundary surfaces.
Proof/trace codecs check framing and integrity; replay also executes player actions and checks
recorded boards and rejection reasons. All proof/trace/replay results remain explicitly `unverified`.
`test:domain`, `test:contracts`, `test:fixture-tools`, local-only `test:proof` and `pack:smoke` are
executable. Full six-technique proof coverage, `fixtures:check` and `proof:hashes` remain required
before Done. The proof engine implements local single hints; coach-core renders minimal verified lessons and
`apps/replay-web` provides the [local playable tutor](../runbooks/local-tutor.md). No live AI is connected.

## Next action

- Maintainer: try the local tutor and review the interaction before adding one model.

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
- 2026-09-05 — Maintainer resumed WP-2026-003. Merged PR #10's checked head and created a fresh
  worktree from updated main. Implemented fourteen ordered fixture grid transforms, digit/D4
  normalization and public collision-key calculations. Corrected the domain hash-name guard for
  the already-specified `fixture-digit-d4` projection, retaining rejection of other numeric names
  and trailing whitespace. No private material, technique code or live-product behavior changed.
- 2026-09-05 — Full local CI-base-ref verification passed all 163 tests, unchanged API/schema
  declarations and updated packed Node/Chromium evidence. The fixture-transform implementation
  stops at its review PR; private collision clearance and proof-technique gates remain unfinished.
- 2026-09-05 — Continued the next independent WP-2026-003 slice from main after PR #10, leaving
  PR #11 open without merge authorization. Implemented exact receipt/manifest/registry schemas,
  bounded canonical-file decoders returning unverified claims, compatibility snapshots and
  adversarial tests. No private data, technique verifier, solver acceptance or live-product change
  was introduced. Integrating both open slices must preserve their checkpoints and rerun combined
  snapshot/verification checks.
- 2026-09-05 — Full local CI-base-ref verification passed all 165 tests on this independent
  artifact-contract branch, plus matching Node/Chromium and regenerated API/schema compatibility
  evidence. It stops at its review PR; no uniqueness/proof acceptance or private clearance is claimed.
- 2026-09-05 — Maintainer authorized PRs #11, #12 and #13. PR #11 merged at
  `efb37dceeed46044269927d523c7d71aeb9a343d`. Reconciled both consumer probes and appended
  both implementation histories; combined package evidence is regenerated before PR #12 merges.
- 2026-09-05 — Combined PR #11/#12 validation passed: all 172 tests, strict compilation, regenerated packed Node/Angular/Chromium snapshot, registry and whitespace checks. Await fresh CI on this reconciled head before the authorized merge.
- 2026-09-05 — At the maintainer's explicit request, paused implementation to preserve the
  [coach interaction concept](../product/concepts/coach-interaction.md) and portable offline
  walkthrough for future agents. This documentation-only handoff is outside the package's proof
  implementation scope; it does not add coaching to core or start later Draft packages. PR #10
  is merged; independent implementation PRs #11 and #12 remain open and are not included here.
  Preserve their checkpoints when reconciling those branches with this documentation change.
- 2026-09-05 — Design-reference validation: `npm ci --ignore-scripts`,
  `npm run work-packages:generate`, `npm run verify` with `WORK_PACKAGE_BASE_REF=origin/main`,
  and `git diff --check` passed. All 156 existing tests and packed Node/Angular/Chromium
  conformance passed on the main-after-PR-10 base. Separate local Chromium checks passed for
  offline concept loading, synchronized clues, eight slashes, pause, answer/retry, conflict
  recovery, 320/360/736px light/dark layouts, and reduced-motion completion. These are prototype
  checks, not accessibility certification, proof acceptance, or measured coaching outcomes.
- 2026-09-05 — Reconciled the design handoff with authorized implementation PRs #11/#12,
  retaining all prior checkpoints and the combined package snapshot. The next core slice applies
  player board actions; it does not authorize techniques before private conformance is available.
- 2026-09-05 — Reconciled design-reference validation passed all 172 tests and packed Node/Angular/Chromium checks with the PR #12 integration head as base. Registry and whitespace checks passed; no runtime code was added by the design reference.
- 2026-09-05 — Maintainer authorized PRs #11, #12 and #13 after the design review. All merged
  after CI passed: #11 at `efb37dceeed46044269927d523c7d71aeb9a343d`, #12 at
  `72816f8889d60a03c7f6fec9ed6bea2aee71e5f1`, and #13 at
  `9e26438d1e466fc669f931b3ef7f82e610799803`. Reconciled snapshots and append-only histories;
  combined validation passed 172 tests. Began the next slice in a fresh dedicated worktree from
  updated main, incorporating the merged design reference before final validation.
- 2026-09-05 — Implemented [immutable player actions](../contracts/player-actions.md): place,
  replace, clear, and note mutation with typed stale/invalid results, exact revision increments,
  copied/frozen outputs, and no-op/given protection. The action takes no logical candidate masks
  and creates no verified placement. Added six domain tests and packed-consumer action vectors;
  codecs, wire schemas, techniques, provider behavior and live product remain unchanged.
- 2026-09-05 — Player-action validation passed: `npm ci --ignore-scripts` (unchanged dependencies,
  zero reported vulnerabilities), `npm run test:domain` (20 tests), `npm run architecture:check`,
  `npm run lint`, `npm run typecheck`, `npm run work-packages:generate`, and `git diff --check`.
  Regenerated the domain declaration and packed-consumer snapshots. Final `npm run verify` with
  `WORK_PACKAGE_BASE_REF=origin/main` passed all 178 tests and matching packed Node/Angular/Chromium
  action fingerprints. This slice stops at its implementation PR; no technique, uniqueness,
  complete replay, private compatibility, provider or live-product acceptance is claimed.
- 2026-09-05 — Maintainer authorized PR #14 integration and the next unblocked slice. All CI
  checks passed on `26b2ea97a4163c8141922359d9382374d82e5c75`; PR #14 merged at
  `0a7ed72ab66502afffe33fc8c6679c49c9dec253`. Continued in a fresh dedicated worktree from
  updated main. Implemented [replay-action checks](../contracts/replay-actions.md), executing
  player transitions and comparing recorded boards and rejection reasons. Four adversarial tests
  cover rehashed false transitions, mixed actions, rejection precedence and the 500-record bound;
  packed consumers check an altered action. Proof paths remain explicitly unverified, and the
  private aggregate command and linked evidence still block technique work.
- 2026-09-05 — Replay-action validation passed: `npm run test:contracts` (32 tests), strict
  compilation, regenerated API and packed-consumer snapshots, docs, lint and registry checks.
  Final `npm run verify` with `WORK_PACKAGE_BASE_REF=origin/main` passed all 182 tests (112
  foundation, 20 domain, 32 contracts, 16 fixture-tooling and two package-inspection tests), plus
  matching packed Node/Angular/Chromium results. `git diff --check` passed. This slice stops at
  its implementation PR; complete proof replay and private compatibility remain unfinished.
- 2026-09-05 — Maintainer approved a minimal local tutor before the larger release roadmap.
  Accepted plan .3 records one generated unique puzzle, two verified techniques, on-demand hints
  and deterministic presentation first; one model follows after trying the tutor. The narrow
  local-only private-gate exception is explicit; no private compatibility or full proof acceptance
  is claimed. Further standalone infrastructure slices are deferred. This planning branch starts
  from main after PR #15; independent PRs #16/#17 remain open and require their histories to be
  preserved when integrating. The next code change implements singles rather than more tooling.
- 2026-09-05 — Local-plan revision validation passed: `npm ci --ignore-scripts`, registry
  generation, `npm run verify` with `WORK_PACKAGE_BASE_REF=origin/main` (182 tests and unchanged
  packed Node/Angular/Chromium evidence), and `git diff --check`. This is a documentation-only
  scope change; the local tutor and its two technique implementations remain to be built.
- 2026-09-05 — Continued above the approved local-plan branch (PR #18), without merging it.
  Implemented [local singles](../contracts/local-singles.md): ordered proposals, an independently
  callable verifier and opaque state-bound capabilities for naked/hidden singles. Added five
  focused proof tests, including independent coordinate reasoning and valid non-first proposals,
  tampering, stale/forged capabilities, notes, contradictions and player-placement sequences.
  Node/Chromium consumer probes now exercise single verification. No proof application, elimination,
  model, private data or UI is added in this slice; the next step is the playable hint flow.
- 2026-09-05 — Local-singles validation passed: five `test:proof` tests, architecture/lint,
  strict compilation, registry and whitespace checks. Full `npm run verify` with
  `WORK_PACKAGE_BASE_REF=origin/work/WP-2026-003-local-tutor-plan` passed all 187 tests and packed
  Node/Angular/Chromium checks; the proof-engine package snapshot was regenerated. This slice
  exposes verified local hint facts only. The playable puzzle/UI and full proof/private gates
  remain unfinished; no merge or live behavior was authorized by these checks.
- 2026-09-05 — Continued above local-singles PR #19 without merging it. Added the local playable
  tutor, immutable verified lesson templates and three focused fixture/lesson/browser tests.
  Attempt 2 is the first unique singles-solvable generated puzzle: 28 givens and 53 placements,
  independently checked by exact cover. Values, notes, clear, undo, progressive hints, synchronized
  clue highlights, pause/show-all, keyboard controls and reduced motion are implemented. Incorrect
  entries are checked against the completion derived from verified singles for this fixed unique
  puzzle; help asks the player to recover before teaching. Board changes cancel stale lessons.
  This is local-only experience evidence, not showcase clearance, learning evidence, full replay,
  private compatibility or a release. The next checkpoint is maintainer feedback before a model.
- 2026-09-05 — Local-tutor validation passed: `npm run test:tutor` (three tests including all
  53 browser placements), strict compilation, architecture/lint/docs, registry and whitespace
  checks. Final `npm run verify` with `WORK_PACKAGE_BASE_REF=origin/work/WP-2026-003-local-singles`
  passed all 190 tests and matching packed Node 22/Angular AOT/Chromium 151.0.7922.34 results.
  Regenerated coach-core package evidence includes naked/hidden lesson consumers. Visually checked
  the explanation at 320px and 390px. No dependencies were added; this stops at a review PR and
  a local preview. Maintainer experience feedback and full proof/private gates remain outstanding.
- 2026-09-05 — Maintainer tried and accepted the local tutor and authorized its stack merge.
  Pre-merge CI exposed a test-only browser launch mismatch: CI installs full pinned Chromium,
  while the new test requested the separate headless-shell binary. Use the existing consumer's
  executable path and register cleanup before launch so startup failures cannot strand the server.
  Runtime UI behavior is unchanged; merge remains pending successful checks on the corrected head.
- 2026-09-05 — Corrected tutor launch passed full `npm run verify` with the local-singles base:
  all 190 tests and matching packed Node/Chromium checks. Registry and whitespace checks passed.
  Awaiting CI on the corrected head before executing the authorized merge.
- 2026-09-05 — Fresh CI additionally exposed ordering: packed consumers installed Chromium
  later in verification, after the new tutor suite. Tutor tests now provision the same pinned
  full browser when absent, including Linux dependencies, before opening any server. The failed
  launch exited promptly with the cleanup fix; no runtime or browser version change is needed.
- 2026-09-05 — Browser provisioning correction passed full local verification: 190 tests,
  strict compilation and matching packed consumers using the local-singles base. Fresh CI must
  additionally exercise browser installation on clean runners before the authorized stack merge.
