# Architecture principles

These are project invariants, not preferences. An exception requires an accepted ADR and an update
to its enforcement before implementation.

## 1. Proof before prose

Deterministic code owns candidates, placements, eliminations, proof validity, stale-board detection,
and learner-outcome grading. A model may choose among verified facts; it may not create them.

## 2. Dependencies point inward

Domain, proof, and coaching policy do not depend on contracts, providers, networks, persistence,
frameworks, or the host product. Wire contracts do not import domain values; boundary codecs are
the explicit anti-corruption layer. The allowed package graph is machine-readable in
[`config/architecture.json`](../../config/architecture.json) and verified in CI.
Its `VSC-ARCH-2` policy digest locks the accepted workspace/provider graph and enforcement categories;
changing it requires the governing ADR and verifier to change together.
The AST and manifest fitness checks are defense-in-depth drift guards, not a JavaScript sandbox or
a substitute for review. Release work must also inspect built artifacts and exercise consumer
fixtures before claiming package or browser isolation.

## 3. Contracts are executable

Every process, package, provider, replay, and private-product boundary uses an exact-key,
runtime-validated, versioned contract. TypeScript types alone are not a runtime trust boundary.

## 4. Model output is untrusted input

Syntax, schema, semantic proof references, board revision, pacing policy, and renderable content all
must pass before display. A structurally valid response can still be semantically unsafe.

## 5. Facts render deterministically

Player-visible cells, digits, candidates, techniques, and proof explanations come from verified
facts and controlled templates. Bounded non-factual language may be evaluated separately; it never
changes the factual payload.

## 6. Failure is visible and safe

Timeout, quota, provider, validation, trace-limit, kill-switch, or budget failure produces a typed,
visible `paused` outcome. The player keeps the board and can choose retry, uncoached play, or a
deterministic clue. A response for an obsolete board revision produces a typed `stale` outcome that
is discarded without interrupting or displaying a lesson to the player.

## 7. Minimize data by construction

The provider receives only the verified information needed for one decision. Public artifacts use
synthetic data. Identity, full account context, raw production traces, and unrelated gameplay never
cross into this repository or model request.

## 8. Version behavior, not just code

Code commit, ruleset, schema/contract, prompt, requested and returned model/model-profile, inference
settings, renderer, fixture, and evaluation-suite versions belong in evidence. Every replay and
trace carries the canonical nine-field behavior identity defined by the contract catalog. Live
model runs are reproducible protocols, not promised bit-for-bit deterministic outputs.

## 9. Documentation is operating state

Accepted decisions, work packages, gates, and evidence replace private chat history as authority.
Registries and links are machine-checked. Agent files and skills route to canonical docs rather than
copying them.

## 10. Humans remain accountable

AI may accelerate discovery, code, tests, review, and documentation. A human owns product intent,
architecture acceptance, privacy decisions, claims, automation policy, release, and publication.
During the evidence phase, AI-authored repairs and production deployments require human review.
A later accepted, revocable policy may authorize a narrowly defined merge class after its required
checks and evidence pass; a model response never supplies that authorization.

## 11. Capability before brand

Core policy depends on typed roles, capabilities, and versioned contracts. Model providers, coding
agents, tool transports, trigger hosts, notifiers, and deployment systems enter through narrow leaf
adapters. Their real identities remain in provenance. Missing capability, incompatible semantics,
or an unapproved registration fails explicitly; no adapter silently substitutes behavior or weakens
proof, privacy, budget, evaluation, or authorization gates.

## Enforcement map

| Principle | Primary enforcement |
| --- | --- |
| Proof before prose | Proof/semantic tests and ADR-0001 |
| Dependencies point inward | `npm run architecture:check` and ADR-0002 |
| Contracts are executable | Contract compatibility tests and version policy |
| Model output is untrusted | Adversarial evals, validators, and ADR-0003 |
| Facts render deterministically | Renderer tests and model-output schema |
| Failure is visible and safe | Failure-path integration tests and ADR-0004 |
| Minimize data | Request projection tests and public-boundary scan |
| Version behavior | Runtime manifest and eval/release manifests |
| Documentation is state | Docs/work-package/skill checks |
| Humans remain accountable | PR and release authorization gates |
| Capability before brand | Provider policy, adapter conformance, thin-entrypoint checks, and ADR-0007 |
