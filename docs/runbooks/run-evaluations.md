# Run evaluations

## Credential-free replay

Frozen replay is the default. Until WP-2026-004 replaces the bootstrap, `npm run eval:replay`
returns a stable machine-readable `not_implemented` result with `claimsMeasured: false` and zero
evaluated cases. This keeps the credential-free command stable through WP-2026-002 and WP-2026-003;
it is not an evaluation pass or quality evidence.

WP-2026-004 replaces that bootstrap with a runner that accepts only versioned synthetic fixtures and
approved structured responses, produces deterministic scores, and performs no network call. Its
implementation must update this runbook, CI, the data card, and work-package evidence together.
WP-2026-004 cannot reach `Done` while the bootstrap result remains.

## Protected live evaluation

Live evaluation requires an explicit current authorization for provider spend and a protected
environment inaccessible to pull requests and forks. Use a dedicated restricted project/key,
bounded case count/output/tokens/cost, no automatic retry, and `store:false` when supported.

Raw requests and responses go only to `artifacts/live-evals/`, which is ignored and short-lived.
Do not print them to CI logs. The aggregate report includes run identity, versions, all result
categories, latency, tokens, cost basis, exclusions, and limitations, but no board reconstruction or
free-form response.

## Review

Compare against the preregistered threshold and prior compatible baseline. A regression or malformed
case follows the [eval-failure playbook](../playbooks/eval-failure.md). Human review confirms that the
aggregate projection cannot disclose a fixture or private input before committing a report.
