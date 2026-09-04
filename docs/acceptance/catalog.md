# Acceptance catalog

Acceptance IDs are stable, evidence-backed, atomic gates. Each gate has exactly one owning work
package, recorded below and checked against that package's front matter. A later package preserves
completed gates as architecture invariants but does not cite them as unfinished work. Changing a
gate requires reviewing its owner and every ADR or contract that references it. A document or
passing compile alone is not evidence that runtime, privacy, experience, or portfolio claims are
true.

## VSC-FOUND-001 — Credential-free reproducible foundation

Owner: `WP-2026-001`

A fresh clone on Node 22 passes `npm ci`, `npm run doctor`, `npm run docs:check`,
`npm run eval:replay`, and `npm run verify` on Ubuntu and Windows. Until WP-2026-005 replaces the
bootstrap under VSC-EVAL-001, `eval:replay` may return machine-readable `not_implemented`, zero
cases, and `claimsMeasured: false`; this is command readiness, not an evaluation result or quality
claim. WP-2026-005 cannot reach `Done` with the bootstrap result.

## VSC-FOUND-002 — Durable engineering authority

Owner: `WP-2026-001`

The docs index, accepted-plan record, six foundation ADRs, threat/privacy policies, architecture
graph, change matrix, work-package registry, five canonical skills, and public-boundary/provenance
controls are machine-checked. A fresh agent given only the repository and a WP ID finds governing
sources, explains the trust boundary, runs credential-free checks, and identifies the exact next
action.

## VSC-ARCH-001 — Enforced inward and pure boundaries

Owner: `WP-2026-001`

`domain` has no dependencies; `proof-engine` depends only on domain; `coach-core` remains pure;
`contracts` imports no domain and may use only the approved schema library; codecs alone map DTOs
to trusted values. Production core/boundary source cannot import frameworks, providers, network,
persistence, environment, clock, storage, or randomness. Dependency aliases, cycles, escaping
relative imports, TypeScript path/root remapping or strictness weakening, browser-to-Node
reachability, and legacy Node imports fail end-to-end fixtures.

## VSC-PRIV-001 — Public disclosure boundary

Owner: `WP-2026-001`

The working tree, Git index, and complete reachable history contain no credentials, local home
paths, private source/configuration/identifiers, participant/user/private-account identities,
production or participant boards, notes, platform/system/developer/task prompts, private
agent-session prompts or transcripts, raw provider request/response payloads, traces, feedback, or
private reasoning. Reviewed repository-authored `AGENTS.md` and skill instructions, plus public
runtime prompts, remain permitted source code under the provenance policy. Independently generated
fixtures and reviewed synthetic replay records are permitted with provenance. Oversized or
undecodable files require explicit review rather than silent acceptance.

## VSC-ARCH-007 — Capability-based agent and provider boundaries

Owner: `WP-2026-002`

Core packages and deterministic workflow policy contain no provider- or coding-agent-specific
branching. An exact provider policy identifies leaf adapters, capabilities, role/model and settings
constraints, data-handling requirements, and browser SDK/key/endpoint boundaries. Runtime behavior
identity includes the registered route and complete runtime-behavior version. Unknown providers,
settings, capabilities, fields, or unregistered substitutions fail. OpenAI remains the first
candidate adapter without becoming the application contract.

## VSC-OPS-004 — Finite least-privilege automation policy

Owner: `WP-2026-002`

A machine-readable policy and pure finite-state controller separate analysis, patch publication,
merge, release, and production credentials. Dependency handling compares an authenticated event
envelope with current base/head SHAs, derives manifest/diff/check risks, computes a canonical
failure identity, and returns any prior terminal result through a result-store port before it
classifies deterministically. Fake-store conformance proves replay behavior; a host must provide
durable compare-and-swap persistence before live use. Controller-owned, monotonic lineage counters
survive repair-created SHAs and changed failure fingerprints. The controller permits at most one
inexpensive diagnosis, one stronger escalation, one repair, and one recognized-infrastructure rerun
before a terminal result. Every error, timeout, and attempt-exhaustion path terminates. Shadow mode
cannot merge. Future release execution permits at most one deployment and one rollback, then verifies
and stops; stateful/irreversible changes are ineligible.

## VSC-EVID-003 — Portable repository handoff

Owner: `WP-2026-002`

Canonical `AGENTS.md`, repository scripts/docs, and open-format `.agents/skills` contain substantive
policy. Claude and Gemini discovery files are thin, machine-checked adapters. Future work uses a
vendor-neutral branch convention and records real runner/provider/model/adapter identity in
sanitized execution evidence. Structural compatibility is never presented as measured live-agent
or named-provider quality.

## VSC-ARCH-002 — Sealed core package and API boundaries

Owner: `WP-2026-003`

Public packages expose root entrypoints only and reject deep imports. TypeScript project references
and manifest dependencies match the inward graph. Contracts/codecs keep wire and domain values
separate. Browser-safe and Node consumers pass clean Angular ESM and Node CommonJS `npm pack`
fixtures with deterministic package/API hashes.

## VSC-ARCH-003 — Exact versioned contracts and behavior identity

Owner: `WP-2026-003`

Every implemented board, proof, trace, and replay DTO has an exact-key, bounded, versioned Zod
schema with valid, malformed, unknown-key, boundary-size, and unsupported-version tests. Codecs do
not coerce or invent domain defaults. Every replay and trace carries all nine fields of
`BehaviorIdentityV1`; mixed identity hashes fail. Generated schema/API artifacts cannot drift.

## VSC-PROOF-001 — Six verified techniques

Owner: `WP-2026-003`

Naked single, hidden single, locked pointing, locked claiming, naked pair, and hidden pair each
have positive, near-miss, stale, and field-tamper tests. Detectors only propose; an independent
verifier establishes every premise before a placement or elimination can be applied or registered.
Canonical ordering is deterministic across Node and Chromium.

## VSC-PROOF-002 — Sound generated and private-corpus conformance

Owner: `WP-2026-003`

Public fixtures are independently generated and uniquely solvable. Property, path-replay, digit,
D4, band, and stack transformation tests report zero invalid placements or eliminations. Aggregate
private conformance does not regress below the frozen 5,147/5,191 Easy–Hard six-technique baseline;
any count change, including an increase, requires an explicit ruleset/version decision.

## VSC-AI-001 — Reference-only model authority

Owner: `WP-2026-004`

Observer and teacher outputs can reference only registered opportunity, proof, fact, branch, and
template IDs. Model output cannot mutate boards or mastery. All digits, cells, candidates,
techniques, and factual explanations render deterministically from reverified facts.

## VSC-AI-002 — Invalid application output never displays

Owner: `WP-2026-004`

Recorded malformed, hallucinated, unknown-reference, refused, timeout, quota, budget, kill-switch,
trace-limit, and provider-failure outcomes visibly yield `paused`; an obsolete board revision yields
`stale`. `silent` is reserved for a valid observer decision that no intervention is appropriate and
is never a failure fallback. None of these cases yields a lesson. Provider messages, prompts,
responses, and stack traces never cross the application boundary; there is no automatic fallback.

## VSC-UX-001 — Deterministic coaching behavior

Owner: `WP-2026-004`

Latest-wins cadence permits one call in flight, at least five seconds between background calls, and
immediate explicit help. The board remains playable for every pause, recovery is explicit, the
player places every move, learner-band changes are deterministic, and the canonical recorded replay
produces 8–15 interventions without touching normal product state.

## VSC-ARCH-004 — Contained provider and local-gateway boundary

Owner: `WP-2026-005`

Browser artifacts cannot reach or contain any Node-only provider adapter, provider SDK, key name,
endpoint, or direct provider composition. Registered and known provider boundaries are derived from
one exact policy and include adversarial OpenAI, Anthropic, and Google fixtures. The BYOK gateway
binds numeric loopback only, uses exact Host/Origin
allowlists and no wildcard CORS, requires an unpersisted per-launch capability, and bounds
route/model/body/output/cadence. Hostile Origin/Host, DNS-rebinding, capability, and oversized
requests cause zero provider calls.

## VSC-AI-003 — Approved, versioned runtime bundles

Owner: `WP-2026-005`

Runtime composition accepts only model/prompt/schema/validator/renderer bundles marked `approved`.
Changing a prompt, schema, model profile, proof policy, or renderer changes its manifest and
comparative evaluation. Every registration binds an approved provider profile and exact adapter
settings. Initial candidate observer/teacher profiles request GPT-5.6 Luna/Terra through the OpenAI
Responses adapter with strict structured output, generated-response retrieval disabled through
exact `store:false`, finite limits, and no automatic retry. This does not claim Zero Data Retention;
abuse-monitoring and retention-control state are separate profile evidence. A mutable hosted-model
route cannot be approved for the reviewer cohort. Alternate providers remain evaluation-only until
their own conformance and approval evidence exists.

## VSC-EVAL-001 — Complete, guarded evaluation tooling

Owner: `WP-2026-005`

Frozen, adversarial, and comparative suites run without credentials and account for every pass,
validator rejection, refusal, timeout, provider error, and exclusion. Aggregate JSON reproduces its
Markdown summary. The live runner refuses provider access without current explicit confirmation and
a numeric spend cap; raw requests/responses remain local and ignored.

## VSC-UX-002 — Truthful accessible public replay

Owner: `WP-2026-006`

The static React replay uses only generated puzzles and reviewed synthetic recordings, labels
itself as replay rather than live AI, presents 8–15 proof-bound interventions, and passes responsive,
keyboard, touch, screen-reader, and bundle-isolation checks. TTS is off by default where offered.

## VSC-EVID-001 — Reproducible pre-results release evidence

Owner: `WP-2026-006`

Every public pre-results claim links to a test, ADR, evaluation, PR, or immutable release. Release
JSON binds source/tag, lockfile/artifact hashes, all nine behavior-identity fields, provider-policy
digest, CI, demo hash,
SBOM/license results, and limitations, and reproduces summaries. Pages and the Sudoku World demo
link remain inactive until separately authorized and verified.

## VSC-ARCH-005 — Private Functions release parity

Owner: `WP-2026-007`

Firebase Functions imports only immutable Node/public artifacts through narrow adapters. Its exact
artifact URLs, lock integrity, ruleset/contracts/renderer identity, and release hashes match the
public manifest. No database transaction remains open during a model call, and no provider owns
application state.

## VSC-PRIV-002 — Private consent and model-data minimization

Owner: `WP-2026-007`

Private integration requires account-linked consent and collects no separate name, email, phone, or
employer fields. Provider packets exclude identity and unrelated trace data. Logs and analytics
contain only allowlisted codes, versions, counts, costs, and durations—never raw content.

## VSC-PRIV-003 — Withdrawal, retention, and sealed-disclosure controls

Owner: `WP-2026-007`

Account withdrawal immediately disables access and starts deletion. Raw pilot traces expire within
30 days. Consent discloses that reviewed cohort aggregates seal at close and cannot be unwound after
raw deletion; anonymous quotation is optional and named attribution requires separate approval.
Emulator tests cover expiry, deletion jobs, withdrawal, and disclosure state.

## VSC-OPS-001 — Authorized, idempotent bounded operation

Owner: `WP-2026-007`

Every call applies its endpoint-specific authorization policy. Invites are one-use and stored hashed; session persistence uses
compare-and-swap; stable command/call IDs make retries idempotent; stale responses are discarded.
Traces stop at 500 events. Rate limits, deletion jobs, ledger, and kill switch fail closed while the
board remains playable.

## VSC-OPS-002 — Cost and service observability

Owner: `WP-2026-007`

Every model call records allowlisted latency, cost/token, outcome, validator, and version metrics
without content. Atomic reservation/reconciliation prevents concurrent overspend, and an
application-level $250 pilot guard is tested alongside external billing visibility and alerts.

## VSC-UX-003 — Server-enforced web-only entitlement

Owner: `WP-2026-007`

Every public Coach endpoint requires Firebase authentication and the approved web App Check
identity; Android/iOS App Check identities and self-asserted client-surface values are denied.
`redeemCoachInvite` validates and atomically consumes its own hashed invite without requiring a
session capability. `getCoachAccess` reads only the caller's entitlement/consent state without an
active session. `startCoachSession` requires a redeemed, unexpired entitlement and current consent,
then issues the account/session-bound capability. `observeCoachAction`, `completeCoachSession`, and
`submitCoachSurvey` require that capability, with board revision/CAS checks where board state is
involved. Authenticated `withdrawCoachData` deliberately requires neither active entitlement nor a
session capability, so it remains usable after invite or session revocation. Hiding a client route
is never treated as access control. Emulator tests cover missing/wrong/native App Check, redeemed,
expired and revoked invites/capabilities, stale revisions, and withdrawal after revocation.

## VSC-ARCH-006 — Private Angular artifact and browser parity

Owner: `WP-2026-008`

Angular consumes the same immutable browser-safe core release as Functions and maps private mutable
objects only through its anti-corruption adapter. Production bundle inspection excludes every
provider adapter, provider SDK/key/endpoint, and unpinned/deep import. `HintEngine`
characterization proves the
public proof engine is the sole factual authority.

## VSC-UX-004 — Isolated accessible private Coach UI

Owner: `WP-2026-008`

Coach routes/storage never invoke normal progress, completion, Journey, statistics, challenge,
race, ad, or reward paths. Keyboard, touch, screen-reader, responsive, pause/recovery, self-rating,
recap, and TTS-default-off behavior pass. Android/iOS bundles expose no Coach entry route. The public
information page's replay link stays absent/disabled until publication authorization and URL/hash
verification.

## VSC-EVAL-002 — Reviewer release quality gate

Owner: `WP-2026-009`

Across deterministic, adversarial, protected live, and owner-alpha runs, zero unsupported factual
claim is displayed. Full schema-plus-semantic validator acceptance is at least 98% overall and at
least 95% in every technique and every player self-rating subgroup; its denominator is every
non-empty output presented to validation. Observer p95 is at most four seconds. The exact approved
behavior/eval manifest freezes before invitations.

## VSC-OPS-003 — Operational reviewer release gate

Owner: `WP-2026-009`

Disabled-first deployment, monitoring, access, one-use invites, rate limits, budget reservation,
external alerts, $250 guard, kill switch, retention, withdrawal, and deletion rehearsal all pass.
Owner-alpha data is partitioned from reviewer results. Deployment, spend, enablement, and invite
issuance each have separately recorded authorization.

## VSC-PILOT-001 — Complete bounded reviewer outcome accounting

Owner: `WP-2026-009`

The preregistered cohort closes according to its unchanged stop rule, and every invitation,
completion, exclusion, intervention count, breach outcome, and survey denominator is accounted for.
The recorded result reports pass or fail without moving a threshold. The separate pilot-success
claim is true only with at least eight completed reviewer sessions, 8–15 interventions per
completion, no factual/privacy/access/budget breach, and at least 70% rating 4–5 on each outcome:
made them reason, felt adaptive, and demonstrated production AI-engineering judgment. An honestly
failed result still satisfies outcome-accounting acceptance and can proceed to evidence sealing.
Results remain small-cohort portfolio evidence, not causal learning or commercial validation.

## VSC-PRIV-004 — Verified cohort-close deletion

Owner: `WP-2026-010`

At cohort close, the reviewed aggregate is sealed with complete denominators and all account-linked
raw traces are deleted within their 30-day windows. A private verification record proves deletion
without exposing identities/content; public evidence states the aggregate cannot be unwound and
honors anonymous-quote opt-out and separate named-attribution approval.

## VSC-EVID-002 — Reproducible final career claims

Owner: `WP-2026-010`

The final case study, diagram, walkthrough, LinkedIn copy, and resume bullet are generated or checked
against sealed aggregate JSON. Every claim links to a test, ADR, evaluation, PR, release, or deletion
verification; exact n/N, selection bias, exclusions, limitations, and non-causal scope are visible.
Workflow records summarize task, roles, decisions, failures, and validation without transcripts or
hidden reasoning.
