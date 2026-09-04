# Third-party notices

The WP-2026-001 foundation uses TypeScript plus the ESLint, `@eslint/js`, `globals`, and
`typescript-eslint` development toolchain. Exact direct and transitive versions, integrity values,
and package license metadata are recorded in `package-lock.json`; `npm run licenses:check` validates
the installed dependency tree against the repository's reviewed license allowlist. The ESLint tree
includes `minimatch` under the permissive
[Blue Oak Model License 1.0.0](https://blueoakcouncil.org/license/1.0.0.html), whose notice link is
preserved here.

WP-2026-003 uses Zod 4.5.4 for exact runtime wire schemas and generated JSON Schema.
It is MIT-licensed, copyright (c) 2025 Colin McDonnell; its installed LICENSE is preserved by npm.
The lockfile pins package integrity. The contract checkpoint ran npm audit and the repository's
license verification; no provider dependency was introduced.

WP-2026-003 packed-consumer testing uses Angular 21.2.22 (MIT), RxJS 7.8.2 (Apache-2.0),
tslib 2.8.1 (0BSD), esbuild 0.28.2 (MIT), Babel 7.29.7 (MIT), Playwright 1.62.1 (Apache-2.0),
and tar 7.5.22 (ISC).
These are development dependencies only. Playwright installs its revision-pinned Chromium test
runtime; Chromium's bundled third-party notices remain with that installation. No browser binary
or Angular runtime is included in the library tarballs.

Angular's test compiler uses the unmodified
[caniuse-lite](https://github.com/browserslist/caniuse-lite) browser compatibility dataset,
version 1.0.30001810, by Ben Briggs and contributors, derived from
[Can I Use](https://caniuse.com/). It is licensed under
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
Its installed license is preserved. The license checker exception is restricted to this exact
development-only package/version; the dataset is not included in library artifacts.

Future dependency additions must include automated dependency/license review, update this notice or
the generated release notice, and record any bundled assets, fonts, puzzles, model responses, or
code with their source and license. Generated project puzzles and synthetic recordings are governed
by [source and data provenance](docs/provenance/source-and-data.md).
