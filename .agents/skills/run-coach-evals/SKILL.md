---
name: run-coach-evals
description: Run and interpret Verified Sudoku Coach frozen or live evaluations with versioned inputs, complete outcome accounting, and privacy-safe aggregate reports.
---

# Run coach evaluations

Read the [evaluation runbook](../../../docs/runbooks/run-evaluations.md) and
[data card](../../../docs/evaluation/data-card.md). Use credential-free replay unless the user
explicitly authorizes a bounded live run. Confirm the active work package permits the run and names
its exact command, then confirm source,
contract, prompt, model-request, scorer, fixture, suite, and threshold versions before comparing.

Account for every case and subgroup, including reject, refusal, timeout, provider error, stale
result, and exclusion. Keep live request/response artifacts local and ignored; commit only reviewed
aggregate JSON and its generated summary. Follow the
[eval-failure playbook](../../../docs/playbooks/eval-failure.md) for regressions. Evaluation never
authorizes release or a stronger product claim than the recorded evidence.
