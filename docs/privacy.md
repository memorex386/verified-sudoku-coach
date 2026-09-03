# Privacy and data policy

Verified Sudoku Coach minimizes data by architecture. Public source, generated puzzles, synthetic
replays, and reviewed aggregate evaluation reports contain no participant identity or production
trace content.

## Runtime minimization

The model receives one bounded packet containing only coarse struggle/progress signals and opaque
references to currently verified opportunities or the selected proof. It receives no Firebase UID,
name, email, phone, employer, IP address, unrelated game history, full conversation, or private
puzzle-library identifier. Provider request storage is disabled where supported.

## Private pilot data

Sudoku World owns linked-account consent, access, retention, withdrawal, and deletion. Raw boards,
notes, actions, model requests/responses, timings, and validator outcomes may exist privately for at
most 30 days under a UID; they never enter this repository, public CI, product logs, or analytics.
Optional feedback may be quoted anonymously only under disclosed consent and opt-out. Named
attribution requires separate explicit approval.

At cohort close, reviewed aggregates may be sealed with denominators, windows, exclusions, and
limitations. Consent states that sealed non-identifying aggregates cannot be unwound after raw data
is deleted. Follow the [retention and deletion runbook](runbooks/retention-and-deletion.md).

## Incidents and changes

Any suspected disclosure stops publication and follows the
[incident runbook](runbooks/incident-response.md). Provider policy, payload, retention, purpose, or
data-category changes require a privacy review, contract/eval updates, and explicit human approval
before live use.
