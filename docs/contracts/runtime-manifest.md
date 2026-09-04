# Runtime AI manifest contract

`ai/runtime-manifest.json` is the only registry of runnable model behavior. During foundation work
it contains no registrations. WP-2026-005 introduces entries with exact keys; unknown or missing
keys fail CI.

Each entry binds:

- Stable registration ID, role (`observer` or `teacher`), and status (`candidate`, `approved`, or
  `retired`). Runtime composition accepts only `approved`.
- Registered provider-profile ID and SHA-256, requested model, model-profile version, exact
  provider-request settings, and complete runtime-behavior version.
- Prompt path/version/SHA-256 and strict output-schema path/version/SHA-256.
- Renderer-manifest and proof-policy path/version/SHA-256 triples.
- Evaluation-suite-manifest path/version/SHA-256 plus aggregate comparative-report path/SHA-256.
- Positive finite output-token and timeout bounds, with observer output capped at 256 tokens and
  teacher output capped at 768; top-level `responseStoragePolicy:"request-not-to-store"`,
  `automaticRetry:false`, and `failurePolicy:"visible-pause"`.

`config/provider-policy.json` is the sole provider security and capability registry. A profile
identifies its Node-only adapter, provider protocol/version, allowed roles and requested models,
capabilities, data-handling claims that require revalidation, exact provider-settings shape, and
browser-forbidden SDK specifiers, credential names, and endpoint hosts. Runtime registrations
reference a profile and its digest; they do not copy or reinterpret that policy. The provider
adapter must prove how the neutral response-storage policy maps to its native request. For the
planned OpenAI adapter this includes exact `store:false`, which disables later API retrieval of the
generated response but is not a Zero Data Retention claim. Abuse-monitoring policy and private-host
retention-control verification are separate profile fields. Another provider must declare and
verify its own behavior or remain ineligible for live use.

Profile and policy digests are computed from canonical JSON and checked against the base revision.
The profile digest excludes only `runtimeAdmission`, so promotion/retirement changes policy
admission without pretending the evaluated request behavior changed; the containing policy digest
still changes. Any substantive profile change increments its SemVer and changes the runtime-bound
digest. Profiles are append-only and follow the accepted boundary-only/candidate/approved/retired
transition graph.

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
any of the nine values is absent or if an event's identity hash differs from its trace envelope.

WP-2026-005 plans candidate registrations requesting `gpt-5.6-luna` for observer and
`gpt-5.6-terra` for teacher through the OpenAI Responses adapter. The current profile marks those
hosted routes mutable and therefore not cohort-approvable. Changing a provider profile, adapter,
requested model, or native setting requires the runtime-AI runbook, synchronized comparative
evidence, and an accepted policy/ADR change; a provider response or outage never authorizes
substitution. The reviewer cohort requires one immutable approved registration per role. Alternate
providers remain evaluation-only until separately accepted.

Existing registration IDs are append-only and may only advance `candidate -> approved -> retired`
(with direct candidate retirement also allowed). A behavior-bearing field change must increment the
complete behavior version and its component version and must bind a changed comparative-report
hash. CI compares the registry with its base revision so updating hashes alone cannot bypass that
coupling.

Hashes use normalized UTF-8 text as read by the repository verifier. Live reports additionally
record the real provider, adapter, requested and returned model IDs, relevant requested and
returned provider metadata, and complete outcome accounting, but raw requests/responses never
enter the manifest or public report.
