# Retention and deletion

The public repository contains synthetic examples only. A private pilot may retain bounded,
account-linked raw traces for at most 30 days under explicit consent.

- Store the consent version, owner UID, created/expiry timestamps, revision, and deletion state;
  do not collect separate name, email, phone, employer, or recruiting-profile fields.
- Restrict raw access to IAM-protected review operations. Product logs and analytics use allowlisted
  codes and aggregates, never boards, notes, prompts, responses, identifiers, or feedback text.
- Account withdrawal immediately disables access and queues idempotent deletion of sessions,
  prompts/responses, feedback, invites, and derived account-linked material. Verify deletion across
  primary storage, indexes, and retry/dead-letter paths.
- Seal reviewed aggregate results only at cohort close. They cannot be attributed or unwound after
  raw deletion, and consent must disclose that fact before participation.
- On job failure or uncertainty, disable Coach access, retain the deletion request, alert the owner,
  and retry safely. Do not report deletion complete without verification evidence.

Provider-side retention is a separately reviewed external policy fact before any live call.
