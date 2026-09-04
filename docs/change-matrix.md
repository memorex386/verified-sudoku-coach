# Change matrix

Use this matrix before opening a pull request. “Also update” means the companion work belongs in
the same change unless the work package explicitly stages it later.

| Change | Also update or verify |
| --- | --- |
| Any code, workflow, or documentation policy | Work package, focused tests/checks, `npm run verify`, PR validation evidence, and limitations |
| Public contract or serialized field | Runtime schema, version policy, compatibility fixtures, consumer notes, and contract documentation |
| Proof technique or candidate semantics | Proof invariants, positive/near-miss/property/metamorphic tests, canonical ordering, and eval dataset coverage |
| Coaching policy, validator, or factual renderer | Contract version when affected, adversarial fixtures, frozen eval comparison, and visible failure/recovery tests |
| Runtime prompt, model, output schema, or inference setting | Runtime manifest, prompt/schema hash, before/after eval report, cost/latency evidence, and approval status |
| Provider profile, adapter, or live-eval behavior | Provider-policy digest, capability/data-handling review, browser-boundary patterns, conformance/mocked transport tests, redaction/failure tests, comparative evaluation, and protected workflow review |
| Agent adapter, entrypoint, or tool protocol | Canonical source pointer, exact manifest/capabilities, least-privilege work-order tests, stale/hostile-input fixtures, real identity provenance, and no duplicated policy |
| Automation trigger, attempt, merge, deploy, or rollback policy | Exact machine policy, source/SHA/dedupe tests, finite terminal paths, separated credentials/approvals, shadow evidence, and incident/notification behavior |
| Evaluation fixture or threshold | Data-card provenance, suite version, held-out split integrity, baseline invalidation decision, and report limitations |
| Replay UI or hosted artifact | Static-only boundary, accessibility checks, truthful replay labeling, production build, and release manifest |
| Data collection, retention, telemetry, or publication | Trust boundaries, privacy threat review, deletion/expiry behavior, aggregate schema, and prohibited-data tests |
| Dependency or licensed asset | Lockfile, vulnerability/license scan, provenance record, and required notices |
| Architecture exception | Accepted ADR and updated machine-enforced dependency policy before the exception lands |
| Agent rule, runbook, or skill | Canonical source, every pointer/adaptor, skill validation, docs link check, and workflow CI when behavior changes |
| Public release | All acceptance gates, immutable evidence manifest, sanitized aggregate report, explicit authorization, and post-publish verification |
| Private Sudoku World integration | Exact public tag/commit and integrity pin, compatibility tests, private architecture/data/privacy docs, and no private code copied here |

No documentation, passing check, or accepted work package authorizes a live provider call, merge,
deployment, beta exposure, or publication by itself.
