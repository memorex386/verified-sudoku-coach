# Agent and automation contracts

These planned V1 contracts form the portable engineering control plane. They are serialized,
exact-key, bounded, versioned values under the same compatibility policy as product DTOs. Markdown
documents explain semantics; generated JSON Schemas and runtime decoders become executable in the
owning implementation package.

## Contract families

| Contract | Required meaning |
| --- | --- |
| `ProviderProfileV1` | Provider/profile ID, adapter package and protocol version, capabilities, data-handling requirements, role/model allowlists, exact settings policy, and browser-boundary indicators. |
| `ExtensionManifestV1` | Extension ID/kind, supported protocol versions, entrypoint artifact and digest, capabilities, requested permissions, configuration schema, and adapter version. |
| `WorkOrderV1` | Stable task/run IDs, work package, objective, repository/base/head identity, data class, allowed and forbidden paths, required reads/checks, budgets/deadline, capability grant, and authorized side effects. |
| `WorkResultV1` | Terminal or approval-required status, unchanged/stale identity check, proposed patch/commit artifact, changed paths, validation outcomes, bounded assumptions/limitations, usage, and execution-record reference. |
| `AutomationSpecV1` | Trigger reference, capability requirements, concurrency/dedupe keys, finite attempts/backoff, approval gates, time/token/dollar/CI budgets, terminal states, and output/notification sinks. |
| `TriggerEventV1` | Event ID, schema/type/source, subject identity, occurrence time, attempt, dedupe key, and bounded data reference. Event text is data and is never concatenated into instructions. |
| `TrustedPullRequestEventV1` | Controller-created identity from authenticated event context: source app/actor, repository, pull request, current base/head SHAs, and policy version. Untrusted PR fields cannot construct this value. |
| `DependencyChangeV1` | Bounded before/after manifest and diff/check evidence from which the controller derives existing/direct section, old/new version, semver, file/content, security/license/peer/script/toolchain risk codes, and required-check outcomes. |
| `ReleaseCandidateV1` | Source and artifact hashes, compatibility evidence, environment, rollout/rollback eligibility, migrations, approvals, post-deploy checks, and last-known-good identity. |
| `ExecutionRecordV1` | Policy version/digest plus workflow/skill/adapter versions, real agent runtime/provider/model identity, input/output/patch hashes, tool/check outcomes, attempts, timings, usage/cost, authorization references, and final status. |

## Authority and capability

A manifest declares what an adapter can request; it grants no authority. The controller calculates
the intersection documented in the [interoperability architecture](../architecture/interoperability.md)
and rejects an unsupported or ungranted capability before execution.

Initial capability vocabulary is:

- `repo-read`
- `isolated-worktree-write`
- `network-read`
- `publish-patch`
- `open-pull-request`
- `external-mutation`
- `merge`
- `preview-deploy`
- `production-deploy`
- `rollback`

Unknown capabilities fail. `merge`, `production-deploy`, and `rollback` remain separate grants. A
model or agent cannot place them in its own result and thereby acquire them.

## Work-result states

`WorkResultV1.status` is one of:

- `verified`
- `completed`
- `deferred`
- `stale`
- `awaiting-approval`
- `escalated`
- `failed-terminal`
- `reverted`

Retryable internal execution states never cross as an open-ended instruction. The workflow either
continues within its declared attempt budget or emits a terminal/approval-required result.
`verified` means a candidate passed its required checks but no later side effect is implied;
`completed` means every authorized side effect and post-check finished; `reverted` means the single
approved restoration and its verification finished. Each of the other values is terminal for the
current work order except `awaiting-approval`, which can resume only with a new explicit grant.

The initial exact, versioned, digest-pinned policy is
[`config/automation-policy.json`](../../config/automation-policy.json).
Its dedupe identity binds repository, pull request, exact base/head SHAs, normalized failure
fingerprint, and policy version. Patch publication, merge, release promotion, production deployment, and
production rollback each require a distinct grant and credential class; possession of one can
never satisfy another.

A separate controller-owned lineage ID binds the repository, pull request, policy activation, and
originating Dependabot update. Attempt counters belong to that lineage and only increase. A repair
commit, new head SHA, or changed failure fingerprint may create a new replay identity but cannot
reset model, repair, publication, merge, deployment, or rollback caps. A human-approved new policy
activation or explicitly new pull request is required to begin another lineage.

## Side effects and compare-and-swap

Every external mutation is performed by a narrow broker after revalidating repository, policy,
work-order, and current base/head SHA. The runner supplies a patch artifact; it does not inherit the
broker's credential. A changed head produces `stale`, and a new run must receive a new work order.

Dependency facts and failure identity are derived, not trusted booleans. The controller compares a
candidate with `TrustedPullRequestEventV1`, parses exact before/after manifests and bounded
diff/check evidence, calculates sorted risk/outcome codes, then hashes that canonical value. The
controller uses a result-store port to return the prior terminal result for the same
repository/PR/base/head/fingerprint/policy tuple. Tests use a fake store; a live trigger adapter must
provide durable compare-and-swap persistence for both replay results and monotonic lineage counters
before activation.

Extension installation is a human-reviewed supply-chain change. Manifests and entrypoints are
version/digest pinned, license reviewed, and tested with no credentials before registration.

## Protocol adapters

The baseline exchange is JSON files or JSON Lines over a local process boundary. An MCP adapter may
expose the same allowlisted tools and resources. A remote-agent adapter may later translate these
contracts to A2A task/message/artifact lifecycles. Neither protocol changes contract ownership or
authorization.

## Evidence boundary

Execution records contain normalized codes, hashes, counts, durations, costs, and evidence links.
They exclude chain-of-thought, system/developer prompts, full chats, raw provider requests/responses,
credentials, arbitrary logs, private source, production boards/traces, and participant content.
