# AI-assisted development policy

This project uses AI assistants as engineering collaborators while preserving human accountability
and an auditable public record.

## Public record

A pull request records:

- The accepted work package and objective.
- Whether AI assisted discovery, implementation, tests, documentation, or review.
- Concise agent roles and durable outputs for meaningful multi-agent work.
- The real runner, provider, model, and adapter identity when available; a portable contract does
  not erase which implementation actually ran.
- The architecture/product/privacy choices made by the human maintainer.
- Exact commands and results used to verify the change.
- Failures found, material revisions, remaining uncertainty, and evidence links.

Milestone workflow records may summarize the same facts when they improve the recruiter-facing
story. They must remain concise and link to PRs, ADRs, tests, and reports.

## Not public project material

Do not commit private chain-of-thought, hidden reasoning tokens, development-assistant system or
developer prompts, raw chats, complete transcripts, scratch deliberation, private account context,
or tool output containing secrets or user data. These are noisy, may be confidential, and are not
reliable project authority.

Record the decision, alternatives considered, concise rationale, consequence, and verification in
an ADR or work package instead. Product runtime prompts are different: they are reviewed source
code and may be public under the runtime manifest policy.

## Accountability

AI output receives the same review as any untrusted contribution. Passing assistant review is not
a quality gate. Capability claims require conformance evidence; live quality, cost, latency, and
data-handling claims require an authorized measured run. The human maintainer owns scope, accepted
architecture, privacy decisions, claim language, merge, provider spend, beta exposure, and
publication, except for a future narrow action explicitly delegated by accepted machine policy.

Use an `ai-assisted` PR label rather than authorship trailers that overstate who owns a commit.
Never imply that generated code was independently validated unless the reported checks actually ran.
