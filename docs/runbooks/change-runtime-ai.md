# Change runtime AI behavior

This runbook applies to a product prompt, requested model, inference setting, output schema,
semantic validator, renderer rule, visible failure/recovery policy, provider adapter, or eval scorer. No runtime route is
implemented in WP-2026-001.

Before editing or running an evaluation, follow the [agent workflow](agent-workflow.md). The
governing work package must be `Ready` to start or `In progress` to resume, every dependency must be
`Done`, and all required product, privacy, threshold, spend, and release decisions must be recorded.
Otherwise stop and refine authority or request the missing human decision.

## Required change record

1. Link the governing work package and state the behavior hypothesis and non-goals.
2. Update the public prompt source when applicable and increment its version.
3. Update the exact runtime schema/contract version when semantics or compatibility change.
4. Register the provider-profile ID/digest, prompt/schema hashes, requested model, exact native
   settings, output bound, `requestStorage:"disabled"`, `automaticRetry:false`, visible failure
   policy, and eval-suite version in `ai/runtime-manifest.json`.
5. Add or update positive, malformed, adversarial, stale, refusal, timeout, and budget fixtures.
6. Run credential-free replay and compare the full frozen suite against the accepted baseline.
7. With explicit authorization and protected credentials, run the live suite. Keep raw output in
   the ignored private artifact directory and generate only sanitized aggregate evidence.
8. Report every case, subgroup, reject, error, latency bucket, token, cost, exclusion, and limitation.

The minimum credential-free verification is:

```powershell
npm run eval:replay
npm run runtime-ai:check
npm run verify
```

The active work package must name any additional exact commands before it becomes `Ready`.

An unregistered combination must fail before inference. A schema-valid but unsupported plan remains
a failure. Do not weaken gates, remove failed cases, or change thresholds after reading results
without a dated amendment and explicit review.

Adding or changing a provider first follows the
[agent/provider adapter runbook](add-agent-or-provider-adapter.md). The reviewer cohort never
silently changes registration: alternate providers remain evaluation-only until a new human
acceptance freezes the complete behavior identity.

Runtime evaluation does not authorize production integration or provider spend beyond the approved
run. Follow the [evaluation runbook](run-evaluations.md) and [eval-failure playbook](../playbooks/eval-failure.md).
