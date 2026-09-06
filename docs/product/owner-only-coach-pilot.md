# Proposed owner-only hosted coach

Status: proposed implementation contract for maintainer review. This follows the merged
[local adaptive milestone](local-adaptive-milestone.md) and its
[three live smoke checks](../evaluation/reports/local-adaptive-live-smoke-2026-09-06.md).
It does not change the accepted local-only scope, promote a candidate registration, satisfy
private conformance, or authorize deployment or hosted spend.

## Smallest useful experience

Let the maintainer sign in on the host product and open a separate, clearly labeled experimental
coach screen containing the same original generated puzzle and verified single-hint flow tried
locally. Reuse the question box, depth preference, highlights and explicit help invitations.
Ordinary puzzles, account progress, native bridge methods and existing hint behavior are untouched.
Keep one teacher and existing settings; a playground draft is not a runtime model change.

This tests authenticated hosted AI interaction with the current puzzle. Coaching ordinary host
boards is a later integration step and still requires the private aggregate compatibility gate.
The generated-puzzle restriction does not itself waive the current private-integration gate.

## Admission decisions required before implementation

Accept this narrow hosted milestone in the governing plan and an ADR before starting its code.
That acceptance must explicitly permit all three departures from today's local-only authority:

1. A single-owner hosted evaluation screen using only the unchanged public generated fixture,
   without importing or replacing private puzzle or solver behavior. Defer private conformance
   for this screen only; retain it for real host boards, parity claims and full proof acceptance.
2. Candidate model admission for this bounded owner evaluation only, with the mutable-route and
   provider-retention limitations disclosed. Do not promote the registration to approved or
   loosen reviewer/cohort admission.
3. Consumption of reviewed, integrity-checked development artifacts from an exact merged public
   commit in the private host. This is not a general package release or a completed release gate.

The private host must record the corresponding owner-evaluation scope in its own authority.
This proposal does not reorder its broader commercial coaching or Academy roadmap. Deploying,
enabling an account and authorizing hosted provider spend remain separate final actions after
implementation and review; the existing local trial grant does not transfer to hosting.

## First implementation PR: authenticated gateway, default off

Implement in the private host with mocked inference and local auth/database emulators first.
Consume browser-safe and Node artifacts from the same exact public commit and record archive
integrity; do not copy a fork of public source. Keep the provider adapter on the server.

The host owns these controls:

- Verify a Firebase ID token for the configured project, then match one exact server-configured
  owner UID before creating a session, reading its metadata or reserving a call. Missing enable
  configuration, owner identity or provider secret leaves AI disabled. A hidden UI button or
  localhost capability is not authentication. UID/configuration values stay private.
- Restrict origins to the configured app origin and explicit local emulator origin, reject
  unexpected routes and bodies, and use the existing exact coach DTO decoders. Treat the board
  as untrusted and validate it against the one public fixture. No arbitrary puzzle selection.
- Retain the existing maximum 280-character question, four transient prior question/choice
  pairs, 30-minute session expiry, 16,000-byte provider request, 768-token output and 10-second
  provider deadline. Reconstruct allowed choices and recheck the fingerprint before display.
- Preserve at most one in-flight call per owner and the 2.5-second cadence across instances.
  Reserve attempts transactionally before provider dispatch; retries with the same attempt ID
  never dispatch twice. A crash after reservation consumes the attempt. Never refund or retry
  automatically. An expired in-flight lease can unblock a new attempt, not redispatch the old one.
- Use one explicitly provisioned trial ID with a finite expiry, at most 20 attempts and a $1
  planning reserve. Counters survive restarts, session changes and concurrent requests. No daily
  refill or implicit new trial. A reservation of $0.05 per attempt is accounting, not a provider
  billing cap; recheck prices before authorizing a hosted trial. A disabled or expired trial
  rejects before inference. Account-only access does not replace the spend counter.
- Persist only owner-bound session/attempt identifiers, timestamps, current revision/fingerprint,
  reservation counts and bounded status codes needed for authorization and deduplication.
  Never persist questions, responses, notes or boards. Keep question context transient; if it is
  lost on a cold start, visibly request reconnection rather than inventing context or replaying
  an earlier provider call. Reject expired records synchronously, independently of TTL cleanup.
- Keep provider credentials in the host's server secret facility. Logs and exceptions expose
  only bounded codes; no token, key, prompt, model response, board or account identity in logs.
  All durable records stay server-only; client database permissions remain unchanged.

Use the existing local session/state/turn/cancel/end semantics behind host authentication;
the local capability header must not become a hosted credential. Bind every operation to both
authenticated owner and session. A state update or cancellation invalidates outstanding delivery
even if provider cancellation cannot be guaranteed. A late response cannot overwrite a newer
revision. Ending a session drops its transient context and never resets the trial counter.

Before opening that PR, tests must demonstrate:

- Missing/invalid tokens, another authenticated user, wrong session owner, disabled configuration,
  unknown origin and an arbitrary puzzle all cause zero provider dispatches.
- Concurrent requests, duplicate attempts, process restarts, expired sessions/trials and a crash
  after reservation cannot exceed the grant or create a second dispatch for the same attempt.
- Model rejection, provider failure, timeout, cancellation and stale-board delivery preserve
  playable state and explicit recovery. The client can always use deterministic help.
- Sentinel credentials and conversation content are absent from browser artifacts, persistence
  and logs. Empty configuration makes the emulator path non-billable.

The private implementation must add `npm run test:coach-owner-alpha` in its Functions workspace
for these focused tests, plus the host's existing backend build/test checks and required contract
documentation. There is no deployment in this PR. Public validation remains `npm run verify`.

## Second implementation PR: private experimental screen

Add one authenticated owner-only entry point, consume the same pinned browser artifact and wire
the existing interaction to the authenticated gateway. The screen labels the fixed puzzle and
temporary AI session, explains provider data sharing, and has an explicit connect/end action.
No automatically paid observation loop. Verify a non-owner cannot access either UI or API,
expired authentication pauses AI, and changing the board discards old guidance. Run the host's
web tests, lint and production build. Stop at its PR, with configuration still disabled.

## Final activation checkpoint

Present the reviewed commits, exact owner configuration held privately, secret reference,
same-origin route, trial ID/expiry/attempt cap, measurement limits and rollback command for
explicit deployment and hosted-spend authorization. Enable only after backend and UI are ready.
Verify a non-owner rejection and one owner interaction; disable the server switch for rollback.
Do not report the experiment as a generally available coach or reopen the local trial allowance.

Excluded: ordinary puzzle integration, additional techniques, multiple models, subscriptions,
mastery profiles, saved chat, lesson authoring, voice, broader rollout and native store releases.
