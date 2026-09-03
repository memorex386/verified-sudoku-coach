# Incident response

Use this runbook for suspected secret/private-data publication, invalid Sudoku content, unsafe model
content, budget runaway, compromised dependency, or materially false public claim.

## Contain

1. Stop the affected live evaluation, release, or private-host route. Do not retry automatically.
2. Preserve only safe identifiers, timestamps, versions, counts, and hashes needed to coordinate.
   Do not paste sensitive payloads into issues, chat, logs, or commits.
3. If a credential may be exposed, revoke/rotate it through the provider before cleanup. History
   rewriting is not credential rotation.
4. If public content is false or unsafe, remove or mark the claim unavailable and retain a concise
   correction record.

## Diagnose and correct

Classify the failed boundary, build an independently generated minimal regression fixture when
possible, and fix the smallest owning layer. Update the ADR/contract/policy if the incident disproves
an assumption. Run the complete affected test and eval set, not only the new case.

## Close

Record scope, exposure window, root cause, containment, verification, remaining uncertainty, and
follow-up owners without including sensitive content. Publication, credential deletion, provider
contact, private-host deployment, and user communication each require their own authorization.
