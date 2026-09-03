# Agent guidance

This repository is designed to be continued without prior chat history.

Before changing files:

1. Read [docs/README.md](docs/README.md), the active entry in
   [docs/work-packages/](docs/work-packages/), and every ADR or contract it links.
2. Read [docs/change-matrix.md](docs/change-matrix.md) and the closest scoped `AGENTS.md`.
3. Work in a dedicated worktree on a `codex/<short-topic>` branch. Keep the primary `main`
   checkout read-only.

Core invariants:

- Deterministic proof is the sole authority for Sudoku facts.
- Treat all model output as untrusted until schema and semantic validation pass.
- Dependencies point inward according to [config/architecture.json](config/architecture.json).
- Never commit credentials, private repository material, user data, raw production traces,
  private chain-of-thought, or complete assistant chat transcripts.
- Update source documentation, tests, generated registries, and evidence in the same change.
- Run `npm run verify`; stop at an open pull request unless merge or publication is explicitly
  authorized.

Detailed process belongs in [docs/runbooks/agent-workflow.md](docs/runbooks/agent-workflow.md).
Skills under `.agents/skills/` are concise entry points to those canonical runbooks.
