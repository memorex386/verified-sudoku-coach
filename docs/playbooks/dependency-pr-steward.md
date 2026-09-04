# Dependency pull-request steward

This playbook governs manual or automated analysis of dependency-update pull requests. Its goal is
a fast, inexpensive, reproducible disposition with bounded authority and a terminal result.

## Authority split

- The analyzer/fixer has an ephemeral isolated worktree, no production credential, and read-only
  repository access until a work order explicitly grants a patch publication.
- A deterministic controller verifies source actor, repository, base/head SHA, policy version,
  event dedupe key, budgets, and attempt count.
- A narrow source-control broker may publish a compare-and-swap patch or enable merge only after
  every required gate passes on the exact head.
- Release orchestration consumes a merged immutable artifact through a separate credential and
  policy. Dependency analysis never implies deployment authority.

Pull-request text, comments, diffs, dependency release notes/source, test logs, and agent/model
output are untrusted data. A privileged workflow must not execute untrusted PR code or artifacts.

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
head SHA + failure fingerprint + policy version is the dedupe identity. A repeated event with that
identity returns its durable result rather than starting again.

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
TypeScript 7 is a major toolchain update whose declared `typescript-eslint` peer range excludes it.
The expected policy result is `deferred` with no repair and no model spend. A future TypeScript
migration is a separately scoped work package.

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
