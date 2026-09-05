# V1 boundary codec checkpoint

This checkpoint implements the eight top-level schemas in [Sudoku and proof V1](sudoku-proof-v1.md),
plus topology/unit schemas, in `@verified-sudoku/contracts` using pinned Zod 4.5.4. Contracts have
no domain dependency. `@verified-sudoku/boundary-codecs` imports the schemas and the domain through
their package roots; no provider, framework, clock, network, or proof-engine behavior is added.

## API and trust

All `decode*` functions accept JSON text, not caller-supplied objects. They return either
`{ok:true,value}` or `{ok:false,code}`. Codes are bounded `size`, `syntax`, `shape`, `semantic`,
`reference`, `fingerprint`, `stale`, or `invalid-action`; results never contain the rejected payload
or Zod diagnostics. Successful results and nested DTOs are frozen.

- `decodePuzzle(text)` checks exact shape, topology, given consistency and the puzzle fingerprint.
  Its context contains the validated DTO and immutable domain puzzle. It does not prove uniqueness.
- `decodeBoard(text, puzzleContext)` checks identities, entries, notes, topology bounds and both
  fingerprints, then constructs a domain snapshot. Contradictory player entries remain representable.
- `decodeBehaviorIdentity(text)` returns the exact DTO and its typed hash. It does not approve a
  runtime registration or authorize a provider.
- `decodeBoardAction(text, boardContext)` checks shape, reference, staleness, and applicability in
  that order. It rejects no-ops, given mutations and revision exhaustion. It never applies the
  action, records command IDs, or supplies application-level deduplication.
- `encodePuzzle(context)` and `encodeBoard(context)` return canonical JSON of validated contexts.
  A context copied, deserialized, or fabricated by the caller fails runtime identity checks.
- `decodeUnverifiedProofStep(text, boardContext)` and `decodeUnverifiedProofPath(text, boardContext)`
  check source identity, topology-relative fields, canonical set ordering, technique/premise tags,
  conclusion forms, hash projections and path chaining. A path also binds its initial logical
  fingerprint to the source board.
- `decodeUnverifiedTrace(text)` checks Gregorian timestamps, lifecycle bounds, ordered unique event
  IDs, envelope identity and nested payload identities/hashes. It does not establish event causality.
- `decodeUnverifiedReplay(text)` checks generated provenance, identities, record sequence,
  revision/fingerprint framing, referenced boards and proof-path integrity. It does not execute
  player actions, judge rejection reasons, or prove outcome/deduction validity.

Every proof/trace/replay decoder returns `{verification:"unverified",dto}` inside its success value.
These are inert wire data for later verification, never capabilities for application, factual
rendering, or model registration. A deliberately false naked-single claim can pass wire checks;
the tests explicitly require that it remains unverified. A later proof verifier must reconstruct
and authorize every logical transition before the replay or proof is accepted. That implementation
remains blocked on the private aggregate conformance command and linked evidence.

## Transport and compatibility

The preflight reader applies the V1 byte/depth ceilings before building a JSON tree. Depth counts
the root as zero. Raw transport is ASCII (and hence valid UTF-8); decoded strings must satisfy
the contract's ASCII field rules. Legal JSON escapes, whitespace and object-key order are accepted.
Duplicate keys are rejected, including escaped spellings of the same key. Numeric tokens must
be safe integral decimal spellings: no negative zero, fractional, exponent, or leading-zero forms.
This avoids accepting a value after JavaScript rounded it. There are no defaults, coercion, array
sorting or hash repair. The prerelease V1 transport decision is recorded in the canonical contract.

Zod schemas check wire shape and local bounds only. Their
[JSON Schema snapshots](schemas/boardStateV1Schema.json) describe that structural layer, not
canonical ordering, Gregorian calendar validity, referenced topology, hashes, or proof soundness.
JSON Schema cannot distinguish JavaScript negative zero or duplicate JSON keys after parsing;
the bounded reader and semantic codecs provide those checks. Imported hostile JavaScript/proxies
are outside this JSON boundary; calling a raw schema is not equivalent to using a codec.

The three implemented packages (domain/contracts/codecs) now expose built root entrypoints for
types, ESM, and Node 22 synchronous CommonJS loading, and restrict package files to JavaScript and
declarations under `dist`. Build with `npm run typecheck` before importing. Workspace root checks
and deep-import rejection pass; packed Angular/Node consumers and pinned Chromium checks remain
separate unfinished acceptance gates. This is not a published package release.

## Evidence and regeneration

`npm run test:contracts` builds project references, checks the generated JSON Schemas,
[declaration/export hashes](board-proof-api-v1.json), and
[compatibility examples](examples/board-proof-v1.json), then runs adversarial contract tests.
After an intentional reviewed schema change, build and run
`node scripts/verify-contract-artifacts.mjs --write`; ordinary verification never regenerates.
All examples come from the original `packages/boundary-codecs/test/examples.mjs` construction,
with small partial boards and intentionally unverified claims. They are wire compatibility cases,
not uniquely solvable showcase fixtures, held-out evaluation material, or private corpus evidence.

Package versions remain `0.0.0`. No private host is upgraded in this checkpoint. Future consumers
must pin a reviewed immutable commit/release and use the codecs before constructing trusted values;
proof-bearing success values still require independent proof verification.

Packed Node and Angular/Chromium compatibility is now checked separately by
[packed consumer conformance](package-conformance.md), without expanding proof authority.

The [fixture artifact checkpoint](fixture-artifacts.md) adds three schemas and canonical-file
decoders. Their receipts, manifests and registries remain explicitly unverified until the separate
solver, artifact and proof checks run.
