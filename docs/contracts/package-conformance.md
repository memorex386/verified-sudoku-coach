# Packed consumer conformance

`npm run pack:smoke` builds and checks the five-package dependency closure of the implemented
domain and boundary codecs: domain, contracts, proof-engine, coach-core, and boundary-codecs.
The proof-engine and coach-core packages retain their empty implementation surfaces and supply
no technique or coaching behavior. Their manifests are sealed
so an installed boundary-codecs dependency tree resolves compiled root entrypoints.

The command runs in the root verifier on Windows and Ubuntu. It:

- Packs twice with lifecycle scripts disabled, compares actual tarball bytes, and independently
  recomputes npm's SHA-512 integrity. Archive entries must be regular, uniquely named files from
  the explicit distribution allowlist; source maps, source files, build metadata, private key
  patterns, local paths, provider/framework references and Node-only imports are rejected.
- Installs actual tarballs in two temporary consumers using offline `npm ci --ignore-scripts`.
  Consumer locks reuse exact external records from the reviewed root lock and replace workspace
  links with the tarballs' independently checked integrity. Every installed library file must
  match the archive; workspace symlinks are rejected.
- Loads roots through Node 22 CommonJS `require(esm)` and ESM import, and rejects deep imports
  through both loaders. This does not promise a separately emitted CommonJS build or Node 20.
- Compiles a standalone Angular component with strict AOT/template checking against packed
  declarations, bundles it for the browser, and executes it in Playwright's pinned Chromium.
  Only its temporary loopback page and bundle are allowed browser requests. This is a test
  consumer, not product integration or a deployed application.
- Compares Node and Chromium results for original empty 6x6/9x9 states, note-independent initial
  candidates, fixed fingerprint vectors, canonical bytes, codec round trips, malformed input,
  and explicitly unverified proof framing. Native Node SHA-256 independently checks the hash
  vectors. The existing deliberately false contract deduction remains unverified.

[The checked snapshot](package-conformance-v1.json) binds package bytes, file/declaration hashes,
export names, tool versions and consumer results. TypeScript emits LF explicitly to keep bytes
portable. The existing domain and board/proof API snapshots remain separate required gates.
To deliberately refresh after reviewing changes, run `npm run pack:smoke -- --write`; ordinary
verification rejects drift and never updates evidence automatically.

The root lock pins Angular 21.2.22, compatible with the repository's TypeScript 5.9.2 and Node 22
toolchain. Angular and browser tooling are development dependencies and never enter the core
package graph or library archives. Initial verification may download the pinned Chromium runtime
and, on Linux, install its OS dependencies. Subsequent runs use that local revision; the actual
browser version must match Playwright's locked browser manifest. External package installation
inside the consumers is offline, using the cache populated by the root dependency installation.

This snapshot covers the currently implemented library surfaces. It does not establish technique
soundness, verified elimination replay, fixture uniqueness, difficulty, private-corpus parity,
coaching behavior, or release readiness. Those WP-2026-003 and later gates remain open. No package
is published by this command, and versions remain `0.0.0`.
