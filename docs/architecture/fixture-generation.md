# Deterministic public fixture generation

This protocol generates independently owned public test material. It is deterministic and
selection-biased by design; it is not random-sample evidence of Sudoku difficulty, learning, or
model quality.

The staged implementation and its current claim limits are recorded in
[fixture tooling](fixture-tools.md). That checkpoint is not an accepted showcase.
The [artifact boundary checkpoint](../contracts/fixture-artifacts.md) implements exact schemas
and unverified artifact readers; file regeneration and proof/private acceptance remain separate.

## Seed and bounded search

The generator accepts only `vsc-fixture/v1:<attempt>`, where `attempt` is canonical decimal
0–4,294,967,295 with no whitespace, sign, leading zero (except `0`), exponent, or Unicode digit.
The showcase search tests attempts 0 through 999,999 and selects the lowest attempt that passes all
filters. Exhaustion fails closed. Changing seed syntax, attempt ceiling, or a filter changes the
generator and fixture versions.

Exact UTF-8 seed bytes, with no BOM or newline, are SHA-256 hashed. The first four little-endian
32-bit words initialize xoshiro128**; an all-zero state replaces word zero with `0x9e3779b9`.
Arithmetic uses `Math.imul`, rotation, and unsigned 32-bit operations. Bounded draws use rejection
sampling, never direct modulo reduction. Fisher–Yates runs from the final item down to index one.
For bound `n`, discard unsigned draws at or above `floor(2^32/n)*n`, then return `draw % n`.
Shuffle inputs start ascending. A shuffled row/column list maps destination index to source index;
digit list element `d-1` replaces old digit `d`. Rotations are clockwise; vertical reflection maps
`(r,c)` to `(r,8-c)` and is applied before the listed rotation. Shards must account for every
lower attempt before selecting a winner; exhaustion emits no fixture.

The required `vsc-fixture/v1:0` vector is:

```text
seed sha256: 240a7c14c6d86aee2075bcf99ab876588d60e3c2d5be0aa761969f281f80681f
initial words: 147c0a24 ee6ad8c6 f9bc7520 5876b89a
first outputs: 640d69f4 7fbe8d51 f503b300 f58915c2 a824d2e8 2b3b00c7 9eb423ff 67751345 2ded0ebb 44ea1457
```

Xoshiro is reproducible, not cryptographic. It belongs in generated-fixture tooling, never core
authorization or user-visible randomness.

## Complete grid

For zero-based row `r` and column `c`, begin with
`1 + ((3*r + floor(r/3) + c) mod 9)`. Continue the same PRNG stream and, in order:

1. Shuffle digits 1–9.
2. Shuffle the three bands.
3. For each band in shuffled order, shuffle its three row offsets.
4. Shuffle the three stacks.
5. For each stack in shuffled order, shuffle its three column offsets.
6. Draw one of the eight D4 transforms in fixed order.

Apply digit, row, column, then D4 transformation. Independently validate the finished grid before
removing clues. This samples a documented symmetry family; it is not uniform over completed Sudoku
grids.

## Symmetric clue removal and uniqueness

Create 41 row-major 180-degree orbits: `[i, 80-i]` for `i=0..39` and center `[40]`. Shuffle them
using the continued stream. Start with all clues and visit every orbit once. Skip an orbit when its
removal would leave fewer than 27 givens. Otherwise remove it tentatively and keep the removal only
when the independent exact solver reports exactly one solution; restore it for zero or multiple
solutions. Reject the attempt unless its final clue count is 27–30.

The exact solver is separate from the six-technique engine. It rejects conflicting givens and uses
bit-mask depth-first search: choose the empty cell with the fewest legal candidates, break ties
row-major, explore digits ascending, and stop after the second solution. The committed uniqueness
record is a solver receipt, not a standalone proof certificate. `fixtures:check` establishes the
claim by rerunning the exact solver from the public givens and requiring a count of one.

## Selection filters

An attempt is accepted only when all conditions hold:

- 27–30 givens and exact-solver count one.
- The canonical `classic-six/v1` path reaches `solved` using only the six supported techniques.
- At least one locked-pointing or locked-claiming elimination occurs within canonical steps 1–20.
- At least one naked-pair elimination occurs within canonical steps 1–20.
- Every path step independently re-verifies and strictly changes logical state.
- The path stays within the deterministic 810-step safety bound.

The fixture need not exercise every technique. “Six-technique completion” means completion within
the six-technique ruleset. Human timing is not a filter; the showcase is labeled `curated` until
measured.

## Canonical artifacts

The grid form is exactly 81 row-major ASCII digits with `0` for blank. Files use
`vsc-canonical-json/v1` from the V1 contract, UTF-8 without BOM or final newline. Artifacts live in:

```text
fixtures/classic-9x9/showcase-v1/puzzle.json
fixtures/classic-9x9/showcase-v1/uniqueness-receipt.json
fixtures/classic-9x9/showcase-v1/proof-path.json
fixtures/classic-9x9/showcase-v1/manifest.json
fixtures/manifest.json
```

These exact objects use the V1 contract's Fingerprint, TopologyV1, and SemVer primitives.
Every field is required; unknown keys fail. Artifact references are `{path,hash}` with a path from
the list above and `hash` equal to raw SHA-256 of file bytes, prefixed `sha256:`.

```ts
type UniquenessReceipt = {
  schemaId: "vsc.uniqueness-receipt"; version: 1;
  puzzleFingerprint: Fingerprint;
  solverVersion: "1.0.0"; solutionCount: 1;
};
type FixtureManifest = {
  schemaId: "vsc.fixture-manifest"; version: 1;
  fixtureId: "showcase-v1"; fixtureVersion: "1.0.0";
  classification: "public-synthetic"; license: "Apache-2.0";
  seed: string; attempt: number; searchStart: 0; searchEnd: 999999;
  generatorId: "classic-symmetric"; generatorVersion: "1.0.0";
  generatorSourceDigest: Fingerprint;
  prng: "xoshiro128-starstar/v1"; seedDerivation: "sha256-le128/v1";
  topology: TopologyV1; givensCount: number;
  puzzle: ArtifactReference; uniquenessReceipt: ArtifactReference;
  solverVersion: "1.0.0"; solutionCount: 1;
  rulesetVersion: "classic-six/v1"; proofEngineVersion: SemVer;
  proofPath: ArtifactReference; outcome: "solved"; stepCount: number;
  techniqueCounts: {
    "naked-single": number; "hidden-single": number;
    "locked-pointing": number; "locked-claiming": number;
    "naked-pair": number; "hidden-pair": number;
  };
  firstLockedStep: number; firstNakedPairStep: number;
  selectionFilter: "early-locked-pair/v1";
  transformSuite: "classic-transforms/v1";
  familyId: "showcase-v1"; partition: "showcase";
  transforms: Array<{id: string; puzzleFingerprint: Fingerprint}>;
  collisionScheme: "digit-d4/v1";
  publicExactKeyHash: Fingerprint; publicNormalizedKeyHash: Fingerprint;
  limitations: ["nonuniform", "selection-biased", "solve-time-unmeasured"];
};
type FixtureRegistry = {
  schemaId: "vsc.fixture-registry"; version: 1;
  fixtures: [ArtifactReference]; // showcase manifest only
};
```

Manifest integers are safe, nonnegative, and bounded: attempt 0–999999, givensCount 27–30,
step/technique counts 0–810, early indices 1–20. Technique counts sum to stepCount; seed agrees
with attempt; topology is 9x9; references and counts must match regenerated artifacts.
The selection-filter literal binds exactly the filters above. Receipt limit is 1 KiB/depth 2,
manifest 32 KiB/depth 5, registry 1 KiB/depth 3. No receipt contains a solution.

`classic-transforms/v1` has 14 ordered records: `d4-0` through `d4-7` in the order below,
`digit-cycle` (1→2→…→9→1), `band-swap` (bands 0/1), `stack-swap` (stacks 0/1),
`row-swap` (rows 0/1), `column-swap` (columns 0/1), and `composition` (the last five in that
order). Every transform keeps its fixture family/partition; none becomes held-out evidence.
Public collision hashes use typed projections `fixture-exact` and `fixture-digit-d4` of the
respective grid string. Only public keys appear in this manifest.

The top-level fixture registry hashes child manifests; a release manifest later hashes that
registry. The generator source digest is the `generator-source` typed hash of a path-sorted array
of `{path,hash}` for all tracked `.ts`/`.mjs` files under `packages/domain/src`,
`packages/proof-engine/src`, and `packages/testing/src/fixtures`. File hashes use raw file bytes.
Generation code lives only in those directories; hash changes force regeneration. This avoids a
circular source-commit field. Every path is repository-relative and allowlisted.

## Transform and collision protocol

The 9x9 metamorphic suite covers all eight D4 transforms, deterministic digit permutations, band
and stack permutations, rows within bands, columns within stacks, and deterministic compositions.
It transforms a verified proof and re-verifies it; it does not require a transformed puzzle to
choose the same row-major first proof. For 6x6 2x3 topology, identity, 180-degree rotation, and
horizontal/vertical reflections preserve the topology; 90/270-degree rotations and diagonal
reflections create unsupported 3x2 boxes and are excluded.

The private collision check never exports rows or per-puzzle hashes. Its exact key is the 81-byte
givens grid. Digit normalization scans row-major and maps the first unseen nonzero digit to `1`, the
next to `2`, and so on. D4 order is identity, rotations 90/180/270, vertical reflection, then that
reflection rotated 90/180/270. Normalize each transformed grid and choose the lexicographically
smallest ASCII result. Domain-separated exact and normalized keys are hashed only inside the
private repository.

Publishable aggregate output contains only corpus count, supported-technique solved count, invalid
application count, exact collision count, normalized collision count, ruleset version, public
manifest hash, and aggregate result hash. A count change—including an increase above the frozen
5,147/5,191 baseline—requires an explicit ruleset/version decision. SHA-256 is not privacy;
private puzzle hashes and transform lineage remain private.

## Required reproducibility checks

Tests cover seed rejection boundaries, the fixed PRNG vector, a fixed complete grid/orbit order,
serial-versus-sharded lowest-attempt selection, exact artifact regeneration, invalid/unsatisfiable/
multiple/unique solver cases, receipt and manifest tampering, every declared transform family,
aggregate-only private comparison, and Node/Chromium proof/hash equality. Windows and Ubuntu must
produce byte-identical public artifacts.
