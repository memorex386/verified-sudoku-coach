# Third-party notices

The WP-2026-001 foundation uses TypeScript plus the ESLint, `@eslint/js`, `globals`, and
`typescript-eslint` development toolchain. Exact direct and transitive versions, integrity values,
and package license metadata are recorded in `package-lock.json`; `npm run licenses:check` validates
the installed dependency tree against the repository's reviewed license allowlist. The ESLint tree
includes `minimatch` under the permissive
[Blue Oak Model License 1.0.0](https://blueoakcouncil.org/license/1.0.0.html), whose notice link is
preserved here.

Future dependency additions must include automated dependency/license review, update this notice or
the generated release notice, and record any bundled assets, fonts, puzzles, model responses, or
code with their source and license. Generated project puzzles and synthetic recordings are governed
by [source and data provenance](docs/provenance/source-and-data.md).
