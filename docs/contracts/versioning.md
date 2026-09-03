# Contract and behavior versioning

## Contract families

The first implementation will define runtime schemas for puzzle definitions, board snapshots,
proof steps/paths, board actions, coach observations, observer decisions, teacher plans, validator
results, replay records, and aggregate evaluation reports. Names and fields become authoritative
only when WP-2026-002 lands.

Every serialized value must:

- Carry a literal schema identifier and positive integer version.
- Reject unknown keys, invalid enums, non-finite numbers, and out-of-range collections.
- Be validated at runtime before entering a trusted layer.
- Define size/depth bounds and distinguish absent values from explicit nulls.
- Have positive, boundary, malformed, forward-incompatible, and round-trip tests.

Internal domain types are not wire contracts. Mapping between contracts and domain values belongs
at the application boundary.

## Compatibility policy

- Before the first public release, packages remain `0.0.0` and no compatibility is promised.
- A released additive optional field requires a contract-version review; “optional” does not make a
  semantic change automatically compatible.
- Removing, renaming, narrowing, reinterpreting, or changing defaults is breaking and requires a new
  major contract version plus explicit migration or parallel support.
- Readers reject unsupported future major versions. They never guess or silently coerce.
- A private host pins an exact public tag/commit and lockfile integrity and records every contract
  version it accepts.

## Runtime AI behavior identity

A model behavior is identified by more than a model name. The manifest in
[`ai/runtime-manifest.json`](../../ai/runtime-manifest.json) records the prompt source/hash, request
schema/hash, requested model, inference settings, output bound, storage choice, evaluator version,
and visible failure/recovery policy. Live reports additionally record the returned model identifier
and returned service tier.

Inference settings are inline, exact-key manifest data rather than an undocumented provider
default. They bind reasoning effort, strict structured-output mode, service tier, absence of tools,
and the deliberate sampling-parameter policy. A caller cannot add or override a setting outside the
approved registration.

A change to any of these values is behavior-changing even when TypeScript does not change. Follow
the [runtime-AI change runbook](../runbooks/change-runtime-ai.md); compare against the prior frozen
suite before approval.

## Release identity

Release evidence binds the Git commit, dependency lock, package versions, contracts, runtime-AI
manifest, fixture/eval suite, aggregate result, static demo bundle, SBOM, and CI run. A Markdown
summary is generated from machine-readable evidence rather than maintained as a second authority.
