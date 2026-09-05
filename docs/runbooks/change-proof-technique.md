# Change a proof technique

This runbook governs any detector, verifier, application rule, or canonical ordering change.

1. Follow the [agent workflow](agent-workflow.md). Bind the work to a `Ready` package to start or an
   `In progress` package to resume, require every dependency to be `Done`, and use an accepted
   ruleset version. Write the deduction as explicit preconditions, conclusions, and tie-breaks
   before code.
2. Keep proposal and authority separate: a detector returns a candidate proof; an independently
   callable verifier recomputes all premises from the immutable board. Only a branded verified
   proof may be applied.
3. Add generated positive and near-miss examples, then tamper every proof field. Cover stale board,
   empty/no-op elimination, transformation invariance, path replay, and deterministic ordering.
4. Regenerate the public fixture from its seed. The accepted
   [local tutor amendment](../product/plans/VSC-PLAN-2026-09-05.3.md) allows only its isolated
   naked/hidden-single milestone to proceed using generated proof tests before private conformance.
   For private integration or full-engine/showcase acceptance, run the private corpus only through the exact
   aggregate conformance command recorded in the active private work package; if that command is
   absent, stop and refine the package. Never copy puzzle rows or private source here.
5. Treat any frozen-baseline change as a ruleset/version decision, including a higher solve count.
   Update contracts, manifests, evals, compatibility notes, and evidence together.

The technique is not accepted until its tests prove both sound conclusions and rejection of
plausible near misses.
