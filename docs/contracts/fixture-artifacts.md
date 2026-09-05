# Fixture artifact boundary checkpoint

This WP-2026-003 slice implements the three artifact shapes already specified by the
[fixture-generation protocol](../architecture/fixture-generation.md): uniqueness receipt,
fixture manifest and fixture registry. It adds no dependency and does not generate a showcase.

## Schemas and decoders

`@verified-sudoku/contracts` exports `uniquenessReceiptV1Schema`, `fixtureManifestV1Schema` and
`fixtureRegistryV1Schema`, with corresponding inferred V1 types. Objects reject unknown fields;
literal versions, generator/ruleset identifiers, paths, topology, bounds and collection sizes
match the protocol. Each reference has its exact role-specific path. Transform records contain
fourteen recognized IDs; local semantic decoding also requires the documented order.

`@verified-sudoku/boundary-codecs` exports:

- `decodeUnverifiedUniquenessReceipt(text, puzzleContext)`: requires a trusted decoded 9x9 puzzle
  context and a matching puzzle fingerprint. It does not run the exact solver.
- `decodeUnverifiedFixtureManifest(text)`: checks seed/attempt agreement, the technique-count sum,
  nonzero required locked/pair counts, early-step bounds/distinctness and ordered transform IDs.
  It does not open referenced files or establish that any claimed technique occurred.
- `decodeUnverifiedFixtureRegistry(text)`: checks the single exact manifest reference. It never
  follows the path or validates its claimed file hash.

All successes contain `{verification:"unverified",dto}` and are deeply frozen. Failures use the
existing bounded error codes without exposing payloads. None of these decoders constructs a
verified puzzle, proof, accepted fixture, release or collision-clearance capability.

Unlike general board wire messages, artifact files must already have their exact canonical bytes:
ASCII JSON with sorted keys, canonical integer/string spelling, no BOM and no final newline.
Decoders reject whitespace/reordered keys/alternative escapes rather than rewriting a file whose
hash was recorded elsewhere. Byte/depth limits are receipt 1 KiB/2, manifest 32 KiB/5 and registry
1 KiB/3, with root depth zero. The existing JSON preflight rejects duplicate keys before parsing.

## Evidence and claim limits

`npm run test:contracts` checks thirteen JSON Schema snapshots, declaration/export snapshots,
the existing board/proof examples and the new
[fixture compatibility claims](examples/fixture-artifacts-v1.json). The latter are test data with
placeholder references and intentionally unverified claims, not files for `fixtures/` or an
accepted showcase. Their original formula-based puzzle has multiple solutions; accepting its
receipt only as unverified demonstrates the authority boundary. The example collection wrapper
and its final newline belong to the test snapshot, not any artifact wire format.

Nine additional tests cover required/unknown fields, canonical bytes, byte/depth ceilings,
version rejection, trusted context binding, seed/count/order mismatches, path constraints and
claim limitations. Packed Node and Angular/Chromium consumers exercise all three decoders and
must preserve unverified results. Versions remain `0.0.0`; existing wire schemas and proof
semantics are unchanged.

Actual acceptance still requires artifact regeneration, referenced-byte/source hashes, the
independent uniqueness check below, full proof-path verification, earliest qualifying attempt
evidence, transform checks and private aggregate collision/conformance evidence. `fixtures:check` remains unfinished and cannot
be replaced with these decoder tests. No private data or source was accessed.

This slice originally branched from main after PR #10 independently of transform PR #11.
PRs #11 and #12 are now integrated with both work-package checkpoints preserved and the combined
package snapshot regenerated and verified. Passing either original branch alone was not evidence
for that combined head; the work package records the separate integration validation.

## Independent uniqueness check

The subsequent WP-2026-003 tooling slice exports
`checkUniquenessReceipt(puzzleText, receiptText)` from the unpublished testing workspace. Both inputs
must be JSON text in canonical artifact form, not caller-created objects. Existing exact decoders
validate the puzzle and receipt, their 16 KiB/6 and 1 KiB/2 bounds, the 9x9 topology and matching
puzzle fingerprint. This public-fixture entry point requires generated provenance. It then
reconstructs the 81-cell grid from givens alone and reruns the separate exact solver, capped at
two solutions. Zero or multiple solutions reject even when both files have valid hashes.

The immutable result is either `{ok:false,code}` using existing bounded decode codes, or
`{ok:true,value:{scope:"uniqueness-only",puzzleFingerprint,solverVersion:"1.0.0",solutionCount:1}}`.
`UniquenessCheck` names this internal result type. Receipt mismatches retain `reference`, altered
puzzle hashes retain `fingerprint`, noncanonical bytes fail `syntax`, and a false uniqueness claim
or host-catalog provenance fails `semantic`. No solution, input board, exception detail or solver
search state appears in the result. It is ordinary scoped evidence, not a proof/fixture capability.

The function does not change the unverified codec APIs, generate files, follow paths, compare file
hashes, verify generator provenance, enforce showcase clue/technique filters or prove a deduction.
A complete grid can pass uniqueness while failing the showcase's clue-count rule. Changing the
claimed seed cannot change uniqueness, and this check does not certify that seed. No branded
verified puzzle is introduced. The remaining fixture and private gates still apply before any
showcase or proof acceptance; `fixtures:check` remains unfinished.

This synchronous exact search is offline fixture tooling, not a UI/request-path API. It retains
the existing solver algorithm and has no wall-clock deadline guarantee. The testing workspace is
unpublished and is not part of the five packed runtime packages. Build with
`npm run test:fixture-tools`; its built entrypoint is `packages/testing/dist/index.js`.

Four tests check generated/formula-based unique cases against an independent exact-cover oracle,
zero/multiple cases whose receipts pass unverified decoding, canonical/size/schema failures,
6x6 and host rejection, hash/reference tampering, immutable minimal output and honest provenance
limits. They run within `npm run test:fixture-tools` and root verification. No wire schemas,
solver version, package versions, dependencies or runtime package snapshots change.
