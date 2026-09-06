# Documentation authority

This index is the reading route for humans and agents. The repository is intentionally usable
without private conversation history.

## Source-of-truth order

1. The [current accepted plan record](product/plans/VSC-PLAN-2026-09-05.3.md),
   [product charter](product/charter.md), and [acceptance catalog](acceptance/catalog.md) define
   approved intent, value, scope, claims, and release gates.
2. [Architecture](architecture/principles.md), [contracts](contracts/versioning.md), accepted
   [ADRs](decisions/), [trust boundaries](architecture/trust-boundaries.md), the
   [threat model](security/threat-model.md), and [privacy policy](privacy.md) define technical and
   data-handling truth.
3. [Work packages](work-packages/) define ordered implementation scope, current state, and durable
   handoff evidence.
4. [Runbooks](runbooks/) and [playbooks](playbooks/) define repeatable operating procedures.
5. Root and scoped `AGENTS.md` files route agents to the preceding sources; `.agents/skills/`
   provides concise workflow entry points.
6. `README.md` is the recruiter and contributor overview, not a substitute for the sources above.

When sources conflict, correct the lower-authority source in the same change. Do not copy a policy
into multiple layers.

## Product AI versus development AI

- **Product AI** is the planned observer/teacher runtime bounded by deterministic proofs. Its model,
  prompt, schema, validator, and evaluation versions are governed by the
  [runtime-AI runbook](runbooks/change-runtime-ai.md).
- **Development AI** refers to assistants used for discovery, implementation, review, or testing.
  Its public disclosure contract is in
  [AI-assisted development](provenance/ai-assisted-development.md). Private reasoning and chat
  transcripts are never project authority.

Both use the capability-based boundaries in
[agent and provider interoperability](architecture/interoperability.md). OpenAI, Codex, Claude,
Gemini, and open-weight names identify adapters or provenance; none is a core authority.

## Documents by task

| Need | Read |
| --- | --- |
| Understand the proposal | [Product charter](product/charter.md) |
| Play the local deterministic tutor | [Launch and interaction guide](runbooks/local-tutor.md) — one generated puzzle, no live AI |
| Preview the coaching interaction | [Visual-storytelling design reference and offline walkthrough](product/concepts/coach-interaction.md) — scripted concept, not implementation evidence |
| Resolve the accepted plan version | [Local tutor amendment](product/plans/VSC-PLAN-2026-09-05.3.md) and its linked predecessor |
| Understand system boundaries | [System](architecture/system.md) and [trust boundaries](architecture/trust-boundaries.md) |
| Add an agent/provider or automation | [Interoperability](architecture/interoperability.md), [automation contracts](contracts/agent-automation.md), and ADR-0007/0008 |
| Understand proof scope and ordering | [Proof policy](architecture/proof-policy.md) |
| Review candidate model choices | [Model profiles](architecture/model-profiles.md) |
| Change an interface | [Contract versioning](contracts/versioning.md) and [change matrix](change-matrix.md) |
| Find a public interface owner | [Contract catalog](contracts/catalog.md) |
| Implement board/proof V1 | [Sudoku and proof contracts V1](contracts/sudoku-proof-v1.md) and [fixture generation](architecture/fixture-generation.md) |
| Check recorded player transitions | [Replay-action checkpoint](contracts/replay-actions.md) — proof paths remain unverified |
| Apply immutable player input | [Player-action checkpoint](contracts/player-actions.md) — separate from verified proof application |
| Inspect runtime AI registration | [Runtime manifest contract](contracts/runtime-manifest.md) |
| Change a proof technique | [Proof-technique runbook](runbooks/change-proof-technique.md) |
| Select or continue work | [Work package registry](work-packages/) |
| Judge a claim | [Evaluation policy](evaluation/policy.md) and [acceptance catalog](acceptance/catalog.md) |
| Start an implementation task | [Agent workflow](runbooks/agent-workflow.md) |
| Change a model or prompt | [Runtime-AI change runbook](runbooks/change-runtime-ai.md) |
| Add an agent or provider adapter | [Adapter runbook](runbooks/add-agent-or-provider-adapter.md) |
| Investigate an eval failure | [Eval-failure playbook](playbooks/eval-failure.md) |
| Triage a dependency pull request | [Dependency steward playbook](playbooks/dependency-pr-steward.md) |
| Review public safety | [Public-boundary playbook](playbooks/public-boundary-review.md) |
| Prepare a release | [Release runbook](runbooks/release.md) |
| Upgrade the private host | [Sudoku World upgrade runbook](runbooks/upgrade-sudoku-world.md) |
| Retain or delete pilot data | [Retention and deletion](runbooks/retention-and-deletion.md) |
| Hand off agent work | [Agent handoff](runbooks/agent-handoff.md) |
