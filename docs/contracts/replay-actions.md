# Replay player-action checkpoint

`decodeUnverifiedReplay(text)` now executes the player-action portion of
[ReplayArtifactV1](sudoku-proof-v1.md#replayartifactv1) using the domain's
[immutable action API](player-actions.md). A valid hash alone no longer permits an unrelated
recorded result board or a false rejection reason. Success still returns only
`{verification:"unverified",dto}` inside the ordinary decode result.

## Execution and failure rules

The existing exact JSON schema, 8 MiB/depth-12 ceiling, generated provenance, identity checks,
and maximum 500 ordered records with unique command IDs remain in force. Each action must have
valid wire shape, puzzle references, topology bounds and canonical note ordering, even when its
record claims rejection. Malformed wire actions cannot be smuggled in as rejected commands.

Starting from the decoded initial board, each record is executed with its recorded expected
revision and full state fingerprint. For well-formed actions, mismatched expectations produce
`stale` before applicability checks. Given mutations, no-ops, notes on filled cells and exhausted
revision produce `invalid-action` when expectations match.

- An accepted record must execute successfully. Its independently decoded board must match the
  complete canonical domain result, including entries, notes, revision and fingerprints. Only
  this result advances the current board. Its proof path is then checked against that board.
- A rejected record must actually reject with the recorded code and unchanged state fingerprint.
  It never advances the board. A valid current-state action cannot be recorded as rejected.
- A mismatch in action outcome, board contents, or rejection reason fails the entire decode with
  bounded `semantic` error. Existing shape, reference and fingerprint failures retain their codes;
  no rejected payload or diagnostics escape. Execution changes no external state.

## Trust and compatibility

This checks player input causality, not Sudoku correctness. Contradictory entries remain allowed,
notes never define candidates, and no proof step is applied. Proof-path deductions, eliminations,
outcomes and claimed logical hashes remain unverified beyond their existing framing checks.
A deliberately false deduction can still pass this decoder; consumers must not render it as fact.
Complete proof replay requires independently verified logical transitions and retention of
verified eliminations, which remain behind the private aggregate conformance gate.

The public function signature, DTO fields, schema versions and package version `0.0.0` are
unchanged. This is staged enforcement of existing V1 semantics: previously accepted framing-only
artifacts with false player transitions now fail. Existing valid synthetic compatibility examples
remain unchanged. Consumers must pin a reviewed immutable commit and continue handling bounded
decode failure; no release or private host upgrade occurs here.

## Evidence

`npm run test:contracts` checks freshly rehashed incorrect result boards, unrelated-cell changes,
note/placement/replacement/clear sequences, false rejection codes, stale precedence, revision
exhaustion and 500 records ending in an accepted action with a deliberately false proof claim.
Inputs are original synthetic compatibility states, not accepted showcase fixtures or corpus data.
`npm run pack:smoke` compares unchanged replay success and rehashed altered-action rejection in
packed Node and Angular/Chromium consumers. These establish player-action checking only.
