# Sudoku and proof contracts V1

This document fixes the serialized and semantic contract for WP-2026-003. TypeScript types are
convenience views; strict runtime schemas and semantic codecs are the boundary. A value is not
trusted merely because it matches a TypeScript type or passes structural decoding.

## Common encoding and bounds

Every object is exact-key and every field listed below is required. Decoders reject unknown keys,
`null`, `undefined`, sparse arrays, duplicate set members, coercion, unsafe integers, non-finite
numbers, and noncanonical ordering. Absence and an empty collection are not interchangeable.
Object property insertion order is immaterial; canonical ordering applies to set arrays.

Top-level DTOs use `schemaId` plus numeric `version`; this avoids confusing the contract envelope
with `BehaviorIdentityV1.schemaVersion`.

| Value | V1 rule |
| --- | --- |
| `version` | Literal integer `1` |
| Fingerprint | `sha256:` followed by 64 lowercase hexadecimal characters |
| `CellId` | One-based `r1c1` through `r9c9`; the selected topology applies the tighter bound |
| Digit | Safe integer 1–9; the selected topology applies the tighter bound |
| Revision | Safe integer 0–9,007,199,254,740,991 |
| Puzzle ID | `puz_` plus 16–64 lowercase ASCII letters or digits |
| Command ID | `cmd_` plus 16–64 lowercase ASCII letters or digits |
| Trace ID | `trace_` plus 16–64 lowercase ASCII letters or digits |
| Event ID | `evt_` plus 16–64 lowercase ASCII letters or digits |
| Replay ID | `replay_` plus 16–64 lowercase ASCII letters or digits |
| Proof ID | `proof_` plus 64 lowercase hexadecimal characters |
| Proof-path ID | `path_` plus 64 lowercase hexadecimal characters |
| Component version | SemVer without build metadata, at most 64 ASCII characters |
| Timestamp | UTC RFC 3339 with exactly millisecond precision |

`LowerKebabAsciiId` starts with a lowercase ASCII letter, followed by lowercase letters or digits
and optional single hyphens between nonempty alphanumeric segments; total length is 1–64.
`PrintableAscii` contains only U+0020–U+007E. Timestamps have four-digit years 0001–9999,
valid Gregorian dates, and seconds 00–59; offsets and leap seconds are rejected.

Before JSON parsing, adapters enforce these UTF-8 byte/depth ceilings: identity 4 KiB/3, action
4 KiB/5, puzzle 16 KiB/6, board 32 KiB/6, proof step 32 KiB/8, proof path 2 MiB/10, and trace or
replay 8 MiB/12. Structural schemas also enforce the collection bounds below.

### Canonical bytes and hashes

`vsc-canonical-json/v1` accepts only already-validated JSON values made from `null`, booleans,
safe integers, ASCII strings, arrays, and exact-key objects. It recursively orders object keys by
ASCII code point, preserves array order, uses compact JSON string escaping, and encodes UTF-8 with
no BOM or trailing newline. Floats, negative zero, non-ASCII strings, and unsupported values fail.
Objects must have Object.prototype or null as their prototype and only enumerable own string data
properties; symbols, accessors, cycles, and custom prototypes fail. Escaping follows JSON.stringify
for ASCII strings. The separator `\0` below is one zero byte, not two printable characters.

A typed fingerprint is lowercase SHA-256 over:

```text
vsc/<projection-name>/v1\0<canonical-json-bytes>
```

The dependency-free runtime implementation is pure TypeScript and is checked against published
SHA-256 vectors in Node and Chromium. Artifact tooling may use Node crypto only as an independent
cross-check. SHA-256 supplies integrity and stable identity, not authentication or privacy.

## Shared nested values

`TopologyV1` is exactly one of:

```ts
{ type: "classic"; size: 6; boxRows: 2; boxColumns: 3 }
{ type: "classic"; size: 9; boxRows: 3; boxColumns: 3 }
```

`UnitRefV1` is exactly one of `{ kind: "row"; index: integer }`,
`{ kind: "column"; index: integer }`, or `{ kind: "box"; index: integer }`. Indices are one-based
and topology-bounded. `LineRefV1` permits only row or column.

Arrays representing sets use row-major cells, ascending digits, or cell-then-digit conclusions.
Noncanonical but mathematically equivalent arrays are rejected rather than silently sorted.

## `BehaviorIdentityV1`

The exact object contains the two contract discriminators and all nine required behavior fields:

```ts
{
  schemaId: "vsc.behavior-identity";
  version: 1;
  rulesetVersion: "classic-six/v1";
  schemaVersion: SemVer;
  promptVersion: SemVer;
  modelProfileVersion: SemVer;
  runtimeRegistrationId: LowerKebabAsciiId; // 1..64
  runtimeBehaviorVersion: SemVer;
  rendererVersion: SemVer;
  fixtureVersion: SemVer;
  evaluationSuiteVersion: SemVer;
}
```

The ruleset literal is intentionally not SemVer. `behavior-identity` hashes the entire exact
object. Schema validation does not claim that the referenced runtime registration is approved;
runtime admission remains a separate semantic check owned by WP-2026-005.

## `PuzzleDefinitionV1`

```ts
{
  schemaId: "vsc.puzzle-definition";
  version: 1;
  puzzleId: PuzzleId;
  topology: TopologyV1;
  givens: Array<{ cellId: CellId; digit: Digit }>;
  provenance:
    | {
        kind: "generated";
        generatorId: LowerKebabAsciiId;
        generatorVersion: SemVer;
        seed: PrintableAscii; // 1..128
      }
    | {
        kind: "host-catalog";
        catalogVersion: SemVer;
        sourceFingerprint: Fingerprint;
      };
  puzzleFingerprint: Fingerprint;
}
```

`givens` has 0–`size²` entries, is strictly row-major, and has unique topology-valid cells with
topology-valid digits. Duplicate values in a row, column, or box fail domain validation. `puzzle` hashes only
`{topology,givens}`; IDs and provenance cannot change Sudoku identity. No solution is serialized.
Exact decoding and domain validity do not establish uniqueness. Only the independent exact solver
can create the module-private `VerifiedUniquePuzzle` capability.

## `BoardStateV1`

```ts
{
  schemaId: "vsc.board-state";
  version: 1;
  puzzleId: PuzzleId;
  puzzleFingerprint: Fingerprint;
  revision: Revision;
  entries: Array<{ cellId: CellId; digit: Digit }>;
  notes: Array<{ cellId: CellId; digits: Digit[] }>;
  boardFingerprint: Fingerprint;
  stateFingerprint: Fingerprint;
}
```

`entries` and `notes` each contain at most `size²` row-major unique cells; note digits are sorted,
unique, and contain 1–`size` digits. An empty note set is omitted. An entry cannot replace a given,
and a cell cannot contain both an entry and notes. A codec requires the referenced puzzle to check
all topology and identity rules.
Notes on givens are invalid. All board constructors copy and deeply freeze their values; callers
cannot mutate trusted state through retained input references.

Contradictory player entries remain representable so deterministic contradiction outcomes are
visible; they do not become trusted placements. `board` hashes `{puzzleFingerprint,entries}` and
therefore excludes revision and player notes. `board-state` hashes
`{puzzleFingerprint,revision,entries,notes}`. Player notes never influence candidates or proofs.

## `BoardActionV1`

```ts
{
  schemaId: "vsc.board-action";
  version: 1;
  commandId: CommandId;
  puzzleId: PuzzleId;
  puzzleFingerprint: Fingerprint;
  expectedRevision: Revision;
  expectedStateFingerprint: Fingerprint;
  action:
    | { type: "place-value"; cellId: CellId; digit: Digit }
    | { type: "clear-value"; cellId: CellId }
    | { type: "replace-notes"; cellId: CellId; digits: Digit[] };
}
```

Replacement note digits are sorted and unique with length 0–`size`; an empty array clears notes.
Help, self-rating, selection, consent, and lifecycle activity are Coach commands in WP-2026-004,
not fake board mutations. Reusing a command ID with different canonical bytes is invalid. Revision
or fingerprint mismatch is stale. Given-cell mutation is invalid.
Placement replaces an existing entry and removes that cell's notes. Clearing removes an existing
entry; clearing an empty cell is invalid. Notes cannot be set on a filled cell. Replacing a value
or note set with the identical value is invalid. An accepted mutation increments revision exactly
once; revision exhaustion rejects as `invalid-action`. Staleness is checked before action semantics.
Command deduplication belongs to the application, not domain constructors.

## Authoritative logical state

Advanced eliminations do not belong in `BoardStateV1`. The domain owns an internal immutable
`LogicalState` containing ruleset, puzzle fingerprint, effective fixed values, and a topology-complete
row-major candidate mask for every unresolved cell. It begins with candidates derived only from
givens and player entries. Applying a verified elimination narrows that state; applying a verified
placement propagates peer removals while retaining all prior verified eliminations.

`logical-state` hashes exactly `{rulesetVersion,puzzleFingerprint,values,candidates}`. `values`
is a row-major array of `{cellId,digit}` including givens and entries. `candidates` is a row-major
array of `{cellId,mask}` for every empty cell, including zero masks; bit `digit-1` denotes a
candidate, with no bits above `size-1`. Neither revision nor notes enter this projection.
Initial construction derives all masks; there is no public constructor accepting arbitrary masks.
Changing player entries reconstructs initial logical state; changing only notes retains its
fingerprint. Proof application is implemented only after the private conformance gate, never via
an unrestricted candidate-mask setter.

Only constructors and
verified proof application can produce a trusted logical state. A standalone serialized step is
untrusted; independent replay reconstructs the initial logical state and each preceding transition.

## `ProofStepV1`

```ts
{
  schemaId: "vsc.proof-step";
  version: 1;
  proofId: ProofId;
  puzzleId: PuzzleId;
  puzzleFingerprint: Fingerprint;
  sourceBoardRevision: Revision;
  sourceBoardFingerprint: Fingerprint;
  rulesetVersion: "classic-six/v1";
  technique: TechniqueV1;
  beforeStateFingerprint: Fingerprint;
  afterStateFingerprint: Fingerprint;
  premises: TechniquePremisesV1;
  conclusions: ConclusionV1[];
}
```

`TechniqueV1` is `naked-single`, `hidden-single`, `locked-pointing`, `locked-claiming`,
`naked-pair`, or `hidden-pair`. `ConclusionV1` is exactly
`{ kind: "place"; cellId; digit }` or `{ kind: "eliminate"; cellId; digit }`.

The `premises` discriminant repeats and must equal `technique`:

| Technique | Exact premise-specific fields |
| --- | --- |
| Naked single | `technique`, `targetCellId`, `candidateDigits` containing exactly one digit |
| Hidden single | `technique`, `unit`, `digit`, `candidateCellIds` containing exactly the target cell |
| Locked pointing | `technique`, `sourceBox`, `digit`, complete `candidateCellIds` of length 2–3, `confinedTo` line |
| Locked claiming | `technique`, `sourceLine`, `digit`, complete `candidateCellIds` of length 2–3, `confinedToBox` |
| Naked pair | `technique`, `unit`, ascending two `digits`, row-major two `cellIds` |
| Hidden pair | `technique`, `unit`, ascending two `digits`, row-major two `cellIds` |

Single techniques have exactly one placement conclusion. Elimination techniques have 1–14
cell-then-digit conclusions. Verifiers recompute the complete premise sets and maximal conclusion
set from the exact logical state; missing, extra, reordered, stale, duplicated, or no-op conclusions
fail. A verifier never imports a detector. Only a verifier can create a module-private
`VerifiedProof` capability, and application checks that capability plus the current fingerprint.

`proofId` is `proof_` plus the unprefixed digest from the `proof` projection of ruleset, technique,
premises, conclusions, and before/after logical-state fingerprints.
The exact projection keys are `rulesetVersion`, `technique`, `premises`, `conclusions`,
`beforeStateFingerprint`, and `afterStateFingerprint`. Source box fields are box `UnitRefV1`
objects, source line fields are `LineRefV1` objects, and pair `digits`/`cellIds` contain exactly two
members. Contradictory logical states cannot authorize a technique proof.

## `ProofPathV1`

```ts
{
  schemaId: "vsc.proof-path";
  version: 1;
  proofPathId: ProofPathId;
  puzzleId: PuzzleId;
  puzzleFingerprint: Fingerprint;
  sourceBoardRevision: Revision;
  sourceBoardFingerprint: Fingerprint;
  rulesetVersion: "classic-six/v1";
  initialStateFingerprint: Fingerprint;
  steps: ProofStepV1[];
  outcome: ProofPathOutcomeV1;
  finalStateFingerprint: Fingerprint;
}
```

`steps` has length 0–810. Outcomes are exactly `solved`, `stalled`, or one of these contradictions:

```ts
{ type: "solved" }
{ type: "stalled" }
{ type: "contradiction"; code: "empty-candidate-set"; cellId: CellId }
{ type: "contradiction"; code: "duplicate-fixed-value"; unit: UnitRefV1; digit: Digit; cellIds: CellId[] }
{ type: "contradiction"; code: "no-solution" }
```

Duplicate-cell contradictions contain 2–`size` row-major cells. Every step has the same puzzle,
source board, and ruleset identity. The first `before` equals `initial`; adjacent fingerprints chain;
the last `after` equals `final`; an empty path requires `initial === final`; proof IDs are unique.
`solved` requires a complete valid grid. `stalled` requires an incomplete noncontradictory state
with no canonical supported proposal. `no-solution` requires the independent exact solver.

`proofPathId` hashes source identity, ordered proof IDs, outcome, and final fingerprint. A solution
grid is not serialized separately.
Its `proof-path` projection is exactly `{puzzleId,puzzleFingerprint,sourceBoardRevision,
sourceBoardFingerprint,rulesetVersion,initialStateFingerprint,proofIds,outcome,finalStateFingerprint}`.
When multiple contradictions exist, choose duplicate fixed values first (rows, columns, boxes;
unit index then digit), then the first row-major empty candidate set, then exact-solver no-solution.
The exact solver is proof-engine code separate from technique modules; it operates on fixed values.
The 810 bound follows from at most 729 candidate removals plus 81 placements, each step making
progress. Exceeding it is an implementation error, never a false `stalled` result.

## `TraceEnvelopeV1`

```ts
{
  schemaId: "vsc.trace-envelope";
  version: 1;
  traceId: TraceId;
  traceRevision: integer; // 0..500
  dataClassification: "public-synthetic" | "private-account-linked";
  behaviorIdentity: BehaviorIdentityV1;
  behaviorIdentityHash: Fingerprint;
  puzzle: PuzzleDefinitionV1;
  lifecycle:
    | { state: "open"; startedAt: Timestamp }
    | {
        state: "closed";
        startedAt: Timestamp;
        closedAt: Timestamp;
        reason: "completed" | "abandoned" | "withdrawn" | "trace-limit" | "error";
      };
  events: TraceEventV1[];
  traceFingerprint: Fingerprint;
}
```

`TraceEventV1` is a strict discriminated union with common `eventId`, contiguous `sequence` 1–500,
`recordedAt`, and `behaviorIdentityHash`, plus one of these exact pairs:

| `type` | `payload` |
| --- | --- |
| `board-state` | `BoardStateV1` |
| `board-action` | `BoardActionV1` |
| `proof-step` | `ProofStepV1` |
| `proof-path` | `ProofPathV1` |

The event count is 0–500, `traceRevision === events.length`, event IDs are unique, timestamps are
nondecreasing and within the lifecycle, every identity hash equals the envelope hash, and every
payload matches the envelope puzzle. `trace` hashes all fields except `traceFingerprint`.
Closed lifecycle end time must not precede start time. This envelope checks structure and identity;
it is not an executable proof of event causality. Replay validation additionally executes actions
and independently verifies proof paths. Public replay puzzles require generated provenance.
These are the complete WP-2026-003 event variants; later raw model or Coach events require an exact
new variant and contract review, never an `unknown` payload.

## `ReplayArtifactV1`

```ts
{
  schemaId: "vsc.replay-artifact";
  version: 1;
  replayId: ReplayId;
  dataClassification: "public-synthetic";
  behaviorIdentity: BehaviorIdentityV1;
  behaviorIdentityHash: Fingerprint;
  puzzle: PuzzleDefinitionV1;
  initialBoard: BoardStateV1;
  records: ReplayRecordV1[];
  replayFingerprint: Fingerprint;
}
```

`records` contains 0–500 entries ordered by contiguous `sequence`. Each is exactly:

```ts
{
  sequence: integer; // 1..500
  action: BoardActionV1;
  result:
    | { type: "accepted"; board: BoardStateV1; proofPath: ProofPathV1 }
    | { type: "rejected"; code: "stale" | "invalid-action"; stateFingerprint: Fingerprint };
}
```

The initial board and every record match the puzzle. Accepted records advance revision by one and
form a state/fingerprint chain; rejected records do not advance it. Action IDs are unique. Every
proof path starts from its accepted result board. `replay` hashes every field except
`replayFingerprint`. This V1 is a deterministic board/proof replay, not evidence of live AI. Coach
results added in WP-2026-004 require a reviewed exact schema revision rather than an open payload.

## Package and artifact boundary

Public packages build before packing, include only `dist`, and export only the package root through
conditional `types`, `import`, `require`, and `default` entries. The Node 22 CommonJS fixture uses
Node's synchronous `require(esm)` behavior; V1 does not promise a separately emitted CommonJS
implementation. Deep imports must fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`.

Pack verification creates tarballs with lifecycle scripts disabled, installs those tarballs—not
workspace links—into temporary Angular ESM and Node 22 CommonJS consumers, compares two pack hashes
and file lists, validates committed API/declaration hashes, and scans browser-safe contents for
provider, key, Node-only, source-map, absolute-path, and undeclared-file leakage. Real pinned
Chromium executes the portable fingerprint vectors; an undeclared local browser is not accepted.

## Validation ownership

Zod owns exact wire shape and local collection bounds. Boundary codecs own topology-relative
semantics, canonical ordering, references, and recomputed DTO fingerprints. Domain constructors
own immutable internal invariants. The exact solver alone owns uniqueness. Technique verifiers
alone own proof validity. Trace/replay codecs own cross-record identity and sequence checks. No
decoder supplies defaults, sorts input, repairs a hash, or creates a verified proof.
