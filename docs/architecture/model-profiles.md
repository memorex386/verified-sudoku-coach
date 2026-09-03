# Candidate model profiles

These are design inputs for WP-2026-004, not approved runtime registrations. The authoritative
runtime registry remains `ai/runtime-manifest.json`, which is empty during foundation work.

| Role | Candidate request | Reasoning effort | Purpose | Output ceiling | Host deadline |
| --- | --- | --- | --- | --- | --- |
| Observer | `gpt-5.6-luna` | `low` | Inexpensive frequent choice among silence or registered opportunities | 256 tokens | 5,000 ms |
| Teacher | `gpt-5.6-terra` | `medium` | Arrange one selected verified proof into a bounded teaching plan | 768 tokens | 10,000 ms |

Both profiles use the Responses API with strict structured output, `store:false`, no automatic
retry, and a finite host deadline. The adapter records the requested and returned model identifiers,
requested and returned service tiers, versions, latency, token usage, outcome, and estimated cost
without logging payload content. Model
selection becomes `approved` only after frozen, adversarial, comparative, and separately authorized
live evaluation meets the accepted gates.

Each registration carries an exact `inferenceSettings` object. Its five required keys are
`reasoningEffort`, `structuredOutputMode: strict-json-schema`, `serviceTier: auto`,
`toolPolicy: none`, and `samplingPolicy: provider-default-no-parameters`; unknown keys fail
validation. The sampling value means temperature and top-p are deliberately omitted, not silently
accepted from an ad hoc caller. Changing any value is a model-profile change and requires a new
version plus comparative evaluation.

Player-visible facts render deterministically. Model-written transition prose is a separate
owner-alpha candidate: it cannot contain digits, cells, candidates, technique names, or factual
claims, and it cannot reach reviewers until it clears the same correctness and comparative gates.

Registry status is exactly `candidate`, `approved`, or `retired`; runtime composition accepts only
`approved`. A model alias or provider response never silently substitutes for the requested bundle.

Model capabilities and data handling are external dependencies that must be rechecked before a live
run. Current design sources are the official [GPT model catalog](https://developers.openai.com/api/docs/models/gpt),
[GPT-5.6 Luna model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna),
[GPT-5.6 Terra model page](https://developers.openai.com/api/docs/models/gpt-5.6-terra),
[Responses API create reference](https://developers.openai.com/api/reference/cli/resources/responses/methods/create),
[Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs), and
[API data controls](https://developers.openai.com/api/docs/guides/your-data).
