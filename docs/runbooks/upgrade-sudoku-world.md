# Upgrade Sudoku World

This public runbook records the compatibility protocol; private implementation details remain in
Sudoku World.

1. Select one immutable public release. Verify its tag, commit, `.tgz` SHA-256 values, provenance,
   and lockfile integrity before installation.
2. Pin the browser-safe artifact in Angular and the Node artifact in Functions. Both hosts must
   report the same ruleset, contract, renderer, fixture, and core release versions.
3. Run public package smoke fixtures in Angular ESM and Node CommonJS, then private anti-corruption,
   legacy-hint characterization, emulator, auth, isolation, budget, retention, and deletion suites.
4. Record compatibility as version/hash evidence only. Never copy public source into a private fork
   or publish private puzzles, traces, credentials, configuration, or source as evidence.
5. Open reviewable public/private PRs. Merge, deployment, production spend, and exposure each need
   their own explicit authorization.
