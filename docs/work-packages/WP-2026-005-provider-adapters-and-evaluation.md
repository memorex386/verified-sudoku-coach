---
id: WP-2026-005
title: Provider adapters and evaluation
status: Draft
depends_on: WP-2026-004
owner: Maintainer
base_branch: main
accepted_plan: VSC-PLAN-2026-09-04.2
data_classification: Public
acceptance: VSC-ARCH-004, VSC-AI-003, VSC-EVAL-001
updated: 2026-09-04
---

# Provider adapters and evaluation

## Goal

Implement the provider-adapter conformance boundary, first Node-only OpenAI Responses adapter,
public prompts/model registry, loopback BYOK gateway, frozen/adversarial/comparative evaluation CLI,
and privacy-safe aggregate reporting.

## User value

Reviewers can see how an untrusted probabilistic service is constrained, measured, and replaced
without changing Sudoku truth or exposing a credential to the browser.

## Non-goals

No browser key, automatic retry, production credential, production trace, Firebase deployment,
reviewer exposure, hidden prompt, raw public response artifact, or unapproved runtime bundle.

## Governing ADRs

ADR-0003, ADR-0004, ADR-0006, and ADR-0007; runtime-AI, adapter, and evaluation runbooks; privacy
policy; threat model; model/data card.

## Allowed edit surface

Provider adapter packages (initially `packages/adapter-openai`), `apps/local-gateway`,
`tools/eval-cli`, relevant contract/codecs and testing fixtures, public runtime/provider manifests,
aggregate report generator, and affected docs, tests, CI, and evidence.

## Affected interfaces

`ObserverModelPort`, `TeacherModelPort`, adapter conformance, provider error mapping,
observer/teacher strict schemas, model registry states, provider-profile identity, exact native
settings, prompt/schema/model profile hashes, eval case/report schemas, and guarded CLI.

## Architecture and privacy invariants

Provider responses are syntax- and semantics-untrusted. Requests contain only minimal verified
packets with no identity or unrelated trace; disabled request storage, finite output bounds, and no
automatic retry are explicit common policy. The OpenAI mapping additionally requires exact
`store:false`. Browser workspaces cannot reach any provider package. Live mode requires current spend
confirmation and never uploads raw outputs. The BYOK gateway binds only numeric loopback, requires
exact Host/Origin allowlists plus a per-launch capability, has no wildcard CORS, and bounds every
route, model, body, output, and cadence before invoking a provider.

## Acceptance criteria

Implement the shared fake/reference adapter conformance suite and register candidate GPT-5.6 Luna
observer and GPT-5.6 Terra teacher profiles through the OpenAI adapter; composition accepts only
approved bundles. Alternate providers remain evaluation-only and require their own package,
data-handling review, conformance, and comparative evidence. Frozen/adversarial suites cover
malformed, hallucinated, unknown, stale, refusal, timeout, quota, and provider failures.
Comparative reports synchronize every behavior version.
Gateway tests prove hostile Origin/Host, DNS-rebinding names, missing/wrong capability, unsupported
routes/models, and oversized bodies produce zero provider calls.

## Validation

These names and arguments are the decision-complete planned credential-free validation contract.
During implementation, make them executable and CI-wire them before `Done`:

```powershell
npm run test:adapter-openai
npm run test:adapter-conformance
npm run test:gateway
npm run test:eval-cli
npm run build:gateway
npm run runtime-ai:check
npm run eval:replay
npm run eval:adversarial
npm run eval:compare
npm run verify
```

Before this package reaches `Done`, `eval:replay` must replace the zero-case bootstrap with the
credential-free frozen runner required by VSC-EVAL-001; `not_implemented` is not passing evidence.

They cover shared and OpenAI adapter conformance, packet minimization, strict parsing/semantic rejection,
error redaction, runtime-manifest coupling, hostile local-gateway requests, spend-guard refusal,
browser reachability, and full outcome accounting. `eval:live` remains a separate manual command
that must refuse to call a provider without an explicit current confirmation and numeric spend cap;
it is never part of ordinary CI.

## Delivery evidence

No implementation evidence exists because this package has not started.

## Known limitations and blockers

WP-2026-004 is incomplete. No provider credential is available or required for implementation and
frozen evaluation; live quality, latency, token, and cost claims remain unmeasured. Structural
conformance will not by itself support a named-provider quality claim.

## Next action

- Define the candidate model-profile and evaluation-report schemas against the approved ports while dependencies remain unfinished.

## Checkpoints

Implementation has not begun; append dated checkpoints only after the package becomes In progress.
