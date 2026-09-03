# Local gateway guidance

Read the active work package, [runtime-AI runbook](../../docs/runbooks/change-runtime-ai.md), and
[threat model](../../docs/security/threat-model.md). Bind only to loopback by default, accept a key
from the local process environment, and never serialize, log, return, persist, or bundle it. Bind a
numeric loopback address, enforce exact Host and configured Origin allowlists, never emit wildcard
CORS, and require an unpersisted per-launch capability header. Allowlist routes and requested model
profiles; bound body/output/cadence before any provider call. Tests must prove hostile Origin/Host,
DNS-rebinding names, missing/wrong capability, unsupported routes/models, and oversized bodies cause
zero provider calls. This is a development shell, not production auth or a browser-side provider
path.
