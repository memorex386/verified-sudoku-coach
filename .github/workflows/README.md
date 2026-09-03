# GitHub workflows

`foundation.yml` runs every credential-free repository gate on Windows and Ubuntu with read-only
GitHub permissions, non-persisted checkout credentials, and complete history for the public-boundary
scan. No GitHub token is passed to repository-controlled verification code. CodeQL and dependency review
establish the security baseline. Live model evaluation, artifact release, and Pages publication do
not exist in WP-001; later workflows must use protected environments and may not expose secrets to
pull requests or forks.

`npm run ci:check` locks the accepted workflow and Dependabot policy digests, required governance
files, full action commit pins, operating-system matrix, complete-history checkout, and
non-persisted credentials. Changing automation requires updating that verifier and review evidence
in the same pull request.
The foundation job also passes `--ignore-scripts` explicitly to install and verification commands;
the locked `.npmrc` provides the same lifecycle-hook protection for normal local setup.

The foundation job checks append-only work-package history against the pull-request base. On a
`main` push it checks against the push event's previous commit, so a direct push cannot rewrite
checkpoints unnoticed. An all-zero `before` value fails closed: the true bootstrap commit predates
this workflow, so a later zero value means protected history was recreated rather than advanced.
