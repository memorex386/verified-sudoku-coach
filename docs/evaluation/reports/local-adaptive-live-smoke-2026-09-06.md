# Local adaptive coach live smoke check

On 2026-09-06 the maintainer authorized an owner-only local trial of at most 20 attempted
OpenAI calls with a $1 planning budget. Three agent-operated browser requests exercised the
local app at commit `0000454166627a07e7bbdcb41822d70179d7c6ef`, associated with
[PR #22](https://github.com/memorex386/verified-sudoku-coach/pull/22).

The runtime used candidate `local-adaptive-teacher-v1`, behavior version 1.0.0, and the
manifest-pinned prompt, schema, renderer, proof policy and authored evaluation suite at that
commit. Requested and adapter-validated returned model: `gpt-5.6-terra`; medium reasoning,
768 maximum output tokens, 10-second deadline, no tools, no automatic retry, `store:false`.
The separate Luna playground draft did not change the local registration or issue a test call.

| Browser scenario | Observed result |
| --- | --- |
| Request a small hint without the answer | Accepted nudge; highlighted the verified target without placing a value |
| Ask why the hint works | Accepted explanation; displayed verified exclusions and the remaining digit |
| Ask for space | Accepted pause and autonomy acknowledgement |

All three responses passed the adapter's exact model/output checks and the gateway's current
board and allowed-choice validation before rendering. The filled-cell count remained unchanged;
the player retained control of moves. These are three successful interaction smoke checks on
one generated local puzzle, not a statistical quality, learning, full proof or production claim.
The pause observation establishes the response choice and displayed acknowledgement only.

No exact latency, token usage, billed cost, service tier or provider retention outcome was
captured. No raw questions, responses, credentials, private boards or account details are retained
in this report. The frozen authored evaluation report remains unchanged and is not live evidence.

At the end of these checks, 3 of the authorized 20 attempts had been consumed, leaving 17 in
the running server. This is a dated accounting checkpoint, not a replenishable allowance or a
claim about later user activity. Any restart must honor the remaining total across launches.
No merge, deployment, production exposure or billing change was performed or authorized here.
