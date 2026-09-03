# Release

No package, hosted demo, or model behavior is releasable during WP-2026-001. The first release path
is implemented in WP-2026-005 and must preserve these gates.

## Required evidence

- Exact Git commit/tag, package versions, dependency lock hash, and clean `npm ci` result.
- Separate browser-safe and Node-only GitHub Release `.tgz` artifacts with SHA-256 hashes,
  provenance attestations, sealed root-only exports, and Angular ESM/Node CommonJS pack smoke tests.
- Contract and runtime-AI manifest versions/hashes.
- Fixture/eval suite versions and a passing aggregate report under the fixed policy.
- Static replay production bundle hash and proof that it cannot reach the provider adapter.
- Accessibility results, vulnerability/license output, SBOM, CI run, known limitations, and support
  status.
- Manual public-boundary review and explicit human publication authorization.

The machine-readable release manifest is authoritative; human release notes are generated or linked
from it. A GitHub Pages build uses only approved synthetic replay data and identifies itself as a
replay. Live BYOK behavior remains local and must not leak a key into a browser artifact.

## Authorization and verification

A passing check, merged PR, work-package status, or prior release permission does not authorize a
new publication. At the final action point, summarize the exact commit, artifacts, claims, and
limitations, then require explicit current authorization. After publishing, load the public artifact
fresh, verify hashes and truthful labels, and record the release URL and result.
