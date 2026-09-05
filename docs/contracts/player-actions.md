# Immutable player-action checkpoint

This WP-2026-003 slice executes the player mutations already specified by
[BoardActionV1](sudoku-proof-v1.md#boardactionv1). It does not apply a proof, certify a placement,
deduplicate commands, or introduce coaching policy.

## Domain entry point

The root of `@verified-sudoku/domain` exports:

```ts
applyPlayerAction(board, expectedRevision, expectedStateFingerprint, action)
```

`board` must be an actual domain-constructed Board. `action` is a `PlayerAction` with exactly
`{type:"place-value",cellId,digit}`, `{type:"clear-value",cellId}`, or
`{type:"replace-notes",cellId,digits}`. It is a domain value, not a wire envelope. The expectation
arguments bind the full board state, including notes, and prevent applying a stale action.

The deeply immutable `PlayerActionResult` is exactly one of:

- `{type:"accepted",board}` with a newly constructed immutable board and revision incremented once.
- `{type:"rejected",code:"stale"|"invalid-action",stateFingerprint}` with the unchanged board's
  state fingerprint and no new board.

A forged board throws `untrusted-board`, consistently with other domain APIs. Malformed expectation
arguments reject as `invalid-action`; valid but mismatched expectations reject as `stale` before
examining action semantics, including accessors. Current-state malformed actions, exhausted
revision, changes to givens, and no-ops reject as `invalid-action`. No payload or exception detail
enters a rejection result. Boundary JSON decoding remains required for untrusted external input;
this domain API is not a sandbox for hostile JavaScript proxies.

## Mutation rules

Placement replaces a previous entry and removes only that cell's notes. Clearing requires an
existing entry. Notes cannot be changed on given or entered cells; a nonempty replacement is
strictly ascending, unique, and topology bounded, while an empty replacement removes the note
record. Identical values/notes are no-ops and reject. Other cells remain unchanged. The constructor
copies collections and returns canonical row-major entries/notes, without sorting supplied note
digits into validity.

Contradictory player entries remain representable. An accepted action means accepted player input,
not a verified Sudoku move or a successful learner assessment. Notes never narrow logical
candidates. Calling `initialLogicalState` on the returned board rebuilds candidates from fixed
values; note-only changes retain the initial logical fingerprint. This API has no LogicalState
argument and cannot import, narrow, or apply verified eliminations. Retention of verified
eliminations across proof transitions remains governed by the existing proof contracts.

## Boundary and application responsibilities

`decodeBoardAction` still validates the complete wire envelope against a decoded board without
mutating it. An application passes its validated action, expected revision, and expected state
fingerprint to this domain function. Puzzle ID/fingerprint routing and command-ID deduplication
remain external responsibilities; arbitrary wire objects must not skip the codec.

The new result is an internal domain union, not a change to ReplayArtifactV1. Executable replay,
unique-puzzle certification, proof verification/application, and the private aggregate conformance
command remain unfinished. No codec, proof-engine, or coach-core implementation is added here.
The [visual-storytelling reference](../product/concepts/coach-interaction.md) remains future UI input.

## Validation

`npm run test:domain` covers 6x6/9x9 mutations, revision exhaustion, malformed actions, no-ops,
given protection, immutable input ownership, note/candidate separation, staleness before
semantics, accessor rejection without invocation, and a 162-action sequence checked against a
separate coordinate-array model. Tests use constructed public synthetic states only.

`npm run pack:smoke` executes note changes, placement, and stale rejection in clean packed Node
and Angular/Chromium consumers, comparing the resulting board and logical fingerprints. API
declaration/export snapshots are updated; existing wire schema versions and package version
`0.0.0` remain unchanged. These checks establish player-action behavior, not proof soundness,
private corpus parity, complete replay, or user learning.
