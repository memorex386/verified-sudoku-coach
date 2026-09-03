---
name: change-coach-model
description: Change a coach prompt, model profile, provider, schema, validator, renderer, or inference setting with synchronized version manifests and before/after evaluation evidence.
---

# Change the coach model boundary

Follow the [runtime-AI change runbook](../../../docs/runbooks/change-runtime-ai.md) and
[evaluation policy](../../../docs/evaluation/policy.md). Bind the change to a work package; version
the prompt, schema, model profile, and behavior identity together; update failed-boundary fixtures.

Proceed only when the package is `Ready` or `In progress`, its dependencies are `Done`, and every
required product, privacy, threshold, and spend decision is recorded. Otherwise stop and update the
governing package or request the human decision.

Run credential-free frozen comparison first. A live run requires explicit current spend
authorization, protected credentials, and aggregate-only output. Never render schema-valid output
before semantic proof/reference verification, weaken a gate after seeing results, publish raw
responses, or treat evaluation authorization as release authorization.
