# WF-2026-001 — Public foundation workflow

- Work package: [WP-2026-001](../../docs/work-packages/WP-2026-001-public-repository-foundation.md)
- Date: 2026-09-03
- State: Foundation accepted and merged; follow-up closure evidence recorded
- Data classification: Public engineering summary; no conversation transcript or private source

## Human-owned intent and decisions

The maintainer selected a clean public repository, Apache-2.0 licensing, deterministic Sudoku
authority, bounded AI teaching, a private host boundary, evidence-based portfolio claims, and
separate authorization for merge, spend, deployment, invitations, and publication. Those decisions
are encoded in the charter, six ADRs, acceptance catalog, and work packages.

On 2026-09-03, the maintainer authorized proceeding after reviewing repository merge access. The
remaining repository security gates were enabled and the private authority PR followed by public
PR #1 in dependency order. The successful merge records acceptance without reproducing a
conversation transcript.

## AI-assisted roles and durable outputs

- A foundation implementer produced the initial workspace, documentation, verifiers, CI, and skill
  entrypoints from the accepted plan.
- A proof/corpus auditor inspected private behavior without copying source or puzzles and returned
  aggregate baseline, technique, compatibility, and provenance constraints that became public
  policy.
- Independent reviewers challenged architecture, work-package, privacy, and verifier assumptions.
- A fresh read-only agent received only the public repository URL, `WP-2026-001`, and the instruction
  to execute the repository-defined continuity check; it independently found the authorities,
  validated the trust boundary, and ran the credential-free checks from a fresh clone.
- The root integrator retained, revised, or rejected suggestions; corrected the tree; ran the
  reported checks; and owns the resulting pull request.

## Decisions retained or revised

- Retained: foundation-only first PR, proof-before-prose, functional core/imperative shell, exact
  runtime schemas, reference-only model output, visible safe failure, versioned evidence, generated
  fixtures, and no private-source copy.
- Revised: split `domain`, wire `contracts`, and `boundary-codecs`; made proof depend only on domain;
  restored the requested package/skill/work-package names; added TypeScript project references;
  expanded privacy, threat, retention, handoff, proof, and host-upgrade authority; and established a
  separate read-only `main` worktree before the foundation commit.
- Rejected: a collapsed proof/contracts package graph, a secret-specific public denylist, a work
  registry that could accept empty Done evidence, and any claim that a bootstrap replay command is
  an evaluation pass.

## Failures found and contained

- Review found a private infrastructure identifier embedded in an unpushed scanner rule. The rule
  was removed and the unpushed foundation commit was rewritten before any remote push, leaving only
  generic public safety patterns.
- Review found package names and dependencies that contradicted the accepted architecture. The
  machine graph, manifests, project references, documentation, and adversarial tests were corrected
  together.
- Review found that the initial work-package schema omitted required ownership, plan, data,
  interface, evidence, and append-only handoff fields. The schema and generated registry now enforce
  them, including exact statuses and one next action.
- Review found bypasses involving staged-vs-working-tree content, commit-message scanning,
  dependency aliases, bare Node imports, behavior-version identity, and syntactically shaped Done
  evidence. Adversarial tests now exercise those complete paths.
- Final audit found historical-blob, duplicate-section, lifecycle, TypeScript-remapping, local-spec,
  architecture-policy/source-closure, runtime-identity/version, endpoint-authorization,
  ambiguous-result, remote-review-state, and future-Ready deadlocks. The verifiers, work-package
  wording, and end-to-end regressions now fail closed on each case.
- A final integrity pass locked the complete CI topology and verification aggregator, disabled npm
  lifecycle hooks around installation and checks, separated runtime from development dependencies,
  and added regression coverage for indirect dynamic-code, time/random, symlink, Git-object,
  suppression-comment, sensitive-path, and source-closure bypasses.
- The first dependency-review run exposed a disabled GitHub dependency graph on the newly created
  repository. Dependency alerts and the read-only graph were enabled, the failed job alone was
  rerun, and dependency review passed.
- Before acceptance, private vulnerability reporting and Dependabot security updates were enabled
  and rechecked through GitHub's repository APIs. Security updates reported enabled and unpaused.

## Validation performed

- `npm ci` completed with zero reported vulnerabilities.
- `npm run verify` passed doctor, ESLint, docs, architecture, work-package, runtime-manifest,
  CI-policy, replay-status, index/working-tree/full-history path-and-blob public-boundary, license,
  skill, the complete validation suite, and strict project-reference TypeScript checks.
- The skill-creator `quick_validate.py` passed all five canonical skills.
- `git diff --check` passed.
- Public CI passed strict verification on Windows and Ubuntu, CodeQL, and dependency review at the
  foundation PR head.

## Fresh-agent continuity result

- Public fresh clone pinned to PR head
  `1e0ca4a4d19c04820a51e103c0492883de8bc6ef`: **Pass**.
- Governing authority found: **Pass**.
- Deterministic/provider/host/public trust boundary explained: **Pass**.
- Credential-free checks run: **Pass** — Node 22, `npm ci`, `npm run doctor`,
  `npm run docs:check`, `npm run eval:replay`, `npm run verify`, and `git diff --check`; the complete
  suite passed 69/69 tests and left the tracked tree clean.
- Correct single next action identified: **Pass** — enable and recheck private vulnerability
  reporting and Dependabot security updates before foundation acceptance; do not merge or begin
  WP-2026-002.
- Independent skill-creator validation: **Pass** for all five canonical skills.

The check records outcomes only. It contains no reasoning transcript, provider call, credential,
private source, or production data.

## Evidence and limitations

Architecture evidence: [system](../../docs/architecture/system.md),
[principles](../../docs/architecture/principles.md), and [ADRs](../../docs/decisions/).
Safety/evaluation evidence: [acceptance catalog](../../docs/acceptance/catalog.md),
[privacy policy](../../docs/privacy.md), and [evaluation policy](../../docs/evaluation/policy.md).
Delivery evidence: [foundation commit](https://github.com/memorex386/verified-sudoku-coach/commit/1e0ca4a4d19c04820a51e103c0492883de8bc6ef),
[accepted delivery head](https://github.com/memorex386/verified-sudoku-coach/commit/f781b9ae25a1ab45865c3862d230f218862a09f8),
[merged PR #1](https://github.com/memorex386/verified-sudoku-coach/pull/1),
[merge commit](https://github.com/memorex386/verified-sudoku-coach/commit/619277d4d714be49135918abd977192f2abc1d59), and
[remote checks](https://github.com/memorex386/verified-sudoku-coach/pull/1/checks).

This workflow proves only that the repository foundation is internally checked, reviewable,
accepted, and integrated. It does not prove Sudoku correctness, model quality, latency, cost,
accessibility, player benefit, or release readiness; those remain explicitly unmeasured work.
