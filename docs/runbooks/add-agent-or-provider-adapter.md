# Add an agent or provider adapter

Use this runbook when a coding-agent runtime, model provider, local inference host, tool protocol,
trigger, notifier, or source-control/deployment integration must join the portable control plane.
An adapter translates a boundary; it does not inherit authority or redefine core policy.

## Before implementation

1. Select a `Ready` or `In progress` work package and follow the
   [agent workflow](agent-workflow.md).
2. Name the boundary, protocol/version, exact package or executable digest, data classes, required
   capabilities, permissions, credentials, network endpoints, and failure semantics.
3. Confirm the existing neutral contract can represent the behavior without provider-specific
   branching. If not, amend the contract and ADR before adding the adapter.
4. Review license, supply-chain provenance, retention/training policy, regional processing, and
   browser/server placement. Unknown or incompatible semantics fail closed.

## Provider adapter

- Register the exact provider profile, Node-only adapter, roles/models, native settings schema,
  data-handling requirements, SDK/key/endpoint browser bans, and digest.
- Implement the stable observer/teacher port and normalize only response, usage, timeout,
  cancellation, refusal, quota, and redacted error outcomes.
- Run shared conformance plus provider-specific positive, malformed, stale, timeout, redaction, and
  adversarial fixtures. Prove a browser cannot reach the adapter, SDK, key name, or endpoint.
- Run credential-free evaluation first. Live comparison requires explicit provider-specific spend
  authorization and produces aggregate evidence only.
- Keep the new profile candidate/evaluation-only until accepted. Do not add automatic failover.

## Engineering-agent or tool adapter

- Keep `AGENTS.md`, repository docs/scripts, and `.agents/skills` canonical. A client entrypoint is
  a short discovery pointer, not a policy copy.
- Register supported contract/protocol versions, capabilities, requested permissions, entrypoint
  digest, and configuration schema. Pin any external extension by exact version/digest.
- Forward-test a bounded `WorkOrderV1` in an isolated worktree with no production credential.
  Exercise forbidden paths, stale head, hostile repository/PR instructions, cancellation, budget,
  and terminal outcomes.
- Record the real runner, provider, model, and adapter identity in sanitized execution evidence.

## Acceptance

Run the work package's exact checks, full `npm run verify`, and an independent continuity or
conformance review. Update the architecture/provider/automation policy and evidence together.
Passing structural checks supports only a portability claim; name a provider or runner as compatible
only after its own conformance evidence, and report live quality/cost/latency only after a measured
authorized run.
