# Core package guidance

Read [architecture principles](../docs/architecture/principles.md),
[contract versioning](../docs/contracts/versioning.md), and the relevant work package before edits.
Package dependencies must match `config/architecture.json`; framework, provider, persistence, and
network concerns never enter `domain`, `proof-engine`, or `coach-core`; wire schemas never import
domain values. Production code belongs under `src/`; package-local tests belong under `test/` so
they may use declared test-only tooling without weakening production dependency checks. Add tests
at the lowest layer that owns the behavior and run `npm run architecture:check` plus
`npm run typecheck`.
