---
id: ADR-0009
status: Accepted
date: 2026-09-05
---

# Bounded local adaptive conversation

The maintainer approved an adaptive local coach after trying the deterministic tutor.
This narrows ADR-0004's conversation restriction for the local generated-puzzle trial only:
one current message (280 characters) and four prior messages/accepted choice IDs may live in
server memory for at most 30 minutes. No transcript is written or logged; restarting or ending
the session clears it. The UI explains what is sent before the player connects. Arbitrary
questions are untrusted data, not instructions that can override the model's teaching bounds.
No identity, complete action history, player notes, full board or solution is sent to a provider.

The local live view may reach its own loopback gateway; the static deterministic/replay view
remains credential-free and makes no model requests. The gateway verifies board DTOs against
the one generated fixture, independently reconstructs teaching options, enforces Host/Origin
and a per-launch capability, and discards stale results. Package dependency directions stay
unchanged. Provider code and credentials never reach a browser bundle.

The model chooses from verified options and registered conversational templates. Open-ended
model prose is excluded because schema validation or a keyword filter cannot establish its
factual correctness. The model still interprets questions and adapts depth, acknowledgement
and follow-up; this is a constrained conversational coach, not a general chat assistant.

A candidate registration can be exercised only in this explicitly enabled local evaluation
shell with a bounded call grant. It is not promoted to approved, and mutable-route/default
abuse-retention limitations remain disclosed. No hosted/cohort or production admission changes.
Local prompts after inactivity or repeated mistakes only invite help; accepting an invitation
is required before inference. Closing or editing cancels pending UI delivery.

Verification: `test:adaptive`, runtime manifest checks, architecture checks, adversarial frozen
choices and browser recovery tests. Human/live quality remains unmeasured until authorized.
