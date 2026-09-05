# Fixture tooling checkpoint

WP-2026-003 implements the seed, complete-grid and clue-removal portions of the
[fixture-generation protocol](fixture-generation.md) under `packages/testing/src/fixtures`.
`npm run test:fixture-tools` compiles the package and runs nine tests; the root verifier includes
this command. This tooling adds no dependency and changes no domain or proof-engine behavior.

## Implemented surface

| Export | Behavior |
| --- | --- |
| `fixtureAttempt` | Exact canonical seed syntax and unsigned 32-bit attempt range |
| `fixtureRandom` | SHA-256 little-endian seed words, xoshiro128**, unbiased bounded draws, copied Fisher–Yates shuffles |
| `boundedDraw` | Rejection sampling with validated unsigned words and bounds 1 through 2^32 |
| `countSolutions` | Independent Classic 9x9 bit-mask DFS; MRV with row-major ties, ascending digits, stop at the second solution |
| `transformGrid` | The eight specified D4 mappings for 81-digit 9x9 grids |
| `generationPlan` | Independently validated completed grid and frozen shuffled 180-degree clue orbits |
| `generateCandidate` | One seed's symmetric removals, retaining only uniquely solvable grids with at least 27 clues |

The counting solver accepts exactly 81 ASCII digits, with zero as blank. Malformed input or
conflicting givens throw; structurally consistent but unsatisfiable givens return zero. Two means
at least two solutions. It maintains only call-local state, imports no domain candidate or
technique implementation, and does not return a solution or grant a verified puzzle/proof capability.
The solver and generator are offline test tooling; they are not added to the core package graph.

Candidate results are immutable and explicitly carry `selection: "unfiltered"`. Their
`clueCountAccepted` flag means only that the final clue count is 27–30. The complete seed grammar
allows attempts through 4,294,967,295; the eventual showcase search remains restricted to
0–999,999. No function in this checkpoint performs that search or selects a showcase.

## Evidence and provenance

All inputs are original formula-generated or synthetic negative cases, licensed Apache-2.0 and
used only as tooling tests. No private source, puzzle, corpus hash or solution was consulted.
The fixed seed-zero complete grid and orbit order were independently reproduced using Python
`hashlib`/little-endian word decoding and matrix rotations from the public protocol. The PRNG
matches the protocol's ten fixed words, and rejection-tail tests distinguish unbiased draws from
simple modulo reduction.

The tests use a separate Algorithm X exact-cover oracle over 324 Sudoku constraints. It shares
no masks, candidate helpers or generator code with the counting solver. It confirms zero, one and
multiple-solution cases, independently replays every clue-removal decision for seed zero, checks
seven specified seed attempts, and confirms all eight D4 transforms preserve the test candidate's
uniqueness. Seed zero yields 28 givens. These are deterministic, selected test cases, not statistical
evidence of solver coverage, Sudoku difficulty or model quality.

## Remaining gates

This checkpoint produces no showcase artifacts, uniqueness receipts, fixture registry, proof path
or release. `fixtures:check` and `proof:hashes` remain unimplemented acceptance commands, distinct
from the executable `test:fixture-tools` checkpoint. Still required are canonical technique
filters, bounded lowest-attempt selection and sharding, receipts/manifests and tamper checks,
the complete transform/collision suite, private aggregate clearance, and proof replay/hash
conformance. Technique detectors, verifiers and application remain gated on the private
conformance command and linked evidence. The work package remains In progress.
