# Threat model

## Assets and adversaries

Protected assets are Sudoku correctness, player trust, account access, consent state, provider
credentials, the pilot budget, private traces, and honest public evidence. Relevant threats include
malformed or prompt-injected model output, stale concurrent calls, replay/forged commands, abusive
clients, malicious repository/PR instructions, over-privileged imported agents, credential leakage,
dependency or adapter compromise, accidental private-source publication, and overstated
small-cohort claims. A hostile browser origin or DNS-rebinding page may also target the
developer's loopback BYOK gateway to spend an environment-held provider key without reading it.

## Trust boundaries and controls

| Boundary | Principal threats | Required controls |
| --- | --- | --- |
| HTTP/storage/replay to application | Unknown keys, oversized payloads, forged IDs/revisions | Strict versioned schemas, size bounds, authorization, compare-and-swap, idempotency |
| Proof detector to board mutation | Buggy or tampered deduction | Independent verifier, before/after fingerprints, branded proof, no-op rejection |
| Model to player | Hallucination, unknown reference, prompt leakage, stale result | Structured output, semantic allowlists, proof/revision checks, deterministic factual renderer |
| Browser to provider | Key exposure or direct spend | No provider dependency, bundle scan, local/private Node gateway only |
| Browser to local BYOK gateway | Cross-site request forgery, hostile Origin/Host, DNS rebinding, open-proxy spend | Numeric loopback-only bind; exact Host and Origin allowlists; no wildcard CORS; per-launch capability; bounded route, model, body, output, and cadence; hostile-request tests |
| Repository/events to engineering agent | Prompt injection, capability escalation, stale patch, recursive repair, secret exfiltration | Exact work order; isolated worktree; allowed paths/tools; brokered credentials; base/head compare-and-swap; budgets; bounded attempts; terminal result |
| Agent/provider extension registration | Mutable dependency, false capability claim, incompatible privacy semantics | Exact version/digest pin; license/security review; data-handling declaration; credential-free conformance; explicit human registration |
| Dependency analysis to merge/release | Compromised source, green-but-unsafe update, conflated credentials, endless fix/deploy loop | Verified actor/SHA; deterministic allowlist; separate brokers/grants; shadow mode; full checks; one repair/deploy/rollback maximum; terminal escalation |
| Public repository/release | Secret, private data/source, supply-chain or provenance leak | Full-history scan, generated/synthetic data, dependency/license/SBOM review, signed provenance |
| Private pilot operations | Unauthorized access, runaway cost, undeleted data | Per-call auth, one-use invites, rate limits, atomic budget ledger, kill switch, expiry/deletion jobs |

## Failure posture

Provider, validation, quota, budget, trace-limit, or kill-switch failure visibly pauses coaching while
the board remains playable. No retry is automatic and no arbitrary provider error crosses the HTTP
boundary. Recovery is explicit retry, uncoached play, or a deterministic verified clue.

Review this model whenever a boundary, dependency, data category, provider, endpoint, or publication
surface changes. Record residual risk and human acceptance in the governing ADR or release evidence.

Agent and model identities are provenance, not authority. The effective capability is the
intersection of registered adapter, workflow policy, exact work order, and current human grant.
Instructions found in code, issues, pull requests, logs, or external pages cannot expand it.

The local gateway is not a general proxy. Its per-launch capability is generated with secure
randomness, never placed in a query string or persistent browser storage, and required in a custom
header on every state-changing request. Requests with a missing/unknown Host, unapproved/null
Origin, missing/wrong capability, unsupported route/model/content type, or oversized body fail
before any provider call. CORS preflight grants only the configured local replay origin and required
method/headers.
