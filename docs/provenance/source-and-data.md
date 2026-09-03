# Source and data provenance

## Clean public origin

This repository began as an empty Git repository. It is not a fork, history rewrite, or source dump
of Sudoku World. Generic behavior must be implemented from public specifications and independently
generated fixtures; private source may inform requirements but must not be copied.

## Allowed public inputs

- Original source and documentation created for this repository.
- Independently generated Sudoku fixtures with reproducible generator metadata and uniqueness proof.
- Synthetic model plans and adversarial cases that contain no production input.
- Third-party dependencies and assets whose licenses permit redistribution, with lockfile, notices,
  and SBOM evidence.
- Reviewed aggregate measurements with exact windows, versions, denominators, and limitations.

## Prohibited inputs

- Sudoku World signing/configuration material, credentials, private infrastructure details, private
  puzzle entries, proprietary assets, fonts without redistribution rights, or copied source.
- Player identity, production/player boards, notes, action history, comments, raw feedback, model
  requests/responses, or logs. Independently generated public fixtures and reviewed synthetic
  recordings remain allowed under the preceding section.
- Raw provider exports, assistant chats, private reasoning, local absolute paths, or unreviewed
  generated artifacts.

## Change and release evidence

Dependency changes require vulnerability and license review. Fixture changes require generator,
seed, hash, uniqueness, technique coverage, partition, and license updates. Releases bind these
records into a machine-readable evidence manifest and retain an SPDX or CycloneDX SBOM when release
tooling exists.

The custom public-boundary scanner catches generic high-risk paths and secret formats but is not a
proof of absence. The manual [public-boundary playbook](../playbooks/public-boundary-review.md) and
GitHub secret scanning remain required defense in depth.
