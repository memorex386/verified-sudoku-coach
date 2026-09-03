# Public-boundary review playbook

Run `npm run security:check` before every PR and release, then manually review:

- `git status --short`, `git diff --check`, changed paths, and commit metadata.
- Puzzle, model-response, feedback, and log provenance.
- New dependencies, assets, fonts, licenses, notices, and generated artifacts.
- Environment/config files, absolute local paths, provider/project identifiers, and browser bundles.
- PR descriptions and screenshots for participant/private-account identities, secrets, private
  links, and unsupported claims.
- Git history scanning and GitHub secret-scanning status.

If sensitive content is uncommitted, remove it without printing or copying it elsewhere. If it is in
an unpushed local commit, stop and coordinate safe history repair. If it may be pushed or disclosed,
rotate any credential first and follow the [incident runbook](../runbooks/incident-response.md).

The custom scanner detects known high-risk patterns; it cannot establish ownership or license and
does not replace human review.
