---
id: ADR-0007
status: Accepted
date: 2026-09-04
---

# Use capability-based agent and provider adapters

## Context

The coach begins with OpenAI and current engineering work uses Codex, but future evaluation and
maintenance may use Anthropic, Gemini, or open-weight models and Codex, Claude Code, Gemini CLI, or
other runners. Provider APIs, tool formats, instructions, storage controls, and scheduler behavior
are not interchangeable. Embedding one vendor's semantics in core policy would make replacement
risky and make portability claims unverifiable.

## Decision

Keep Sudoku authority, workflow state, permissions, acceptance, and evidence in deterministic,
versioned, vendor-neutral contracts. Put every model API, agent runner, tool transport, trigger,
notifier, source-control mutation, and deployment integration behind a narrow leaf adapter with an
exact manifest, capability declaration, version/digest, data-handling profile, and conformance
evidence. Select adapters by required capability and approved policy while retaining their real
identity in provenance.

Use `AGENTS.md`, repository docs/scripts, and `.agents/skills` as canonical engineering sources.
Tool-specific instruction, skill, hook, or settings files remain generated or machine-checked thin
adapters. Missing capability or incompatible semantics fails explicitly. Runtime model substitution
is never silent, and Coach v1 has no provider failover.

## Rejected alternatives

- Make the OpenAI Responses shape the application contract and ask other providers to emulate it.
- Maintain complete independent rules and skills for every coding agent.
- Dynamically load any repository-supplied plugin that declares the requested capability.
- Reduce all adapters to the weakest common feature set without recording explicit degradation.
- Claim named-provider compatibility from mocked API-shape tests alone.

## Consequences

The project gains a stable integration seam and honest cross-provider evaluation. Each adapter has
some translation and conformance cost, and provider-specific strengths remain explicit. Adding an
adapter is a reviewed supply-chain and behavior change rather than an ambient configuration tweak.
The reviewer cohort remains reproducible with one approved registration while alternatives can be
measured without changing deterministic truth.

## Verification

`VSC-ARCH-007`, `VSC-EVID-003`, provider-policy/runtime-manifest validation, browser-boundary
fixtures, thin-entrypoint checks, adapter conformance, and fresh-agent continuity evidence.
