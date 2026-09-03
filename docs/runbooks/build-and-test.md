# Build and test

Use Node 22 and npm 10 from the repository root.

## Clean setup

```powershell
npm ci
npm run doctor
```

`doctor` checks the expected runtime, foundation files, exact verification aggregator, and absence
of npm lifecycle hooks around its gates. The repository `.npmrc` and CI command-line flags disable
dependency and pre/post lifecycle scripts; every intended check is invoked explicitly. No
credential is required.

## Complete credential-free validation

```powershell
npm run verify
```

That command runs, in order:

- Runtime, required-file, and exact verification-aggregator checks.
- Accepted CI/Dependabot workflow-policy and immutable action-pin checks.
- ESLint across JavaScript and TypeScript source and tooling.
- Documentation and relative-link verification.
- Workspace dependency and browser/provider boundary verification.
- Work-package metadata, dependency, acceptance, and generated-registry verification.
- Runtime prompt/model/schema manifest verification.
- The honest frozen-evaluation bootstrap, which reports no measured claims until WP-2026-004.
- Working-tree, Git-index, commit-message/diff, and every reachable historical path/blob
  public-boundary scanning; binary, invalid-UTF-8, and oversized content fails for explicit review.
- Installed dependency-license verification without a network request; GitHub dependency review
  checks pull-request deltas separately.
- Canonical skill validation.
- Validation-script unit tests.
- Strict TypeScript checking across every workspace.

Run the complete command before every pull request. CI repeats it on Windows and Ubuntu. A live
model key is never required for pull-request checks.

## Targeted checks

```powershell
npm run lint
npm run ci:check
npm run docs:check
npm run architecture:check
npm run work-packages:check
npm run runtime-ai:check
npm run eval:replay
npm run security:check
npm run licenses:check
npm run skills:check
npm test
npm run typecheck
```

Later work packages may add package-specific tests, property suites, eval replay, application
builds, and accessibility checks. Add each command here and to CI in the same change.

Do not treat a passing local cache as release evidence. Release validation starts from `npm ci` on
the exact commit and records the CI run and artifact hashes.
