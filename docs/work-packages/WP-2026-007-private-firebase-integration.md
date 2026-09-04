---
id: WP-2026-007
title: Private Firebase integration
status: Draft
depends_on: WP-2026-006
owner: Maintainer
base_branch: main
accepted_plan: VSC-PLAN-2026-09-04.2
data_classification: Public metadata only
acceptance: VSC-ARCH-005, VSC-PRIV-002, VSC-PRIV-003, VSC-OPS-001, VSC-OPS-002, VSC-UX-003
updated: 2026-09-04
---

# Private Firebase integration

## Goal

Consume immutable public artifacts in thin Coach HTTP adapters with private auth, consent, session
sequencing, compare-and-swap persistence, budgets, kill switch, retention, deletion, and emulator
coverage.

## User value

An invited reviewer can use coaching without trusting the client for access, correctness, cost, or
privacy controls, while the public core remains the single factual/application authority.

## Non-goals

No Angular experience, deployment, production spend, invite issuance, public private-source copy,
Firestore client access, unbounded trace, silent fallback, or admin operation exposed as public API.

## Governing ADRs

Public ADR-0004 and ADR-0005 plus Sudoku World ADR-0015, private business/configuration gates, data
model, Coach architecture, privacy, retention/deletion, incident, and pilot runbooks.

## Allowed edit surface

The private Sudoku World work package owns Functions Coach routes/adapters, Firestore indexes/rules,
Secret Manager composition, repositories/ledgers/telemetry, jobs/admin tooling, compatibility pins,
emulator tests, and matching private docs. This public file receives version/evidence metadata only.

## Affected interfaces

`redeemCoachInvite`, `getCoachAccess`, `startCoachSession`, `observeCoachAction`,
`completeCoachSession`, `submitCoachSurvey`, `withdrawCoachData`; session repository, budget ledger,
trace/telemetry, kill switch, catalog, retention, and administrative operations.

## Architecture and privacy invariants

Every call authenticates/authorizes; clients never access Firestore directly. No transaction spans a
model call. Invite tokens are one-use and hashed; budget reservation/reconciliation is atomic;
errors are bounded codes. Full traces remain UID-linked, IAM-restricted, and expire within 30 days;
public evidence is aggregate only.

The endpoint authorization matrix is:

| Endpoint | Additional authority after Firebase auth + approved web App Check |
| --- | --- |
| `redeemCoachInvite` | Valid unconsumed invite token; no session capability |
| `getCoachAccess` | Caller-owned access/consent lookup; no active invite or session capability |
| `startCoachSession` | Redeemed unexpired entitlement plus current consent; issues the session capability |
| `observeCoachAction` | Account/session-bound capability, current consent/entitlement, command ID, and expected board revision |
| `completeCoachSession` | Account/session-bound capability, current consent/entitlement, command ID, and expected board revision |
| `submitCoachSurvey` | Account/session-bound capability and idempotency ID for the completed session |
| `withdrawCoachData` | Caller identity only; no active invite, entitlement, session, or board revision |

## Acceptance criteria

All cited gates and the existing business-foundation gate pass before production model spend or
exposure. Coach starts disabled. Rate limits, 500-event cap, idempotency, concurrency, $250 guard,
kill switch, consent/withdrawal/deletion, CORS, and public-release parity have emulator evidence.
Every public call requires Firebase auth and approved web App Check. Capability requirements follow
the matrix above rather than applying to bootstrap or withdrawal. Tests deny missing/wrong/native
App Check; reused/expired/revoked invites; revoked, cross-account, or stale session capabilities;
and stale board revisions. They also prove authenticated withdrawal still succeeds after entitlement
and session revocation.

## Validation

From the public repository root, run:

```powershell
npm ci
npm run pack:smoke
npm run release:verify
npm run verify
```

From private Sudoku World `firebase/functions`, run the existing credential-free baseline plus the
Coach suites added by this package:

```powershell
npm ci
npm run lint
npm run build
npm run build:scripts
npm test
npm run test:emulator
```

During implementation, make these planned private-root commands executable and run them before
`Done`:

```powershell
node scripts/ops/verify-coach-release-parity.mjs
node --test scripts/ops/lib/*.test.mjs scripts/ops/*.test.mjs
node scripts/ops/verify-business-docs.mjs
node scripts/ops/verify-engineering-docs.mjs
git diff --check
```

The emulator suite must cover auth, web-only App Check entitlement, the endpoint authorization
matrix, invite redemption/reuse/expiry/revocation, rate limit, CAS, idempotency, stale calls,
revoked/cross-account capabilities, budget races, withdrawal after revocation, deletion/expiry,
deny-all rules, redacted logs, endpoint inventory, and disabled-by-default configuration.

## Delivery evidence

No implementation evidence exists because this package has not started; private evidence will be
referenced only by safe PR/release identifiers and aggregate compatibility results.

## Known limitations and blockers

WP-2026-006 and Sudoku World's accepted core business-foundation gate are incomplete. A billed OpenAI
project/service credential and deployment authorization are intentionally absent.

## Next action

- Refine private endpoint and persistence contract tables without configuring credentials or production resources.

## Checkpoints

Implementation has not begun; append dated public-safe checkpoints only after the package becomes In progress.
