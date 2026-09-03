# Runtime AI manifest contract

`ai/runtime-manifest.json` is the only registry of runnable model behavior. During foundation work
it contains no registrations. WP-2026-004 introduces entries with exact keys; unknown or missing
keys fail CI.

Each entry binds:

- Stable registration ID, role (`observer` or `teacher`), and status (`candidate`, `approved`, or
  `retired`). Runtime composition accepts only `approved`.
- Provider, requested model, model-profile version, exact inference settings, and complete
  runtime-behavior version.
- Prompt path/version/SHA-256 and strict output-schema path/version/SHA-256.
- Renderer-manifest and proof-policy path/version/SHA-256 triples.
- Evaluation-suite-manifest path/version/SHA-256 plus aggregate comparative-report path/SHA-256.
- Positive finite output-token and timeout bounds, with observer output capped at 256 tokens and
  teacher output capped at 768; `store:false`, `automaticRetry:false`, and
  `failurePolicy:"visible-pause"`.

Registration IDs are lowercase kebab-case. Component and complete behavior versions are SemVer
strings such as `1.0.0`; booleans, arrays, objects, and bare integers are rejected as versions.
Artifact paths are normalized repository-relative paths in these canonical locations:

| Artifact | Canonical path |
| --- | --- |
| Product prompt | `ai/prompts/*.md` |
| Strict output schema | `packages/contracts/schemas/*.json` |
| Renderer manifest | `packages/coach-core/renderers/*.json` |
| Proof-policy manifest | `packages/proof-engine/policies/*.json` |
| Evaluation-suite manifest | `tools/eval-cli/suites/*.json` |
| Aggregate comparative report | `docs/evaluation/reports/*.json` |

Approved registrations supply the prompt/model-profile portions of the canonical
[`BehaviorIdentityV1`](catalog.md#canonical-behavior-identity). Composition also supplies the
ruleset, schema, renderer, fixture, and evaluation-suite versions; replay/trace encoding fails if
any of the seven values is absent or if an event's identity hash differs from its trace envelope.

The initial profile policy requests `gpt-5.6-luna` for observer and `gpt-5.6-terra` for teacher.
Changing either requires the runtime-AI runbook, synchronized comparative evidence, and an accepted
policy/ADR change; changing a provider response at runtime does not authorize substitution.

Existing registration IDs are append-only and may only advance `candidate -> approved -> retired`
(with direct candidate retirement also allowed). A behavior-bearing field change must increment the
complete behavior version and its component version and must bind a changed comparative-report
hash. CI compares the registry with its base revision so updating hashes alone cannot bypass that
coupling.

Hashes use normalized UTF-8 text as read by the repository verifier. Live reports additionally
record the provider-returned model ID, provider-returned service tier, and complete outcome
accounting, but raw requests/responses never enter the manifest or public report.
