# Evaluation data card

- Status: Planned / unmeasured
- Public datasets: None registered
- Production data: Prohibited

## Intended contents

WP-2026-003 will define a reproducible generator and commit only independently generated fixtures.
Each released fixture set will document its seed, generator commit, puzzle hash, uniqueness check,
supported-technique coverage, transformations, partitions, limitations, and license.

No Sudoku World puzzle, private corpus entry, player board, action trace, note history, provider
trace, or user feedback text may be used as a public fixture. Private corpus checks may be reported
only as reviewed aggregates with source limitations and may not make the private records
reconstructable.

## Leakage prevention

All digit permutations, row/column permutations, rotations, reflections, and other derived cases
from one source puzzle remain in the same partition. Regression cases derived from production
failures must be independently minimized or regenerated so the public case contains no original
board or user content.

## Known limitations

No public executable generator, fixture corpus, held-out set, proof-regression report, or model-evaluation
report exists in WP-2026-001. The accepted private aggregate compatibility threshold of 5,147/5,191
Easy–Hard puzzles remains a future regression requirement, but that aggregate is not public proof evidence
and its underlying private corpus is not part of this repository. The project therefore currently has no
public measured evidence about proof coverage or model behavior.
