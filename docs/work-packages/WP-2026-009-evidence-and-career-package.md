---
id: WP-2026-009
title: Evidence seal and career package
status: Draft
depends_on: WP-2026-008
owner: Maintainer
base_branch: main
accepted_plan: VSC-PLAN-2026-09-03.1
data_classification: Public
acceptance: VSC-PRIV-004, VSC-EVID-002
updated: 2026-09-03
---

# Evidence seal and career package

## Goal

Seal reviewed cohort aggregates, verify raw-data deletion, and produce the final technical case
study, architecture visual, walkthrough video, LinkedIn post, resume bullet, and recruiter evidence
map.

## User value

Hiring reviewers receive a concise, verifiable story of production-minded AI orchestration and
AI-assisted engineering, with each claim traceable to evidence and each limitation visible.

## Non-goals

No raw trace/response/feedback publication, named participant attribution without separate consent,
hidden reasoning transcript, causal learning claim, fabricated result, whole-app open-source claim,
or automatic publication.

## Governing ADRs

ADR-0005 and ADR-0006; product charter; privacy and provenance policies; evaluation/reporting and
retention/deletion runbooks; acceptance and release evidence contracts.

## Allowed edit surface

Reviewed aggregate JSON and generated summaries, evidence map, final case-study and career assets,
release manifests, public visuals/video source, corrections/limitations, and safe links to public
PRs/releases/tests. Private deletion verification remains private and is summarized as status only.

## Affected interfaces

Aggregate report schema, evidence-map entries, release/case-study manifest, recruiter README,
walkthrough asset, LinkedIn draft, resume bullet, quotation permissions, and correction log.

## Architecture and privacy invariants

Machine-readable aggregates are authoritative and include exact n/N, window, exclusions, versions,
and limitations. Public statements distinguish deterministic correctness, model behavior, reviewer
opinion, and business impact. Sealed aggregates cannot be unwound; raw account-linked data is
verified deleted on schedule.

## Acceptance criteria

Every claim resolves to a reproducible artifact and passes public/privacy review. Pilot thresholds
are reported pass or fail without moving them; unmet goals remain goals. The package accurately says
verified AI orchestration rather than model training and identifies agent contributions by task and
verified outcome, not transcript.

## Validation

During implementation, make these planned exact public-root commands executable and run them before
`Done`:

```powershell
npm ci
npm run evidence:generate
npm run evidence:check
npm run release:verify
npm run verify
```

From the private Sudoku World repository root, run the read-only post-cohort evidence checks created
by the private pilot package:

```powershell
node scripts/ops/verify-coach-pilot-seal.mjs --check
node scripts/ops/verify-coach-deletion.mjs --check
node scripts/ops/verify-business-docs.mjs
node scripts/ops/verify-engineering-docs.mjs
git diff --check
```

The commands must reproduce Markdown/video inputs from reviewed aggregate manifests and validate
every link/hash, denominator, consent/quotation permission, deletion-status statement,
accessibility, license/provenance, secret/history boundary, and clean-clone result.

## Delivery evidence

No result or career artifact evidence exists because this package has not started.

## Known limitations and blockers

WP-2026-008 and cohort close are incomplete. Publication of aggregates, case study, video, LinkedIn text,
or resume claim requires explicit human review and authorization after privacy checks.

## Next action

- Define the evidence-map and claim-taxonomy schema so future results cannot bypass required sources and limitations.

## Checkpoints

Implementation has not begun; append dated checkpoints only after the package becomes In progress.
