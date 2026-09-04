# WF-2026-002 — Portable AI control plane

- Work package: [WP-2026-002](../../docs/work-packages/WP-2026-002-agent-and-provider-portability.md)
- Date: 2026-09-04
- State: Open [PR #4](https://github.com/memorex386/verified-sudoku-coach/pull/4) under review; no merge, live automation, provider spend, deployment, or release
- Data classification: Public engineering summary; no transcript, private source, credential, or model payload

## Human-owned intent and decisions

The maintainer chose a provider- and agent-neutral control plane so alternate coding agents and
product-model providers can use the same deterministic proof, privacy, evaluation, budget, and
authorization boundaries through narrow adapters. The reviewer cohort still uses one explicitly
approved, frozen provider/profile bundle; alternatives remain evaluation-only until they pass the
same gates. Real provider, model, runner, skill, and adapter identities remain in provenance.

The maintainer also chose a bounded dependency-PR workflow as a public automation example. The
first implementation is a credential-free deterministic controller and synthetic shadow fixture,
not a live bot. Patch publication, merge, release promotion, production deployment, and rollback
remain separate capabilities and credential classes. No production action is authorized by this
work package.

## AI-assisted roles and durable outputs

- A portability auditor mapped agent discovery, model-provider coupling, runtime identity, and
  public/private ownership risks to concrete documentation and test changes.
- An entrypoint implementer added canonical repository instructions plus thin Claude and Gemini
  discovery adapters, and tightened skill-adapter drift checks.
- A provider-policy implementer generalized runtime admission and browser-boundary checks around a
  digest-pinned capability descriptor while retaining OpenAI as the first candidate adapter.
- A dependency-policy implementer encoded the conservative eligible-change class, deterministic
  routing, attempt limits, mutation grants, terminal states, and staged rollout.
- Independent architecture and threat reviewers challenged the initial provider and automation
  implementations. Their findings produced new adversarial tests and controller requirements.
- A controller implementer converted an exact synthetic trusted-event envelope and pull-request
  evidence into derived dependency, risk, check, fingerprint, lineage, and finite-state outcomes
  without network access or mutation.
- The root integrator retained or rejected proposals, reconciled the documentation and executable
  policy, ran the reported checks, and owns the delivery pull request.

The work used OpenAI Codex desktop agents. The host did not expose a more specific model identifier
for this workflow record; that absence is explicit rather than replaced with a guessed identity.

## Decisions retained, revised, or rejected

- Retained: one canonical `AGENTS.md`, canonical repository skills, thin client-specific discovery
  adapters, exact capability manifests, inward dependencies, deterministic authorization, visible
  provider identity, and a single frozen provider during a reviewer cohort.
- Revised: runtime behavior identity now binds registration and behavior versions; browser-policy
  checks cover every registered provider and indirect SDK paths; future branches use a neutral
  `work/<work-package-id>-<short-topic>` convention.
- Revised: dependency automation begins as a pure shadow controller with controller-derived facts,
  stable lineage attempt accounting, replay-safe storage, and explicit terminal outcomes. A live
  GitHub runner is a separate future authorization and implementation.
- Rejected: an OpenAI wire contract in the core, duplicated rules in Claude/Gemini files, an
  ambient all-powerful agent, model-selected authority, caller-attested actor/SHA/risk fields,
  repair attempts that reset after a new commit, recursive fix-forward loops, silent provider
  fallback, automatic production release, and arbitrary plugin installation.

## Failures found and contained

- Review found OpenAI-specific names and browser checks that could admit a future provider without
  equivalent protections. Policy-driven provider registration and cross-provider regressions now
  fail closed.
- Review found that seven runtime-version fields could still ambiguously identify behavior. Runtime
  registration and behavior versions were added to the required identity tuple.
- Review found that profile digests, lifecycle-script detection, indirect SDK scanning, and
  admission transitions were incomplete. The policy schema, verifier, fixtures, and tests were
  tightened together.
- Claim review found that `store:false` had been mislabeled as disabling all request storage,
  boundary-only providers asserted unverified retention facts, open-weight identity prose exceeded
  its schema, and mutable hosted routes were called frozen. The corrected policy separates response
  retrieval, abuse monitoring, verified retention control, and artifact identity; it rejects an
  incomplete open-weight profile and blocks mutable/unverified hosted routes from approval.
- Review found that the first dependency classifier accepted self-asserted actor, SHA, failure,
  and risk facts and described attempt caps without an executable state machine. Those findings
  blocked acceptance and drove the trusted-event contract, raw-evidence normalizer, persistent
  lineage ledger, compare-and-swap result-store port, and terminal-state implementation. A real
  host-authentication adapter remains explicitly unimplemented.
- Controller review then found a remaining preclassified-eligibility path, missing assessment and
  repair capability checks, persisted-state phase forgery, malformed-equal CAS acceptance, and no
  explicit renewal after a repair-created head. Integration remained blocked until classification
  moved inside the controller, state decoding failed closed, stage grants were enforced, and a new
  exact-head work order became mandatory.
- Integrated adversarial review found that approval resumption revalidated an impossible projected
  phase, persisted schema versions were ignored, a replacement work order could add grants or
  capabilities, a no-op patch could claim publication, and renewal could reuse old authority or
  evidence. Regression tests now stop every case before an external effect.
- Replay review found exact-shaped but false terminal outcomes, attempt counts, and reason codes,
  plus malformed records whose map key disagreed with their identity. Replay now occurs only after
  deterministic identity derivation; it requires the exact terminal controller state, legal
  history, current classification, and authoritative lineage ledger before returning a result.
- Persisted-state review found live boundary limits missing on stored grant references and reason
  codes. Storage decoding now mirrors the live bounds and fails closed on unknown, oversized,
  noncanonical, or inconsistent values.
- Claim review separated host authentication from controller validation and removed unimplemented
  time/token/cost-budget claims. A future live adapter must authenticate the GitHub event and
  enforce those `AutomationSpecV1` budgets; the synthetic fixture proves neither.
- Review found a vendor-specific future branch example and renumbered work-package test drift.
  Machine checks now lock the neutral convention and the amended dependency graph.

## Validation performed

The integrated Windows branch passed a clean `npm ci` with zero reported vulnerabilities, the
canonical skill validator, every work-package command, and the full credential-free `npm run
verify` aggregator. The suite passed 112/112 tests. The recorded TypeScript 5.9.2 to 7.0.2 fixture
returned `deferred` with `compiler-or-build-tool` and `peer-conflict`, zero model/repair/mutation
attempts, a replayed terminal result, and zero network calls. No live model, GitHub mutation,
deployment, or credential was used.

A fresh agent received only the public repository URL and `WP-2026-002`. At PR #4 head
`48f1d346e1624c179216ff3d375dca2188574bfd`, it passed all four continuity checks: authority
discovery, trust-boundary explanation, clean credential-free verification (112/112 tests), and the
exact review-only next action. It also confirmed all five remote checks passed. The checklist result
is recorded here; its reasoning transcript is not.

## Evidence and limitations

Architecture evidence: [interoperability](../../docs/architecture/interoperability.md),
[agent/automation contracts](../../docs/contracts/agent-automation.md),
[ADR-0007](../../docs/decisions/0007-use-capability-based-agent-and-provider-adapters.md), and
[ADR-0008](../../docs/decisions/0008-bound-autonomous-maintenance-and-release.md).
Executable evidence: [provider policy](../../config/provider-policy.json),
[automation policy](../../config/automation-policy.json), and
[foundation validation tests](../../scripts/validation.test.mjs).
Operating evidence: [adapter runbook](../../docs/runbooks/add-agent-or-provider-adapter.md),
[dependency steward playbook](../../docs/playbooks/dependency-pr-steward.md), and
[canonical steward skill](../../.agents/skills/steward-dependency-pr/SKILL.md).

This work proves repository discovery and credential-free policy/controller conformance only. It
does not prove Claude, Gemini, open-weight, or OpenAI model quality; named alternate-provider
compatibility; a live host-authentication adapter or safe GitHub runner; browser production-bundle
absence; model cost/latency;
automated repair quality; deployment safety; or release readiness. Anthropic and Google entries are
boundary descriptors, not usable or approved runtime registrations. OpenAI remains a candidate,
not an approved production profile: its current provider-managed model routes are mutable and its
private-host retention control is unverified. Built-browser artifact inspection and comparative
provider evaluation remain future work. The in-memory result and lineage stores are conformance
adapters, not durable production persistence; a live host requires authenticated, transactional
compare-and-swap adapters. The finite controller is intentionally a credential-free reference and
should be split into codec, state/history, and store modules before a live runner is accepted.
Before merge, a default-branch-only reader sees the earlier WP-2026-002 mapping and must discover
open PR #4 to resolve the amendment. A feature-only single-branch clone must fetch `origin/main`
before the work-package base comparison can pass; both discoverability caveats were observed in the
fresh-agent exercise.
