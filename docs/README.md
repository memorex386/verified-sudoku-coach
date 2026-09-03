# Documentation authority

This index is the reading route for humans and agents. The repository is intentionally usable
without private conversation history.

## Source-of-truth order

1. The [accepted plan record](product/plans/VSC-PLAN-2026-09-03.1.md),
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

## Documents by task

| Need | Read |
| --- | --- |
| Understand the proposal | [Product charter](product/charter.md) |
| Resolve the accepted plan version | [Accepted plan record](product/plans/VSC-PLAN-2026-09-03.1.md) |
| Understand system boundaries | [System](architecture/system.md) and [trust boundaries](architecture/trust-boundaries.md) |
| Understand proof scope and ordering | [Proof policy](architecture/proof-policy.md) |
| Review candidate model choices | [Model profiles](architecture/model-profiles.md) |
| Change an interface | [Contract versioning](contracts/versioning.md) and [change matrix](change-matrix.md) |
| Find a public interface owner | [Contract catalog](contracts/catalog.md) |
| Inspect runtime AI registration | [Runtime manifest contract](contracts/runtime-manifest.md) |
| Change a proof technique | [Proof-technique runbook](runbooks/change-proof-technique.md) |
| Select or continue work | [Work package registry](work-packages/) |
| Judge a claim | [Evaluation policy](evaluation/policy.md) and [acceptance catalog](acceptance/catalog.md) |
| Start an implementation task | [Agent workflow](runbooks/agent-workflow.md) |
| Change a model or prompt | [Runtime-AI change runbook](runbooks/change-runtime-ai.md) |
| Investigate an eval failure | [Eval-failure playbook](playbooks/eval-failure.md) |
| Review public safety | [Public-boundary playbook](playbooks/public-boundary-review.md) |
| Prepare a release | [Release runbook](runbooks/release.md) |
| Upgrade the private host | [Sudoku World upgrade runbook](runbooks/upgrade-sudoku-world.md) |
| Retain or delete pilot data | [Retention and deletion](runbooks/retention-and-deletion.md) |
| Hand off agent work | [Agent handoff](runbooks/agent-handoff.md) |
