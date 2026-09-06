# Adaptive local AI coach

After trying and merging the [local tutor](plans/VSC-PLAN-2026-09-05.3.md), the maintainer chose
an adaptive AI interaction before private/production integration. This amendment permits the
next narrow slice in WP-2026-003: one candidate teacher, one loopback gateway, short session
context, free-text player questions, verified teaching choices, and dismissible help invitations.

The model interprets the current question, help preference, coarse recent progress and the last
four questions/accepted teaching choices. It chooses a registered acknowledgement, verified
lesson depth and follow-up. It cannot supply arbitrary factual prose or new cells/digits.
Conversation is bounded and transient, not a persistent learner profile. See
[ADR-0009](../decisions/0009-local-adaptive-coach.md) for this local-only clarification.

Use the existing candidate OpenAI teacher profile (`gpt-5.6-terra`, medium reasoning, at most
768 output tokens and 10 seconds). No alternate provider or framework is added. Register exact
prompt/schema/renderer/proof/eval hashes before inference. Candidate use is isolated local
evaluation, never approved cohort composition. Live mode stays off by default and needs a local
key plus an explicit call grant, at most 20 calls per launch. Reserve $0.05 per attempted call
under the documented conservative bound; no automatic retry or refund of failed attempts.
Live calls are not authorized by this implementation approval.

A local invitation may appear after two incorrect accepted entries or 45 seconds without a
move, only while the page is visible. Dismissal silences invitations for the session. Invitation
creation is deterministic and costs nothing; only accepting help or sending a question can call
the model. Editing, closing, or cancelling discards pending output. No background model observer.

Implement `npm run dev:ai-tutor` and `npm run test:adaptive`. Preserve `dev:tutor` as the
credential-free deterministic preview. Require frozen synthetic positive/adversarial response
checks, mocked provider and HTTP boundary checks, browser interaction checks, package snapshots,
and full `npm run verify`. These establish wiring and rejection behavior, not live model quality,
latency, learning, or full six-technique/private conformance. Later work packages stay Draft.

The next decision after the implementation PR is a bounded owner-only live trial with provider
spend explicitly authorized. No merge, deployment, accounts, private corpus, new techniques,
voice, persistence, comparative-provider study or production exposure is included.
