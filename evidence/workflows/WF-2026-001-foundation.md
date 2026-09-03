# WF-2026-001 — Public foundation workflow

- Work package: [WP-2026-001](../../docs/work-packages/WP-2026-001-public-repository-foundation.md)
- Date: 2026-09-03
- State: Local validation and fresh-agent continuity complete; maintainer review and pull request remain
- Data classification: Public engineering summary; no conversation transcript or private source

## Human-owned intent and decisions

The maintainer selected a clean public repository, Apache-2.0 licensing, deterministic Sudoku
authority, bounded AI teaching, a private host boundary, evidence-based portfolio claims, and
separate authorization for merge, spend, deployment, invitations, and publication. Those decisions
are encoded in the charter, six ADRs, acceptance catalog, and work packages.

## AI-assisted roles and durable outputs

- A foundation implementer produced the initial workspace, documentation, verifiers, CI, and skill
  entrypoints from the accepted plan.
- A proof/corpus auditor inspected private behavior without copying source or puzzles and returned
  aggregate baseline, technique, compatibility, and provenance constraints that became public
  policy.
- Independent reviewers challenged architecture, work-package, privacy, and verifier assumptions.
- A fresh read-only agent received only the repository locator, `WP-2026-001`, and the instruction
  to execute the repository-defined continuity check; it independently validated the five skills.
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

## Validation performed

- `npm ci` completed with zero reported vulnerabilities.
- `npm run verify` passed doctor, ESLint, docs, architecture, work-package, runtime-manifest,
  CI-policy, replay-status, index/working-tree/full-history path-and-blob public-boundary, license,
  skill, the complete validation suite, and strict project-reference TypeScript checks.
- The skill-creator `quick_validate.py` passed all five canonical skills.
- `git diff --check` passed.

## Fresh-agent continuity result

- Governing authority found: **Pass**.
- Deterministic/provider/host/public trust boundary explained: **Pass**.
- Credential-free checks run: **Pass** — `npm run doctor`, `npm run verify`,
  `npm run eval:replay`, `npm run docs:check`, `npm run skills:check`, and `git diff --check`.
- Correct single next action identified: **Pass** — open the WP-2026-001 foundation PR for explicit
  maintainer acceptance; do not begin WP-2026-002.
- Independent skill-creator validation: **Pass** for all five canonical skills.

The check records outcomes only. It contains no reasoning transcript, provider call, credential,
private source, or production data.

## Evidence and limitations

Architecture evidence: [system](../../docs/architecture/system.md),
[principles](../../docs/architecture/principles.md), and [ADRs](../../docs/decisions/).
Safety/evaluation evidence: [acceptance catalog](../../docs/acceptance/catalog.md),
[privacy policy](../../docs/privacy.md), and [evaluation policy](../../docs/evaluation/policy.md).

This workflow proves only that the repository foundation is internally checked and reviewable. It
does not prove Sudoku correctness, model quality, latency, cost, accessibility, player benefit, or
release readiness; those remain explicitly unmeasured work.
