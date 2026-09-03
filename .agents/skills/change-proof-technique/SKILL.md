---
name: change-proof-technique
description: Add or change a deterministic Sudoku proof technique with proof invariants, generated fixtures, canonical ordering, property and metamorphic tests, tamper tests, and corpus regression evidence.
---

# Change a proof technique

Follow the [proof-technique runbook](../../../docs/runbooks/change-proof-technique.md) and the
active work package. A detector may propose a step, but an independent verifier must accept the
fully explicit proof against the exact board before it can be applied or referenced by coaching.

Require the active work package to be `Ready` or `In progress`, all dependencies to be `Done`, and
every public/private validation command to be named exactly; otherwise stop and refine the package.
Specify canonical ordering and near-miss behavior first. Add generated positive, negative, stale,
tampered, property, metamorphic, and path-replay cases at the lowest owning layer. Reproduce the
public fixture and run the exact private aggregate corpus command declared by the private work
package without copying its puzzles. Any
change to the frozen baseline is a ruleset/version decision, including an apparent improvement.
