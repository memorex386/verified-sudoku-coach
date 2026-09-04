---
name: work-on-coach
description: Start or resume one authorized Verified Sudoku Coach work package, isolate its Git state, validate its declared acceptance evidence, update its durable handoff, and open a review-ready pull request.
---

# Work on Verified Sudoku Coach

Read the selected work package, its dependencies, linked acceptance gates, and the
[agent workflow](../../../docs/runbooks/agent-workflow.md). A `Ready` package may start and an
`In progress` package may resume. Stop implementation for every other status, an incomplete
dependency, or an absent required human decision; repair project authority instead of guessing.

Use a dedicated worktree and `work/<work-package-id>-<short-topic>` branch. Follow the
[change matrix](../../../docs/change-matrix.md), remain inside the allowed edit surface, and record
decisions in contracts or ADRs rather than conversations. Run every package validation plus
`npm run verify`. Append evidence and exactly one next action, regenerate the registry, complete the
PR template, and stop at the PR unless merge, spend, deployment, or publication is explicitly
authorized.
