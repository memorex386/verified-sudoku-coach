---
name: release-coach
description: Prepare immutable Verified Sudoku Coach packages and the static replay with public-boundary, provenance, evaluation, accessibility, hash, SBOM, license, and authorization evidence.
---

# Release Verified Sudoku Coach

Follow the [release runbook](../../../docs/runbooks/release.md) and active release work package.
Proceed only for a `Ready` or `In progress` package with `Done` dependencies. Refuse release while
required evidence is missing, incompatible, unmeasured, or failed. Build from
the exact clean commit and bind source, lockfile, packages, contracts, prompts, model profile,
renderer, fixture, eval, demo, CI, SBOM/license, and limitation hashes in one manifest.

Run the [public-boundary review](../../../docs/playbooks/public-boundary-review.md). Verify browser
artifacts contain neither the Node-only adapter nor credential names and the replay is synthetic,
accessible, and clearly not live. Stop at prepared artifacts unless publication is explicitly
authorized; after publication, verify the URL and recorded hashes. This skill never deploys the
private host or starts live inference.
