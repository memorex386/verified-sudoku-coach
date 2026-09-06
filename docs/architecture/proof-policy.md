# Proof policy

## Local milestone

The accepted [local tutor amendment](../product/plans/VSC-PLAN-2026-09-05.3.md) permits isolated
`local-singles/v1` implementation before private conformance. It supports naked/hidden singles
with independent verification and generated tests. No supported hint means unsupported locally,
not a `classic-six/v1` stalled proof. Private integration and full-engine acceptance retain their
aggregate gate. Existing six-technique contracts below remain the release target.

## Supported scope

The reusable engine supports Classic 6x6 boards with 2x3 boxes and Classic 9x9 boards with 3x3
boxes. Coach v1 accepts only independently generated 9x9 Classic fixtures. Notes are player state,
never logical truth. A separate exact solver establishes validity and uniqueness and yields an
opaque verified puzzle; technique search cannot certify its own fixture.

The v1 ruleset is `classic-six/v1`:

1. Naked single.
2. Hidden single.
3. Locked candidate pointing.
4. Locked candidate claiming.
5. Naked pair.
6. Hidden pair.

Search restarts at naked single after every verified proof. A result that changes no candidate or
value is invalid.

## Canonical order

- Cells use row-major order.
- Hidden singles scan rows, columns, then boxes; within a unit, digit then cell.
- Pointing scans box then digit and prefers row before column.
- Claiming scans rows before columns, then unit, digit, and target box.
- Pair techniques scan rows, columns, then boxes; order by digit pair then cell pair.
- Eliminations order by target cell then digit.

Proof IDs derive deterministically from ruleset, technique, complete premises/conclusions, and the
before/after fingerprints. Detectors return proposals; a separate technique-specific verifier
recomputes candidates and all premises from the exact board. Only a branded verified proof can be
applied or registered for a model reference.

## Generated showcase

WP-2026-003 will generate the public fixture from seed `vsc-fixture/v1:<attempt>` using a documented
deterministic PRNG, a randomized complete grid, and 180-degree clue removals that preserve
uniqueness. It targets 27–30 givens, six-technique completion, and visible locked-candidate plus
naked-pair eliminations in canonical steps 1–20. It is labeled `curated` until human timing exists.

The committed manifest includes givens, seed/generator/ruleset versions, uniqueness and proof-path
digests, intended coverage, transforms, and license. CI regenerates identical bytes. A private
comparison checks exact and normalized digit/D4 collision count equals zero and publishes only that
aggregate; neither the private corpus nor a borrowed solution enters this repository.

## Private compatibility

Sudoku World's legacy hint behavior is preserved under a separately versioned display policy:
singles plus a verified reveal, existing analytics vocabulary, and selected-cell priority. That
policy is not the canonical proof path. Differential tests precede replacement of the private
implementation; generated parity fixtures may remain, private boards may not.
