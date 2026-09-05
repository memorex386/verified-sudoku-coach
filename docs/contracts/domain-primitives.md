# Domain primitives checkpoint

WP-2026-003's first slice implements the initial-state portion of
[Sudoku and proof V1](sudoku-proof-v1.md). It does not implement wire DTO decoding, board actions,
technique detection/verification/application, uniqueness, or final package distribution.

## Construction and authority

Import from `@verified-sudoku/domain`. Create topology with `createTopology(6 | 9)`, a consistent
puzzle with `createPuzzle(topology, givens)`, a snapshot with
`createBoard(puzzle, revision, entries, notes)`, and initial candidates with
`initialLogicalState(board)`. Inputs must be canonical row-major cell arrays; note digits are
strictly ascending. Constructors reject invalid input without sorting or inventing defaults.
Pure queries `cells`, `units`, and `peers` return frozen arrays; `cellId` and `digit` validate
topology-relative values. Boxes are numbered row-major, units row/column/box then index.

Constructors copy and deeply freeze values. Runtime identity sets reject reconstructed or forged
puzzles/boards; these internal objects are not persistence formats. Pass actual constructed
objects within one loaded module instance; future boundary codecs reconstruct objects from DTOs.
Type brands prevent accidental structural substitution, not malicious JavaScript or hostile proxies.
Wire boundaries must JSON-decode untrusted bytes before using these APIs.

Player entries may contradict Sudoku rules; the snapshot preserves them for future deterministic
diagnostics. Initial logical state can therefore have duplicate fixed values or zero candidate
masks. It is a faithful candidate projection, not a proof of consistency, solvability, or uniqueness.
There is no API to import candidate masks or to narrow them. Proof application remains gated on
the private aggregate conformance command and linked evidence.

## Hash compatibility

`canonicalJson` and `canonicalBytes` implement the exact ASCII representation in the V1 contract;
the generic encoder caps nested depth at 64 (root at zero) to fail before stack exhaustion.
DTO adapters must still enforce the tighter per-contract byte/depth bounds. `sha256` hashes bytes;
`fingerprint` adds the named V1 zero-byte prefix. Notes/revision affect full board-state identity,
not board or initial logical identity. Changed entries rebuild initial candidates.

Projection names are lowercase alphabetic words separated by hyphens, plus the exact
`fixture-digit-d4` name already specified by the fixture protocol. Other numeric names and trailing
whitespace remain rejected. Adding this previously rejected name changes no existing fingerprint
bytes; fixture-transform tests and packed Node/Chromium consumers cover the correction.

The [API snapshot](domain-api-v1.json) records every generated declaration and a declaration digest.
`npm run test:domain` builds the package, checks that snapshot, then tests standard SHA vectors,
Node crypto agreement, canonical rejection, topology properties, candidate-oracle agreement,
mutation resistance, and state identity. Tests use original formula-generated partial grids and
small constructed synthetic states; no uniqueness or corpus claim is made.

Browser/Angular and packed Node CommonJS conformance, sealed distribution exports, all-package
API artifacts, wire schemas, generated showcase, and private parity remain later WP-2026-003
checkpoints. This slice does not satisfy those gates. Package version stays `0.0.0` with no released
compatibility promise.
