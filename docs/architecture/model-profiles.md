# Candidate model profiles

These are design inputs for WP-2026-005, not approved runtime registrations. The authoritative
runtime registry remains `ai/runtime-manifest.json`, which is empty during foundation work, and
`config/provider-policy.json` owns provider capability and security boundaries.

## Provider-neutral requirements

Every profile binds a registered provider-profile ID and digest, a Node-only adapter, requested
model, role, exact native settings, prompt/schema/renderer/proof/evaluation identities, positive
output and host-deadline bounds, `requestStorage:"disabled"`, `automaticRetry:false`, and
`failurePolicy:"visible-pause"`. The adapter must expose structured output, cancellation/deadline,
usage, refusal, quota, and redacted failure behavior through the stable observer/teacher ports.
Unknown fields, unsupported capabilities, missing storage controls, or unregistered substitutions
fail before inference.

These are application requirements, not a promise that provider APIs use the same field names.
Provider-native settings stay exact and digest-bound inside a registration. The adapter conformance
suite proves their mapping; it never asks one provider to imitate another provider's wire format.

## Initial OpenAI reference profiles

| Role | Candidate request | Native reasoning | Purpose | Output ceiling | Host deadline |
| --- | --- | --- | --- | --- | --- |
| Observer | `gpt-5.6-luna` | `low` | Inexpensive frequent choice among silence or registered opportunities | 256 tokens | 5,000 ms |
| Teacher | `gpt-5.6-terra` | `medium` | Arrange one selected verified proof into a bounded teaching plan | 768 tokens | 10,000 ms |

The initial adapter uses the OpenAI Responses API with strict structured output, exact
`store:false`, no tools, no automatic retry, and a finite host deadline. Its native settings also
bind service-tier and deliberate sampling-parameter policy. The adapter records the requested and
returned model identifiers, relevant requested/returned provider metadata, versions, latency,
token usage, outcome, and estimated cost without logging payload content.

OpenAI is the first reference implementation, not the application contract. Anthropic, Google, or
local/open-weight profiles remain candidate/evaluation-only until a separately reviewed adapter
passes conformance, adversarial, comparative, data-handling, and live gates. An open-weight profile
also binds model-weight digest, quantization, inference server, prompt template, and relevant
hardware/runtime identity. API-shape compatibility alone is insufficient.

Player-visible facts render deterministically. Model-written transition prose is a separate
owner-alpha candidate: it cannot contain digits, cells, candidates, technique names, or factual
claims, and it cannot reach reviewers until it clears the same correctness and comparative gates.

Registry status is exactly `candidate`, `approved`, or `retired`; runtime composition accepts only
`approved`. The reviewer cohort freezes one approved registration for each role. A provider outage,
alias, or returned model never silently substitutes another bundle.

Model capabilities and data handling are external dependencies that must be rechecked before a live
run. Current OpenAI design sources are the official [GPT model catalog](https://developers.openai.com/api/docs/models/gpt),
[GPT-5.6 Luna model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna),
[GPT-5.6 Terra model page](https://developers.openai.com/api/docs/models/gpt-5.6-terra),
[Responses API create reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create),
[Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs), and
[API data controls](https://developers.openai.com/api/docs/guides/your-data).
