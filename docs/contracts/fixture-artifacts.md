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

Actual acceptance still requires artifact regeneration, referenced-byte/source hashes, exact-solver
reruns, full proof-path verification, earliest qualifying attempt evidence, transform checks and
private aggregate collision/conformance evidence. `fixtures:check` remains unfinished and cannot
be replaced with these decoder tests. No private data or source was accessed.

This slice is based on main after PR #10 and is independent of the open transform PR #11.
Integrating both must preserve both work-package checkpoints and regenerate/check the combined
package snapshot; passing either branch alone is not evidence for an untested combined head.
