# Dependency pull-request steward

This playbook governs manual or automated analysis of dependency-update pull requests. Its goal is
a fast, inexpensive, reproducible disposition with bounded authority and a terminal result.

## Authority split

- The analyzer/fixer has an ephemeral isolated worktree, no production credential, and read-only
  repository access until a work order explicitly grants a patch publication.
- A trusted host adapter authenticates the event source and resolves the current repository,
  base/head SHA, and actor/app identity. A deterministic controller exact-decodes that envelope,
  compares its allowlisted values, and verifies policy version, event dedupe key, attempt count,
  persisted workflow/phase, and granted stage capability.
- A narrow source-control broker may publish a compare-and-swap patch or enable merge only after
  every required gate passes on the exact head.
- Release orchestration consumes a merged immutable artifact through a separate credential and
  policy. Dependency analysis never implies deployment authority.

Pull-request text, comments, diffs, dependency release notes/source, test logs, and agent/model
output are untrusted data. A privileged workflow must not execute untrusted PR code or artifacts.
The controller does not authenticate GitHub. A narrow live trigger adapter must validate the host
signature/app and actor, query the current pull-request identity, then construct the exact trusted
event envelope. The controller derives dependency/risk facts from exact before/after manifests,
bounded diff metadata, and normalized check evidence inside its entrypoint; a caller cannot supply
an `eligible` decision or mark itself safe. The public fixture uses a synthetic receipt digest and
does not prove host authentication. Persisted state is exact-decoded untrusted input even when its
CAS revision happens to match.

## Finite decision flow

```text
received
  -> source-verified
  -> deterministic-classification
       -> deferred | escalated
       -> diagnosis
            -> repair-once
            -> local-verified
            -> patch-published-with-head-CAS
            -> CI-on-exact-SHA
            -> awaiting-approval | auto-merge-ready
            -> merged
            -> post-merge-verified
            -> completed
```

One inexpensive diagnosis and one stronger escalation are the maximum model route. One repair and
one rerun for a deterministically recognized infrastructure failure are allowed. Repository + PR +
base SHA + head SHA + failure fingerprint + policy version is the replay/dedupe identity. After
pure identity derivation and before any model or mutation effect, a repeated event with that
identity returns its durable result rather than starting again.

The failure fingerprint is a SHA-256 over sorted normalized risk codes and required-check outcomes;
a clean pre-check uses a defined `no-failure` sentinel. It never hashes arbitrary raw logs into
public evidence. The controller also owns a stable lineage ID for the originating pull request and
policy activation. A changed SHA or normalized outcome can create a new work order, but repair-
created heads and fingerprints inherit the same cumulative attempt ledger. Only an explicitly new
pull request or human-approved policy activation can begin another lineage.

Assessment and repair require distinct work-order capabilities. If a repair creates or publishes a
new head, the current work order ends stale; CI, approval, and merge resume only from a new
authenticated event and exact-head work order. A successful local repair is never authority to
continue against the changed repository identity.

The analyzer never uses `--force`, `--legacy-peer-deps`, broad version overrides, test deletion,
gate weakening, or unrelated upgrades to manufacture a green result.

## Initial merge eligibility

The checked-in [`automation policy`](../../config/automation-policy.json) begins in `shadow` mode.
Future activation requires a separate
accepted policy change, enforced required checks, and evidence from frozen/adversarial plus shadow
runs. Initial eligibility is deliberately limited to:

- exact verified `dependabot[bot]` source;
- an existing npm development dependency;
- a semver patch update;
- only the approved manifest and lockfile;
- no source, workflow, action, script, compiler/build tool, runtime dependency, new direct package,
  peer conflict, lifecycle hook, license change, vulnerability increase, or public-claim change;
- clean install with lifecycle scripts disabled, full repository verification, Windows and Ubuntu
  CI, dependency review, code scanning, and current-head comparison.

Any AI-authored repair requires human review during the evidence phase. Major updates, runtime or
toolchain changes, GitHub Actions, security-sensitive surfaces, native dependencies, peer conflicts,
unknown licenses, or missing telemetry terminate as `deferred` or `escalated`.

## Rollout stages

| Stage | Allowed behavior | Promotion evidence |
| --- | --- | --- |
| Local fixture | Classify recorded/synthetic input; no network mutation | Deterministic and adversarial tests |
| Shadow check | Inspect a live PR read-only and publish a check only with a separate grant; never patch or merge | Correct disposition, cost, latency, false-positive/negative review |
| Assisted repair | Publish one compare-and-swap patch after approval; human still merges | Local/remote exact-SHA checks and reviewed repair history |
| Narrow auto-merge | Merge only an unchanged eligible patch with every protected check green | Separately accepted policy version and sustained shadow evidence |
| Release steward | Consume the merged immutable artifact under separate release/deploy grants | Rehearsed verification and one-rollback path; production remains human-gated during the evidence phase |

Promotion changes policy; it is never inferred from a streak of green runs. Revocation or kill
switch takes effect before the next side effect and ends active work at a terminal state.

## Model route

Classify deterministic evidence first. Invoke no model for a known peer-range conflict, unsupported
runtime, forbidden change class, stale SHA, or failed prerequisite. If ambiguity remains, pass a
sanitized evidence packet to the registered inexpensive diagnosis profile. A deterministic policy
may invoke one stronger profile; the first model cannot select or spawn it. Structured output is
validated before any patch is considered.

## Local and remote verification

Use the repository-pinned runtime/package manager and a clean checkout. Run the update ecosystem's
native resolver without bypass flags, then every declared work-package/change-class check. CI must
run on the exact candidate SHA. A passing security or dependency-review job does not replace
install, build, typecheck, or test evidence.

PR [#2](https://github.com/memorex386/verified-sudoku-coach/pull/2) is the first public fixture:
TypeScript 7.0.2 is a major toolchain update whose declared `typescript-eslint` peer range excludes it.
The expected policy result is `deferred` with no repair and no model spend. A future TypeScript
migration is a separately scoped work package.

Run its credential-free recorded fixture with:

```powershell
npm run automation:fixture
```

The command emits bounded machine-readable decision/counter evidence only. It makes no network call
and does not reproduce raw CI logs or PR prose.

## Release and rollback boundary

The dependency steward stops after merge and post-merge verification. A future release steward
builds once, promotes the identical hashed artifact, and keeps production human-gated during the
evidence phase. Reversible static deployments may later receive bounded policy authority.

Patch publication, merge, release promotion, production deployment, and rollback use distinct
grants and credential classes. One deployment and one rollback are the maximum. Failed or timed-out verification restores the
last-known-good immutable artifact once, verifies restoration once, then stops and escalates. There
is no automatic production fix-forward loop. Functions, rules, data/schema migrations, secrets,
and native-store releases remain outside automatic rollback eligibility.

## Notification and evidence

The GitHub check/comment is canonical. A thread or email adapter reports meaningful state changes,
completion, required approval, rollback, or terminal escalation; unchanged monitoring is quiet.
Publish a sanitized execution record with decision/risk codes, real adapter/model identity,
attempts, cost/latency, commands/results, SHAs, CI links, and limitations. Never publish raw model
content, chats, private reasoning, secrets, or arbitrary logs.
