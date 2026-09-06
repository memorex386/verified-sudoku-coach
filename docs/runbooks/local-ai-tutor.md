# Try the adaptive local coach

This is the [accepted local milestone](../product/local-adaptive-milestone.md), built on the
merged deterministic tutor. It is a candidate evaluation shell, not a production service.

```powershell
npm ci --ignore-scripts
npm run dev:ai-tutor
```

Open `http://127.0.0.1:4174`. Live AI is disabled by default. The board and deterministic
Get help still work, and Connect AI explains when no live grant is configured. Port 4173's
`dev:tutor` remains a separate deterministic-only preview. Restart after changing sources.

## Live trial, only after explicit provider-spend authorization

Use a local process environment key; never paste it into chat, a browser field or a tracked file.
After approval, set `OPENAI_API_KEY` through your local secret mechanism and set
`COACH_LOCAL_EVAL_CALLS` to an integer from 1 through 20 before launching the command above.
Unset the grant or use 0 to disable calls. The key is read only in the server process.
No `.env` loader, provider SDK, automatic retry or alternate provider is used.

The registered candidate is OpenAI `gpt-5.6-terra`, with medium reasoning, at most 768 output
tokens and a 10-second deadline. The request uses strict structured output, no tools, and
`store:false`; the returned model must match the requested route or the reply pauses. That
mutable route and default provider abuse retention are not approved cohort guarantees.
`store:false` is not Zero Data Retention. Official sources checked 2026-09-05:
[model](https://developers.openai.com/api/docs/models/gpt-5.6-terra),
[structured output](https://developers.openai.com/api/docs/guides/structured-outputs), and
[data controls](https://developers.openai.com/api/docs/guides/your-data).

The server has one launch-wide grant, one in-flight call, and at least 2.5 seconds between
attempts. Every attempted call consumes one unit, including timeouts/rejections/cancellations;
ending or restarting a browser session does not refill it. Restarting the server creates a
new grant and therefore requires honoring the authorized run's total externally. Maximum
provider request body is 16,000 UTF-8 bytes. At the checked $2/M input and $12/M output rates,
$0.05 per attempt is a conservative planning reserve, not a provider billing cap or measured
cost. A 20-attempt trial reserves $1; recheck prices before authorization. No paid run has been
measured by the committed frozen report.

## Interaction

Connect AI after reading the disclosure. Ask a short question or use Why?, Smaller step, or
Give me space. Choose Small hints to prohibit full explanations, let the coach choose, or
request an explanation. The model interprets your question and chooses a verified lesson,
acknowledgement and follow-up. It does not generate unrestricted factual prose. References,
cell highlights and digits are rendered by deterministic code; it never plays a move.

The server receives the current exact board DTO, validates it against the single original
fixture, and independently reconstructs the allowed lesson choices. The provider receives only
those choices, coarse progress/mistake counts, the current question and four earlier
question/accepted-choice pairs. It receives no full board, solution, notes, identity, complete
action history or unrelated game. Questions are limited to 280 characters; keep personal
information out. Up to four local sessions expire after 30 minutes. End chat clears server
conversation memory and visible chat; restart clears everything. No content is logged or saved.

While connected, a small invitation can appear after 45 seconds without a move or two incorrect
accepted entries. It never triggers a model call. Dismiss it to silence invitations for that
session. The browser does not prompt while hidden. Only sending a question or accepting help
initiates inference. Board changes, closing a hint, or Cancel reply invalidate pending output.
Late replies are discarded. Refusals, budget/deadline failures and invalid decisions visibly
pause AI; explicit retry or the deterministic Get help button are the recovery paths.

The gateway binds numeric loopback only, requires exact Host/Origin and a per-launch random
capability on all POST requests, grants no CORS, bounds bodies and routes, and never accepts a
browser-selected model. Its capability is ephemeral HTML state, not a provider credential.
This is protection for a local development shell, not account authentication or deployment.

## Verification and handoff

`npm run test:adaptive` exercises 12 frozen authored choices, schema/semantic rejection,
mocked provider transport, redacted errors, cancellation/deadline, hostile HTTP access,
budget/cadence, short memory, stale boards, browser chat, invitation silence and end-session
cleanup. `npm run verify` also runs the deterministic full playthrough, packed Node/Chromium
consumer checks, schema/API drift and repository policies. The adapter/gateway themselves are
local Node workspaces, not published library artifacts.

The frozen report has no preceding adaptive model baseline, no sampled model output, and no
live latency, cost, learning or private conformance claim. Mocked browser calls test wiring only.
Run the bounded owner trial next, after explicit spend authorization; do not represent this
local implementation as a tested production AI coach. Rollback is a revert and server restart;
there is no persistent data migration.
