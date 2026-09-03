# Eval-failure playbook

1. Classify the outcome as runner, fixture, parse, schema, semantic proof, lesson policy, stale
   revision, refusal, timeout, provider, budget, latency, or reporting failure.
2. Confirm the case belongs to the declared suite and was not transformed across partitions.
3. Reproduce through the credential-free runner when possible. Never copy a production trace.
4. Reduce to the smallest independently generated case that preserves the failure and add it to the
   regression set with provenance.
5. Fix the owning layer: proof engine, contract, coach core, adapter, renderer, runner, or report.
6. Run the entire compatible frozen suite and report before/after counts; a local fix must not hide
   subgroup regressions.
7. If a live re-run costs money or sends data externally, stop for explicit authorization.

Do not delete a hard case, relabel a failure as an exclusion, move a threshold, or hand-edit an
aggregate report to obtain a pass. Amend the evaluation policy visibly when a premise changes.
