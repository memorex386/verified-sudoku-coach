# Agent workflow

The durable loop is:

```text
read authority -> select ready work package -> isolated branch/worktree -> focused change
-> local verification -> evidence-backed pull request -> human review
```

## Before editing

1. Read root and nearest `AGENTS.md`, [documentation authority](../README.md), the selected work
   package, and its linked ADRs/contracts.
2. Confirm every dependency is `Done`, the package is `Ready` to start or `In progress` to resume,
   and its acceptance criteria are decision-complete. If not, refine the work package rather than
   guessing.
3. Read the [change matrix](../change-matrix.md) and identify companion work.
4. From the read-only primary checkout, fetch and create a dedicated sibling worktree on a
   `codex/<short-topic>` branch. Never share a writing worktree between agents.

`Ready` means command names, arguments, and evidence expectations are decided; a planned command
does not need to exist before its implementing package starts. Implementation makes those commands
executable and CI-wired before `Done`.

Repository bootstrap is the sole exception: the empty repository received a minimal `main` commit,
then the initial clone became the isolated `codex/coach-foundation` checkout. Before the foundation
commit, a sibling `main` worktree was created and left read-only. This one-time ordering is recorded
as foundation evidence and is not a precedent for later work.

## During work

- Keep each writer in one worktree and coordinate ports, credentials, and live services separately.
- Treat model/code-agent output as untrusted. Inspect changes and validate observable behavior.
- Make the smallest change that completes the selected package; unrelated cleanup receives another
  package or issue.
- Record decisions in the appropriate ADR or contract, not chat transcripts or private reasoning.
- Never use production/user data as a fixture.

## Handoff

Before handing work to another agent or opening a PR, follow the
[agent-handoff runbook](agent-handoff.md) and update the work package with status, exact
commands/results, completed commit or PR when known, remaining limitations/blockers, and one next
unblocked action. Regenerate its registry. The receiver should need only repository state and the
work-package ID.

## Definition of done

- Acceptance gates have actual evidence, not unchecked intention.
- `npm run verify` passes from the task branch.
- Generated registries and manifests are current.
- The PR template is complete, including AI assistance, privacy/provenance, validation, and limits.
- The change is explicitly accepted, merged, and linked before a work package becomes `Done`.

Transition to `Done` in a follow-up evidence PR after the delivery PR is integrated. Link the exact
repository PR or published GitHub Release and cite its full SHA. The verifier queries GitHub for a
merged PR or published release, resolves the public pull/tag ref, requires that SHA to touch the
work-package record, and requires it to be an ancestor of `main`; unavailable or ambiguous remote
evidence fails closed. Use a merge or fast-forward strategy that preserves the delivery PR head; a
squash-only delivery cannot satisfy this audit contract without a published release tag on the
integrated commit.

Stop at the PR unless the current request explicitly authorizes merge, provider spend, beta
exposure, deployment, or publication. These are separate actions.
