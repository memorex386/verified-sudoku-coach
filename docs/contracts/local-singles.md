# Local single hints

This implements the two techniques in the accepted
[local tutor plan](../product/plans/VSC-PLAN-2026-09-05.3.md). The proof-engine root exports:

- `proposeSingle(board)`: returns an immutable `proposal`, `solved`, `unsupported` or
  `contradiction` result. Search follows the plan's naked-first, row-major and unit/digit ordering.
- `verifySingle(board, proposal)`: independently recomputes the requested premises, without
  calling a detector. Returns an opaque `VerifiedSingle` capability or `null` for invalid input.
  A valid non-first single may be verified independently of the detector's preferred hint.
- `readVerifiedSingle(board, capability)`: returns copied/frozen facts for that exact state, or
  `null` for a stale, copied, deserialized or fabricated capability. It never applies a move.

`SingleProposal` is an exact internal object with `profile:"local-singles/v1"`,
`stateFingerprint`, `technique`, `cellId`, `digit`, and `unit`. Naked singles require `unit:null`;
hidden singles require exactly `{kind:"row"|"column"|"box",index}`. Bindings include player notes
and revision so changing the board invalidates the lesson, although notes never define candidates.
Malformed fields, extra keys, false premises and stale bindings reject. These are internal values,
not a new wire schema; external messages still need boundary decoding. Forged domain Boards throw
`untrusted-board`. The API is not a sandbox for hostile JavaScript proxies.

The shared state reader uses authentic domain candidates and rejects duplicate fixed values,
empty candidate sets and missing digit opportunities in a unit. It does not run an exact solver
or establish global satisfiability/uniqueness. These are deductions conditional on the supplied
fixed values; the tutor must start from its independently checked unique puzzle and handle
incorrect player entries. `solved` means complete with valid units. `unsupported` means no single
was found, not a full six-technique stalled outcome or proof of unsatisfiability.

No arbitrary logical state is accepted, no elimination is performed, and no `ProofStepV1` or
`ProofPathV1` is promoted to verified. Existing full replay/application gates remain unfinished.
The UI must read verifier-issued facts and let the player use the existing player-action API.

`npm run test:proof` covers independent coordinate-based candidates/order, both sizes, hidden
single units, tampering, stale/forged values, note separation, contradictions and placement
sequences on original formula-based states. They are not showcase or private-corpus evidence.
`npm run pack:smoke` checks the exported API in Node and Angular/Chromium consumers. The public
package remains `0.0.0`; changed packed exports/bytes require the updated conformance snapshot.
