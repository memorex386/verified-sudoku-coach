import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { ESLint } from "eslint";

import {
  fromRoot,
  inspectRepositoryPath,
  markdownLinkTargets,
  missingRequiredIds,
  parseFrontMatter,
  readText,
  undefinedMarkdownReferences,
} from "./lib/project.mjs";
import {
  classifyBrowserHtml,
  classifyBrowserSource,
  classifyCoreSource,
  classifyPureSource,
  dependencySpecViolation,
  findDependencyCycle,
  relativeImportEscapes,
  validateAcceptedArchitecturePolicy,
  verifyArchitectureAtRoot,
} from "./verify-architecture.mjs";
import {
  classifyPublicFile,
  classifyText,
  scanAnnotatedGitTags,
  scanGitHistory,
  scanGitIndex,
  scanReachableGitBlobs,
  scanWorkingTreePaths,
} from "./verify-public-boundary.mjs";
import {
  loadAcceptedPlans,
  loadWorkPackages,
  validateCheckpointHistory,
  validateWorkPackages,
  verifyRemoteReviewEvidenceWith,
} from "./generate-work-package-registry.mjs";
import {
  runtimeCompatibility,
  validateFoundationVerificationScripts,
} from "./doctor.mjs";
import { verifyLicensesAtRoot } from "./verify-licenses.mjs";
import { validateCiPolicy, verifyCiPolicyAtRoot } from "./verify-ci.mjs";
import {
  compareSemanticVersions,
  validateArtifactPath,
  validateInferenceSettings,
  validateOutputTokenBound,
  validateRegistrationIdentity,
  validateRuntimeManifestTransition,
  validateTimeoutBound,
} from "./lib/runtime-ai.mjs";

const verifyReviewShapeOffline = (review, revisions) =>
  review !== null && revisions.length > 0;

function validateWorkPackagesOffline(
  packages,
  acceptanceContent,
  acceptedPlans = loadAcceptedPlans(),
) {
  return validateWorkPackages(
    packages,
    acceptanceContent,
    acceptedPlans,
    verifyReviewShapeOffline,
  );
}

test("front matter parser preserves colon-containing values", () => {
  const parsed = parseFrontMatter("---\nid: WP-2026-001\nsource: https://example.test/a\n---\n# Body\n");
  assert.deepEqual(parsed.metadata, {
    id: "WP-2026-001",
    source: "https://example.test/a",
  });
  assert.equal(parsed.body, "# Body\n");
});

test("foundation ADR identity check rejects a replacement ID", () => {
  assert.deepEqual(
    missingRequiredIds(
      ["ADR-0001", "ADR-0002", "ADR-0003", "ADR-0004", "ADR-0005", "ADR-0007"],
      ["ADR-0001", "ADR-0002", "ADR-0003", "ADR-0004", "ADR-0005", "ADR-0006"],
    ),
    ["ADR-0006"],
  );
});

test("doctor rejects an npm version other than the packageManager pin", () => {
  assert.deepEqual(
    runtimeCompatibility({
      nodeVersion: "22.22.3",
      npmVersion: "11.0.0",
      packageManager: "npm@10.9.8",
    }),
    ["npm 10.9.8 is required; found 11.0.0"],
  );
  assert.deepEqual(
    runtimeCompatibility({
      nodeVersion: "22.22.3",
      npmVersion: "10.9.8",
      packageManager: "npm@10.9.8",
    }),
    [],
  );
});

test("doctor locks the complete foundation verification aggregator", () => {
  const manifest = JSON.parse(readText("package.json"));
  assert.deepEqual(validateFoundationVerificationScripts(manifest), []);
  const weakened = structuredClone(manifest);
  weakened.scripts.verify = "npm run doctor";
  assert.deepEqual(
    validateFoundationVerificationScripts(weakened),
    ["package.json: scripts.verify must run every accepted foundation gate in order"],
  );
  weakened.scripts.verify = manifest.scripts.verify;
  weakened.scripts["security:check"] = "node -e \"process.exit(0)\"";
  assert.ok(validateFoundationVerificationScripts(weakened).includes(
    "package.json: scripts.security:check must be node scripts/verify-public-boundary.mjs",
  ));
  const hooked = structuredClone(manifest);
  hooked.scripts.preverify = "node scripts/mutate-before-verification.mjs";
  assert.ok(validateFoundationVerificationScripts(hooked).includes(
    "package.json: lifecycle script preverify is forbidden by the credential-free foundation",
  ));
});

test("CI policy locks required artifacts and credential-free workflow topology", () => {
  assert.deepEqual(verifyCiPolicyAtRoot(), []);
  const paths = [
    ".npmrc",
    ".github/CODEOWNERS",
    ".github/dependabot.yml",
    ".github/pull_request_template.md",
    ".github/workflows/README.md",
    ".github/workflows/codeql.yml",
    ".github/workflows/dependency-review.yml",
    ".github/workflows/foundation.yml",
  ];
  const files = Object.fromEntries(paths.map((relativePath) => [relativePath, readText(relativePath)]));

  const missing = { ...files };
  delete missing[".github/CODEOWNERS"];
  assert.ok(validateCiPolicy(missing).includes(
    "missing required foundation automation artifact .github/CODEOWNERS",
  ));

  const weakened = { ...files };
  weakened[".github/workflows/foundation.yml"] = weakened[".github/workflows/foundation.yml"]
    .replace("os: [ubuntu-latest, windows-latest]", "os: [ubuntu-latest]")
    .replace("persist-credentials: false", "persist-credentials: true")
    .replace("workflow_dispatch:", "pull_request_target:")
    .replace("npm ci --ignore-scripts", "npm ci")
    .replace("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1", "actions/checkout@v7");
  const errors = validateCiPolicy(weakened);
  assert.ok(errors.includes(".github/workflows/foundation.yml: pull_request_target is forbidden"));
  assert.ok(errors.includes(".github/workflows/foundation.yml: must run on Ubuntu and Windows"));
  assert.ok(errors.includes(".github/workflows/foundation.yml: checkout credentials must not persist"));
  assert.ok(errors.some((error) => error.includes("action must be pinned to a full commit SHA")));

  const addedUnsafeWorkflow = {
    ...files,
    ".github/workflows/unsafe.yaml": [
      "on:",
      "  pull_request_target:",
      "jobs:",
      "  unsafe:",
      "    uses: owner/repository/.github/workflows/unsafe.yml@main",
      "    secrets: inherit",
      "    env:",
      "      TOKEN: ${{ secrets.PROVIDER_TOKEN }}",
    ].join("\n"),
  };
  const unsafeErrors = validateCiPolicy(addedUnsafeWorkflow);
  assert.ok(unsafeErrors.includes(
    ".github/workflows/unsafe.yaml: unexpected workflow is forbidden by the foundation policy",
  ));
  assert.ok(unsafeErrors.includes(".github/workflows/unsafe.yaml: pull_request_target is forbidden"));
  assert.ok(unsafeErrors.includes(
    ".github/workflows/unsafe.yaml: credential wiring is forbidden in public foundation workflows",
  ));
  assert.ok(unsafeErrors.includes(
    ".github/workflows/unsafe.yaml: action must be pinned to a full commit SHA: owner/repository/.github/workflows/unsafe.yml@main",
  ));
});

test("eval replay bootstrap is exact machine-readable no-claim output", () => {
  const manifest = JSON.parse(readText("package.json"));
  assert.equal(manifest.scripts["eval:replay"], "node scripts/eval-replay.mjs");
  const output = execFileSync(process.execPath, [fromRoot("scripts/eval-replay.mjs")], {
    encoding: "utf8",
  });
  assert.deepEqual(JSON.parse(output), {
    schemaVersion: 1,
    status: "not_implemented",
    plannedWorkPackage: "WP-2026-004",
    claimsMeasured: false,
    casesEvaluated: 0,
    message: "Frozen coach evaluation is planned for WP-2026-004; this bootstrap contains no evaluator or feature results.",
  });
});

test("runtime AI inference settings are exact and behavior-bearing", () => {
  const registration = {
    id: "observer-v1",
    role: "observer",
    inferenceSettings: {
      reasoningEffort: "low",
      structuredOutputMode: "strict-json-schema",
      serviceTier: "auto",
      toolPolicy: "none",
      samplingPolicy: "provider-default-no-parameters",
    },
  };
  assert.deepEqual(validateInferenceSettings(registration), []);

  registration.inferenceSettings.reasoningEffort = "medium";
  registration.inferenceSettings.temperature = 0;
  assert.deepEqual(validateInferenceSettings(registration), [
    "observer-v1: inferenceSettings unknown field temperature",
    "observer-v1: observer reasoningEffort must be low until the profile policy changes",
  ]);
});

test("runtime AI output bounds enforce the candidate role ceilings", () => {
  assert.deepEqual(
    validateOutputTokenBound({ id: "observer-v1", role: "observer", maxOutputTokens: 256 }),
    [],
  );
  assert.deepEqual(
    validateOutputTokenBound({ id: "observer-v1", role: "observer", maxOutputTokens: 257 }),
    ["observer-v1: observer maxOutputTokens must not exceed 256"],
  );
  assert.deepEqual(
    validateOutputTokenBound({ id: "teacher-v1", role: "teacher", maxOutputTokens: 769 }),
    ["teacher-v1: teacher maxOutputTokens must not exceed 768"],
  );
});

test("runtime AI timeout bounds preserve the observer five-second failure gate", () => {
  assert.deepEqual(
    validateTimeoutBound({ id: "observer-v1", role: "observer", timeoutMs: 5_000 }),
    [],
  );
  assert.deepEqual(
    validateTimeoutBound({ id: "observer-v1", role: "observer", timeoutMs: 5_001 }),
    ["observer-v1: observer timeoutMs must not exceed 5000"],
  );
  assert.deepEqual(
    validateTimeoutBound({ id: "teacher-v1", role: "teacher", timeoutMs: 10_000 }),
    [],
  );
});

test("runtime AI behavior changes require versions and new comparative evidence", () => {
  const previous = {
    registrations: [{
      id: "observer-v1",
      approvalStatus: "approved",
      runtimeBehaviorVersion: "1.0.0",
      modelProfileVersion: "1.0.0",
      promptVersion: "1.0.0",
      promptSha256: "a".repeat(64),
      comparisonReportSha256: "b".repeat(64),
      inferenceSettings: { reasoningEffort: "low" },
    }],
  };
  const changed = structuredClone(previous);
  changed.registrations[0].inferenceSettings.reasoningEffort = "medium";
  assert.deepEqual(validateRuntimeManifestTransition(changed, previous), [
    "observer-v1: runtimeBehaviorVersion must increase when behavior changes",
    "observer-v1: behavior changed without new comparative-evaluation evidence",
    "observer-v1: modelProfileVersion must increase when model profile changes",
  ]);

  changed.registrations[0].runtimeBehaviorVersion = "2.0.0";
  changed.registrations[0].modelProfileVersion = "2.0.0";
  changed.registrations[0].comparisonReportSha256 = "c".repeat(64);
  assert.deepEqual(validateRuntimeManifestTransition(changed, previous), []);

  const downgradeBase = structuredClone(changed);
  downgradeBase.registrations[0].runtimeBehaviorVersion = "3.0.0";
  downgradeBase.registrations[0].modelProfileVersion = "3.0.0";
  const downgraded = structuredClone(changed);
  downgraded.registrations[0].inferenceSettings.reasoningEffort = "high";
  downgraded.registrations[0].comparisonReportSha256 = "d".repeat(64);
  assert.ok(validateRuntimeManifestTransition(downgraded, downgradeBase).some((error) =>
    error.includes("runtimeBehaviorVersion must increase")));
  assert.ok(validateRuntimeManifestTransition(downgraded, downgradeBase).some((error) =>
    error.includes("modelProfileVersion must increase")));

  const removed = { registrations: [] };
  assert.deepEqual(validateRuntimeManifestTransition(removed, previous), [
    "observer-v1: registrations are append-only; retire instead of removing",
  ]);
});

test("semantic-version precedence is monotonic and ignores build metadata", () => {
  assert.ok(compareSemanticVersions("2.0.0", "1.9.9") > 0);
  assert.ok(compareSemanticVersions("1.0.0", "1.0.0-rc.1") > 0);
  assert.ok(compareSemanticVersions("1.0.0-rc.2", "1.0.0-rc.1") > 0);
  assert.ok(compareSemanticVersions("1.0.0-alpha.beta", "1.0.0-alpha-1") < 0);
  assert.equal(compareSemanticVersions("1.0.0+build.2", "1.0.0+build.1"), 0);
  assert.ok(Number.isNaN(compareSemanticVersions("1.0.0-01", "1.0.0")));
});

test("runtime AI identity fields and artifact locations are exact", () => {
  const malformed = validateRegistrationIdentity({
    id: 123,
    modelProfileVersion: {},
    runtimeBehaviorVersion: [],
    promptVersion: {},
    schemaVersion: false,
    rendererVersion: [],
    proofPolicyVersion: {},
    evalSuiteVersion: 7,
  });
  assert.equal(malformed.length, 8);
  assert.ok(malformed.includes("registration: id must be a lowercase kebab-case string"));
  assert.ok(malformed.includes(
    "registration: runtimeBehaviorVersion must be a semantic-version string",
  ));
  const invalidPrerelease = {
    id: "observer-v1",
    modelProfileVersion: "1.0.0",
    runtimeBehaviorVersion: "1.0.0",
    promptVersion: "1.0.0-01",
    schemaVersion: "1.0.0",
    rendererVersion: "1.0.0",
    proofPolicyVersion: "1.0.0",
    evalSuiteVersion: "1.0.0",
  };
  assert.deepEqual(validateRegistrationIdentity(invalidPrerelease), [
    "observer-v1: promptVersion must be a semantic-version string",
  ]);
  assert.deepEqual(
    validateArtifactPath("prompt", "ai/prompts/observer-v1.md"),
    [],
  );
  assert.deepEqual(
    validateArtifactPath("prompt", "docs/private/observer-v1.md"),
    ["prompt path must match ai/prompts/*.md"],
  );
  assert.deepEqual(
    validateArtifactPath("comparison report", "docs/evaluation/reports/observer-v1.json"),
    [],
  );
});

test("Markdown links support titles, angle destinations, and reference definitions", () => {
  const markdown = [
    '[Inline](docs/a.md "title")',
    "[Spaced](<docs/a b.md>)",
    "[Reference][guide]",
    "[guide]: docs/guide.md 'Guide'",
  ].join("\n");
  assert.deepEqual(markdownLinkTargets(markdown), ["docs/a.md", "docs/a b.md", "docs/guide.md"]);
  assert.deepEqual(undefinedMarkdownReferences(markdown), []);
  assert.deepEqual(undefinedMarkdownReferences("[Missing][nope]"), ["nope"]);
});

test("repository-local path inspection rejects lexical and symbolic-link escapes", () => {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-contained-root-"));
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-contained-outside-"));
  try {
    const docs = path.join(repositoryRoot, "docs");
    fs.mkdirSync(docs, { recursive: true });
    fs.writeFileSync(path.join(docs, "inside.md"), "inside\n");
    fs.writeFileSync(path.join(outsideRoot, "private.md"), "outside\n");
    assert.equal(inspectRepositoryPath(repositoryRoot, docs, "inside.md").ok, true);
    assert.equal(
      inspectRepositoryPath(
        repositoryRoot,
        docs,
        path.join("..", "..", path.basename(outsideRoot), "private.md"),
      ).reason,
      "outside",
    );
    assert.equal(
      inspectRepositoryPath(repositoryRoot, docs, path.join(outsideRoot, "private.md")).reason,
      "outside",
    );

    const linkedDirectory = path.join(docs, "linked-private");
    fs.symlinkSync(outsideRoot, linkedDirectory, "junction");
    assert.equal(
      inspectRepositoryPath(repositoryRoot, docs, "linked-private/private.md").reason,
      "symlink",
    );
    assert.deepEqual(scanWorkingTreePaths(["docs/linked-private"], repositoryRoot), [
      "docs/linked-private: symbolic links are forbidden",
    ]);
  } finally {
    fs.rmSync(repositoryRoot, { recursive: true, force: true });
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  }
});

test("dependency cycle detection identifies the complete cycle", () => {
  const graph = new Map([
    ["a", ["b"]],
    ["b", ["c"]],
    ["c", ["a"]],
  ]);
  assert.deepEqual(findDependencyCycle(graph), ["a", "b", "c", "a"]);
});

test("accepted architecture policy cannot disable its enforcement categories", () => {
  const policy = JSON.parse(readText("config/architecture.json"));
  assert.deepEqual(validateAcceptedArchitecturePolicy(policy), []);
  policy.corePackages = [];
  policy.boundaryPackages = [];
  policy.browserPackages = [];
  policy.nodeOnlyPackages = [];
  policy.providerPackages = [];
  policy.pureRuntimeExternalDependencies = {};
  assert.ok(validateAcceptedArchitecturePolicy(policy).some((error) =>
    error.includes("policy differs from the accepted VSC-ARCH-1 workspace graph")));
});

test("architecture fitness classifier rejects core framework and ambient effects", () => {
  assert.deepEqual(
    classifyCoreSource(readText("scripts/fixtures/architecture/forbidden-core.ts")),
    ["external import zod", "wall-clock access"],
  );
  assert.deepEqual(
    classifyCoreSource("export const bytes = Buffer.from('x');\nconsole.log(bytes);"),
    ["Node ambient access", "console side effect"],
  );
  assert.deepEqual(
    classifyCoreSource(
      'const Clock = Date; export const now = () => Clock.now(); export const pick = () => Math["random"]();',
    ),
    ["wall-clock access", "random access"],
  );
  assert.deepEqual(
    classifyCoreSource("export const moduleUrl = import.meta.url;"),
    ["environment access"],
  );
  assert.deepEqual(
    classifyCoreSource("export const now = () => new Intl.DateTimeFormat().format();"),
    ["wall-clock access"],
  );
  assert.deepEqual(
    classifyCoreSource('export const send = () => new BroadcastChannel("leak");'),
    ["network access"],
  );
  assert.deepEqual(
    classifyCoreSource("export const browserState = [location.href, caches, speechSynthesis];"),
    ["host UI access", "browser storage"],
  );
  assert.deepEqual(
    classifyCoreSource([
      "const { random: choose } = Math;",
      "const { now: current } = performance;",
      "const { getRandomValues: fill } = crypto;",
      "export { choose, current, fill };",
    ].join("\n")),
    ["wall-clock access", "random access"],
  );
  assert.deepEqual(
    classifyCoreSource([
      "let source: any = Math;",
      "source = performance;",
      "export const values = [source.random(), source.now()];",
    ].join("\n")),
    ["wall-clock access", "random access"],
  );
  assert.deepEqual(
    classifyCoreSource([
      "const M = Math;",
      "const p = (performance);",
      "const c = crypto satisfies object;",
      "let random;",
      "({ random } = (Math));",
      "const { ['random']: pick } = Math;",
      "export const values = [M.random(), p.now(), c.randomUUID(), random, pick];",
    ].join("\n")),
    ["wall-clock access", "random access"],
  );
  assert.deepEqual(
    classifyCoreSource('export const first = () => eval("Date.now()");'),
    ["dynamic code access"],
  );
  assert.deepEqual(
    classifyCoreSource('export const second = Function("return Date.now()");'),
    ["dynamic code access"],
  );
  assert.deepEqual(
    classifyCoreSource('export const leak = (() => {}).constructor("return process.env")();'),
    ["dynamic code access"],
  );
  assert.deepEqual(
    classifyCoreSource('export const leak = (() => {})["con" + "structor"]`return process.env`;'),
    ["dynamic code access"],
  );
  assert.deepEqual(
    classifyCoreSource('const { constructor: Build } = () => {}; export const leak = Build("return 1")();'),
    ["dynamic code access"],
  );
  assert.deepEqual(
    classifyCoreSource([
      "const clock = performance;",
      "const subtle = crypto.subtle;",
      "export const values = [clock.timeOrigin, subtle.generateKey];",
    ].join("\n")),
    ["wall-clock access", "random access"],
  );
  assert.deepEqual(
    classifyCoreSource('export const key = crypto["sub" + "tle"]["generate" + "Key"];'),
    ["random access"],
  );
  assert.deepEqual(
    classifyCoreSource("const { subtle } = crypto; export const key = subtle.generateKey;"),
    ["random access"],
  );
  assert.deepEqual(
    classifyCoreSource([
      'const randomProperty = "ra" + "ndom";',
      'const clockProperty = "n" + "ow";',
      "export const values = [Math[randomProperty](), performance[clockProperty]()];",
    ].join("\n")),
    ["wall-clock access", "random access"],
  );
  assert.deepEqual(
    classifyCoreSource('export const random = Reflect.get(Math, "random")();'),
    ["dynamic code access"],
  );
});

test("architecture fitness classifier permits inward package imports", () => {
  assert.deepEqual(
    classifyCoreSource([
      'import type { Board } from "@verified-sudoku/domain";',
      'import { assertBoard } from "./board.js";',
    ].join("\n")),
    [],
  );
});

test("ESLint applies TypeScript rules to every permitted production extension", async () => {
  const eslint = new ESLint({ cwd: fromRoot() });
  for (const extension of ["ts", "tsx", "mts", "cts"]) {
    const config = await eslint.calculateConfigForFile(
      fromRoot(`packages/domain/src/lint-coverage.${extension}`),
    );
    assert.ok(config, `missing ESLint config for .${extension}`);
    assert.ok(config.rules?.["@typescript-eslint/no-explicit-any"]);
  }
});

test("boundary classifier allows only declared schema dependencies and no ambient effects", () => {
  assert.deepEqual(
    classifyPureSource('import { z } from "zod";\nexport const Value = z.string();', ["zod"]),
    [],
  );
  assert.deepEqual(
    classifyPureSource('import axios from "axios";\nexport const value = fetch("/value");', ["zod"]),
    ["external import axios", "network access"],
  );
});

test("browser fitness classifier rejects Node and provider-key access", () => {
  assert.deepEqual(
    classifyBrowserSource(readText("scripts/fixtures/architecture/forbidden-browser.tsx")),
    ["Node-only import openai/helpers/zod", "Node-only global", "provider credential name"],
  );
});

test("browser fitness classifier rejects legacy Node builtin specifiers", () => {
  assert.deepEqual(classifyBrowserSource('import fs from "fs";'), ["Node-only import fs"]);
  assert.deepEqual(
    classifyBrowserSource("declare const process: any; export const p = process.platform;"),
    ["Node-only global"],
  );
  assert.deepEqual(
    classifyBrowserSource("declare const __dirname: string; export { __dirname };"),
    ["Node-only global"],
  );
  assert.deepEqual(
    classifyBrowserSource("declare const global: object; export { global };"),
    ["Node-only global"],
  );
  assert.deepEqual(
    classifyBrowserSource('export const load = () => eval("require(\\"node:fs\\")");'),
    ["dynamic code access"],
  );
  assert.deepEqual(
    classifyBrowserSource('export const load = Function("return process");'),
    ["dynamic code access"],
  );
  assert.deepEqual(
    classifyBrowserSource('export const load = globalThis["Function"]("return process");'),
    ["dynamic code access"],
  );
  assert.deepEqual(
    classifyBrowserSource('export const load = (() => {})["constructor"]("return process")();'),
    ["dynamic code access"],
  );
  assert.deepEqual(
    classifyBrowserSource('const name = "constructor"; export const load = (() => {})[name]("return 1")();'),
    ["dynamic code access"],
  );
  assert.deepEqual(
    classifyBrowserSource('export const load = Reflect.get(() => {}, "constructor")("return 1")();'),
    ["dynamic code access"],
  );
  for (const access of [
    'globalThis["pro" + "cess"]',
    'globalThis["requ" + "ire"]',
    '(() => { const name = "Buf" + "fer"; return globalThis[name]; })()',
  ]) {
    assert.deepEqual(classifyBrowserSource(`export const value = ${access};`), ["Node-only global"]);
  }
  for (const name of ["VITE_OPENAI_API_KEY", "NEXT_PUBLIC_OPENAI_API_KEY", "OPENAI_KEY"]) {
    assert.deepEqual(
      classifyBrowserSource(`export const credentialName = "${name}";`),
      ["provider credential name"],
    );
  }
  assert.deepEqual(
    classifyBrowserSource('export const call = () => fetch("https://api.openai.com/v1/responses");'),
    ["direct provider endpoint"],
  );
  assert.deepEqual(
    classifyBrowserSource('export const endpoint = "https://api." + `openai.${"com"}/v1/responses`;'),
    ["direct provider endpoint"],
  );
  assert.deepEqual(
    classifyBrowserSource('export const credentialName = "OPEN" + "AI_API_KEY";'),
    ["provider credential name"],
  );
  assert.deepEqual(
    classifyBrowserSource('export const endpoint = ["https://api", "openai", "com/v1"].join(".");'),
    ["direct provider endpoint"],
  );
});

test("static string alias analysis terminates on shadowed names", { timeout: 1_000 }, () => {
  assert.deepEqual(
    classifyCoreSource('const key = "random"; { const key = "now"; void key; } void key;'),
    [],
  );
  assert.deepEqual(
    classifyCoreSource('const property = "random"; { const property = "max"; void property; } export const value = Math[property]();'),
    ["random access"],
  );
});

test("module parsing catches template, comment-interposed, and opaque dynamic imports", () => {
  assert.deepEqual(
    classifyBrowserSource('void import(`node:fs`); import/* boundary */("openai");'),
    ["Node-only import node:fs", "Node-only import openai"],
  );
  assert.deepEqual(
    classifyBrowserSource("void import(providerName);"),
    ["non-literal module specifier"],
  );
  assert.deepEqual(
    classifyBrowserSource('module.require("node:fs");'),
    ["Node-only import node:fs", "Node-only global"],
  );
  assert.ok(classifyCoreSource('module["require"]("node:fs");').includes("Node ambient access"));
});

test("browser HTML forbids inline execution and non-src module entrypoints", () => {
  assert.deepEqual(
    classifyBrowserHtml('<script type="module">import "openai";</script>'),
    ["inline or source-less script", "inline script content"],
  );
  assert.deepEqual(
    classifyBrowserHtml('<script type="module" src="/src/main.tsx"></script>'),
    [],
  );
});

test("architecture verifier discovers forbidden source and manifest dependencies end to end", () => {
  const errors = verifyArchitectureAtRoot(fromRoot("scripts/fixtures/architecture/workspace"));
  assert.ok(errors.includes(
    "packages/domain/src/index.ts: pure production boundary forbids external import react",
  ));
  assert.ok(errors.includes(
    "packages/domain/src/index.ts: production import dev-only-runtime must be declared in dependencies, peerDependencies, or optionalDependencies",
  ));
  assert.ok(errors.includes(
    "packages/domain/src/index.ts: production import @fixture/replay-web must be declared in dependencies, peerDependencies, or optionalDependencies",
  ));
  assert.ok(errors.includes(
    "packages/domain/src/escape.js: pure production boundary forbids network access",
  ));
  assert.ok(errors.includes(
    "packages/domain/package.json: pure production boundary forbids external dependency react",
  ));
  assert.ok(errors.includes(
    "packages/domain/package.json: external dependency provider-alias must use an exact registry version; found npm:openai@4.0.0",
  ));
  assert.ok(errors.includes(
    "packages/domain/tsconfig.json: compilerOptions.paths remapping is forbidden",
  ));
  assert.ok(errors.includes(
    "packages/domain/tsconfig.json: compilerOptions.strict cannot weaken the root setting",
  ));
  assert.ok(errors.includes(
    "packages/domain/tsconfig.json: compilerOptions.strictNullChecks cannot weaken the root setting",
  ));
  for (const option of ["target", "module", "moduleResolution"]) {
    assert.ok(errors.includes(
      `packages/domain/tsconfig.json: compilerOptions.${option} must inherit the root setting`,
    ));
  }
  assert.ok(errors.includes(
    "packages/domain/tsconfig.json: pure compilerOptions.lib must inherit the root ES2022-only set",
  ));
  assert.ok(errors.includes(
    "packages/domain/tsconfig.json: include must use canonical src globs and cover every production source",
  ));
  assert.ok(errors.includes(
    "packages/domain/tsconfig.json: exclude is forbidden; every production source must be typechecked",
  ));
  assert.ok(errors.includes(
    "packages/domain/package.json: export targets must be explicit paths within src or generated dist",
  ));
  assert.ok(errors.includes(
    "packages/domain/src/index.ts: production import escapes the runtime src boundary: ../runtime/index.js",
  ));
  assert.ok(errors.includes(
    "packages/domain/src/reference.ts: triple-slash reference directives are forbidden in production source",
  ));
  assert.ok(errors.includes(
    "packages/domain/src/index.ts: TypeScript suppression directives are forbidden in production source",
  ));
  assert.ok(errors.includes(
    "tsconfig.base.json: extending another config is forbidden",
  ));
  assert.ok(errors.includes(
    "tsconfig.base.json: compilerOptions.noCheck must not be true",
  ));
  assert.ok(errors.includes(
    "tsconfig.base.json: compilerOptions.lib must be exactly ES2022",
  ));
  assert.ok(errors.includes(
    "tsconfig.base.json: compilerOptions.noUncheckedSideEffectImports cannot weaken strict mode",
  ));
  assert.ok(errors.includes(
    "tsconfig.base.json: compilerOptions.target must be exactly ES2022",
  ));
  assert.ok(errors.includes(
    "tsconfig.base.json: compilerOptions.module must be exactly NodeNext",
  ));
  assert.ok(errors.includes(
    "tsconfig.base.json: compilerOptions.moduleResolution must be exactly NodeNext",
  ));
  assert.ok(errors.includes(
    "packages/domain/tsconfig.json: compilerOptions.noCheck must not be true",
  ));
  assert.ok(errors.includes(
    "tsconfig.json: compilerOptions.noCheck must not be true",
  ));
  assert.ok(errors.includes(
    "packages/evil/package.json: workspace path packages/evil is absent from config/architecture.json",
  ));
  assert.ok(errors.includes(
    "package.json: workspaces must be exactly apps/*, packages/*, tools/*",
  ));
  assert.ok(errors.includes(
    "apps/replay-web/package.json: package imports aliases are forbidden",
  ));
  assert.ok(errors.includes(
    "apps/replay-web/package.json: package browser remapping/entrypoint field is forbidden",
  ));
  assert.ok(errors.includes(
    "apps/replay-web/package.json: workspace dependency @fixture/domain must use the local-only * specifier; found https://example.test/substitute.tgz",
  ));
  assert.ok(errors.includes(
    "apps/replay-web/src/escape.jsx: production source must be strict TypeScript",
  ));
  assert.ok(errors.includes(
    "apps/replay-web/src/index.ts: production import escapes the runtime src boundary: ../runtime/escape.js",
  ));
  assert.ok(errors.includes(
    "apps/replay-web/src/escape.jsx: browser-safe graph forbids Node-only import node:fs",
  ));
  assert.ok(errors.includes(
    "apps/replay-web/src/escape.jsx: browser-safe graph forbids Node-only import openai",
  ));
  assert.ok(errors.includes(
    "apps/replay-web/index.html: browser entry HTML forbids inline script content",
  ));
});

test("architecture verifier scans reserved directory names nested under src", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-source-closure-"));
  try {
    fs.cpSync(
      fromRoot("scripts/fixtures/architecture/workspace"),
      temporaryRepository,
      { recursive: true },
    );
    for (const reservedPath of ["dist", "node_modules"]) {
      const sourceDirectory = path.join(
        temporaryRepository,
        "packages",
        "domain",
        "src",
        reservedPath,
      );
      fs.mkdirSync(sourceDirectory, { recursive: true });
      fs.writeFileSync(path.join(sourceDirectory, "evil.ts"), "export const hiddenClock = Date.now();\n");
    }
    const errors = verifyArchitectureAtRoot(temporaryRepository);
    for (const reservedPath of ["dist", "node_modules"]) {
      assert.ok(errors.includes(
        `packages/domain/src/${reservedPath}/evil.ts: reserved generated/dependency directory inside src is forbidden`,
      ));
      assert.ok(errors.includes(
        `packages/domain/src/${reservedPath}/evil.ts: pure production boundary forbids wall-clock access`,
      ));
    }
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("architecture verifier requires exact registry or local workspace dependency specs", () => {
  assert.equal(
    dependencySpecViolation("provider-alias", "npm:openai@4.0.0"),
    "external dependency provider-alias must use an exact registry version; found npm:openai@4.0.0",
  );
  assert.equal(
    dependencySpecViolation("core-alias", "file:../coach-core"),
    "external dependency core-alias must use an exact registry version; found file:../coach-core",
  );
  assert.equal(
    dependencySpecViolation("hidden-provider", "git+https://example.test/provider.git"),
    "external dependency hidden-provider must use an exact registry version; found git+https://example.test/provider.git",
  );
  assert.equal(dependencySpecViolation("react", "19.1.1"), null);
  assert.equal(dependencySpecViolation("@verified-sudoku/domain", "*", true), null);
  assert.equal(
    dependencySpecViolation("@verified-sudoku/domain", "https://example.test/core.tgz", true),
    "workspace dependency @verified-sudoku/domain must use the local-only * specifier; found https://example.test/core.tgz",
  );
});

test("architecture fitness detects relative imports that escape a package", () => {
  assert.equal(
    relativeImportEscapes(
      "packages/coach-core/src/example.ts",
      "packages/coach-core",
      "../../domain/src/index.js",
    ),
    true,
  );
  assert.equal(
    relativeImportEscapes(
      "packages/coach-core/src/example.ts",
      "packages/coach-core",
      "./internal.js",
    ),
    false,
  );
});

test("public-boundary classifier detects representative secret formats", () => {
  const fakePrefix = ["s", "k-"].join("");
  assert.deepEqual(classifyText(`${fakePrefix}${"x".repeat(24)}`), ["OpenAI-style secret"]);
});

test("public-boundary classifier detects common private-key headers", () => {
  for (const kind of ["RSA", "EC", "OPENSSH"]) {
    const header = ["-----BEGIN ", kind, " PRIVATE KEY-----"].join("");
    assert.deepEqual(classifyText(header), ["private key material"]);
  }
});

test("public-boundary classifier detects fine-grained GitHub tokens", () => {
  const fakeToken = [["github", "_pat_"].join(""), "11AA00_", "A".repeat(60)].join("");
  assert.deepEqual(classifyText(`fixture ${fakeToken}`), ["fine-grained GitHub token"]);
});

test("public-boundary classifier accepts ordinary documentation", () => {
  assert.deepEqual(classifyText("Only synthetic fixtures and aggregate results are public."), []);
});

test("public-boundary scan still inspects an allowed environment example", () => {
  const fakePrefix = ["s", "k-"].join("");
  assert.deepEqual(
    classifyPublicFile(".env.example", `OPENAI_API_KEY=${fakePrefix}${"x".repeat(24)}\n`),
    [".env.example: possible OpenAI-style secret"],
  );
});

test("public-boundary scan rejects environment directories at any depth", () => {
  assert.deepEqual(
    classifyPublicFile(".env/config.json", "{}"),
    [".env/config.json: forbidden environment file"],
  );
  assert.deepEqual(
    classifyPublicFile("config/.env/secrets.json", "{}"),
    ["config/.env/secrets.json: forbidden environment file"],
  );
});

test("public-boundary scan rejects local live-evaluation artifacts", () => {
  assert.deepEqual(
    classifyPublicFile("artifacts/live-evals/run.json", '{"output":"synthetic"}'),
    ["artifacts/live-evals/run.json: forbidden raw trace directory"],
  );
});

test("public-boundary scan inspects shell scripts regardless of extension", () => {
  const fakePrefix = ["gh", "p_"].join("");
  assert.deepEqual(
    classifyPublicFile("scripts/release.ps1", `$token = '${fakePrefix}${"x".repeat(24)}'\n`),
    ["scripts/release.ps1: possible GitHub token"],
  );
});

test("public-boundary history scan inspects commit messages", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-history-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.name", "Fixture Author"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: temporaryRepository });
    const fakeSecret = [["s", "k-"].join(""), "x".repeat(24)].join("");
    execFileSync("git", ["commit", "--allow-empty", "--quiet", "-m", `fixture ${fakeSecret}`], {
      cwd: temporaryRepository,
    });
    assert.ok(scanGitHistory(temporaryRepository).some((finding) =>
      finding.includes("[commit]: possible OpenAI-style secret")));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("public-boundary history scan inspects complete raw commit objects", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-raw-commits-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: temporaryRepository });
    const tree = execFileSync("git", ["mktree"], {
      cwd: temporaryRepository,
      encoding: "utf8",
      input: "",
    }).trim();
    const header = [
      `tree ${tree}`,
      "author Fixture Author <fixture@example.test> 0 +0000",
      "committer Fixture Author <fixture@example.test> 0 +0000",
    ];
    const fakeSecret = [["s", "k-"].join(""), "x".repeat(28)].join("");
    const rawCommit = [...header, `x-private ${fakeSecret}`, "", "safe message\n"].join("\n");
    const rawId = execFileSync("git", ["hash-object", "-t", "commit", "-w", "--stdin"], {
      cwd: temporaryRepository,
      encoding: "utf8",
      input: rawCommit,
    }).trim();
    execFileSync("git", ["update-ref", "refs/heads/raw-header", rawId], {
      cwd: temporaryRepository,
    });

    const binaryCommit = Buffer.concat([
      Buffer.from([...header, "", "binary message"].join("\n"), "utf8"),
      Buffer.from([255]),
    ]);
    const binaryId = execFileSync("git", ["hash-object", "-t", "commit", "-w", "--stdin"], {
      cwd: temporaryRepository,
      encoding: "utf8",
      input: binaryCommit,
    }).trim();
    execFileSync("git", ["update-ref", "refs/heads/binary-message", binaryId], {
      cwd: temporaryRepository,
    });

    const oversizedCommit = Buffer.concat([
      Buffer.from([...header, "", "large message\n"].join("\n"), "utf8"),
      Buffer.alloc(1_000_001, 65),
    ]);
    const oversizedId = execFileSync("git", ["hash-object", "-t", "commit", "-w", "--stdin"], {
      cwd: temporaryRepository,
      encoding: "utf8",
      input: oversizedCommit,
      maxBuffer: 1_100_000,
    }).trim();
    execFileSync("git", ["update-ref", "refs/heads/large-message", oversizedId], {
      cwd: temporaryRepository,
    });

    const findings = scanGitHistory(temporaryRepository);
    assert.ok(findings.includes(
      `Git commit object ${rawId} [commit]: possible OpenAI-style secret`,
    ));
    assert.ok(findings.includes(
      `Git commit object ${binaryId} [commit]: binary or non-UTF-8 content needs explicit provenance review`,
    ));
    assert.ok(findings.includes(
      `Git commit object ${oversizedId} [commit]: file exceeds the 1 MB automatic scan limit and needs explicit provenance review`,
    ));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("public-boundary history scan inspects annotated tag messages", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-tag-message-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.name", "Fixture Author"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: temporaryRepository });
    execFileSync("git", ["commit", "--allow-empty", "--quiet", "-m", "safe fixture"], {
      cwd: temporaryRepository,
    });
    const fakeSecret = [["s", "k-"].join(""), "x".repeat(24)].join("");
    execFileSync("git", ["tag", "-a", "fixture-v1", "-m", `fixture ${fakeSecret}`], {
      cwd: temporaryRepository,
    });
    assert.ok(scanGitHistory(temporaryRepository).includes(
      "refs/tags/fixture-v1 [annotated tag]: possible OpenAI-style secret",
    ));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("public-boundary tag scan fails closed on binary and oversized tag objects", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-tag-objects-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.name", "Fixture Author"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: temporaryRepository });
    execFileSync("git", ["commit", "--allow-empty", "--quiet", "-m", "safe fixture"], {
      cwd: temporaryRepository,
    });
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: temporaryRepository,
      encoding: "utf8",
    }).trim();
    const header = Buffer.from(
      `object ${commit}\ntype commit\ntag fixture\ntagger Fixture Author <fixture@example.test> 0 +0000\n\n`,
      "utf8",
    );
    const binaryObject = Buffer.concat([header, Buffer.from([255])]);
    const binaryId = execFileSync("git", ["hash-object", "-t", "tag", "-w", "--stdin"], {
      cwd: temporaryRepository,
      encoding: "utf8",
      input: binaryObject,
    }).trim();
    execFileSync("git", ["update-ref", "refs/tags/binary", binaryId], { cwd: temporaryRepository });

    const oversizedObject = Buffer.concat([header, Buffer.alloc(1_000_001, 65)]);
    const oversizedId = execFileSync("git", ["hash-object", "-t", "tag", "-w", "--stdin"], {
      cwd: temporaryRepository,
      encoding: "utf8",
      input: oversizedObject,
      maxBuffer: 1_100_000,
    }).trim();
    execFileSync("git", ["update-ref", "refs/tags/oversized", oversizedId], {
      cwd: temporaryRepository,
    });

    const findings = scanAnnotatedGitTags(temporaryRepository);
    assert.ok(findings.includes(
      "refs/tags/binary [annotated tag]: binary or non-UTF-8 content needs explicit provenance review",
    ));
    assert.ok(findings.includes(
      "refs/tags/oversized [annotated tag]: file exceeds the 1 MB automatic scan limit and needs explicit provenance review",
    ));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("public-boundary tag scan requires every tag chain to terminate in a commit", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-tag-target-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.name", "Fixture Author"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: temporaryRepository });
    execFileSync("git", ["commit", "--allow-empty", "--quiet", "-m", "safe fixture"], {
      cwd: temporaryRepository,
    });
    const secretBlob = Buffer.from([["s", "k-"].join(""), "x".repeat(24)].join(""), "utf8");
    const blobId = execFileSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: temporaryRepository,
      encoding: "utf8",
      input: secretBlob,
    }).trim();
    execFileSync("git", ["update-ref", "refs/tags/blob-leak", blobId], {
      cwd: temporaryRepository,
    });

    const annotatedObject = Buffer.from([
      `object ${blobId}`,
      "type blob",
      "tag annotated-blob",
      "tagger Fixture Author <fixture@example.test> 0 +0000",
      "",
      "safe tag message",
    ].join("\n"), "utf8");
    const annotatedId = execFileSync("git", ["hash-object", "-t", "tag", "-w", "--stdin"], {
      cwd: temporaryRepository,
      encoding: "utf8",
      input: annotatedObject,
    }).trim();
    execFileSync("git", ["update-ref", "refs/tags/annotated-blob", annotatedId], {
      cwd: temporaryRepository,
    });

    const findings = scanAnnotatedGitTags(temporaryRepository);
    assert.ok(findings.includes("refs/tags/blob-leak: tag must resolve to a commit; found blob"));
    assert.ok(findings.includes(
      "refs/tags/annotated-blob [annotated tag]: tag must resolve to a commit; found blob",
    ));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("public-boundary scans reject symlink and gitlink modes without dereferencing", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-git-modes-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.name", "Fixture Author"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: temporaryRepository });
    execFileSync("git", ["commit", "--allow-empty", "--quiet", "-m", "safe fixture"], {
      cwd: temporaryRepository,
    });
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: temporaryRepository,
      encoding: "utf8",
    }).trim();
    const linkId = execFileSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: temporaryRepository,
      encoding: "utf8",
      input: "/dev/zero",
    }).trim();
    execFileSync("git", ["update-index", "--add", "--cacheinfo", "120000", linkId, "device-link"], {
      cwd: temporaryRepository,
    });
    execFileSync("git", ["update-index", "--add", "--cacheinfo", "160000", commit, "private-module"], {
      cwd: temporaryRepository,
    });
    const indexFindings = scanGitIndex(temporaryRepository);
    assert.ok(indexFindings.includes("device-link [index]: symbolic links are forbidden"));
    assert.ok(indexFindings.includes(
      "private-module [index]: gitlinks/submodules are forbidden",
    ));
    execFileSync("git", ["commit", "--quiet", "-m", "add forbidden modes"], {
      cwd: temporaryRepository,
    });
    const historyFindings = scanReachableGitBlobs(temporaryRepository);
    assert.ok(historyFindings.includes("device-link [history]: symbolic links are forbidden"));
    assert.ok(historyFindings.includes(
      "private-module [history]: gitlinks/submodules are forbidden",
    ));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("public-boundary history scan rejects committed-then-deleted forbidden paths", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-history-path-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.name", "Fixture Author"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: temporaryRepository });
    fs.writeFileSync(path.join(temporaryRepository, ".env"), "UNRECOGNIZED_FIXTURE=value\n", "utf8");
    execFileSync("git", ["add", ".env"], { cwd: temporaryRepository });
    execFileSync("git", ["commit", "--quiet", "-m", "add fixture"], { cwd: temporaryRepository });
    fs.rmSync(path.join(temporaryRepository, ".env"));
    execFileSync("git", ["add", "-u"], { cwd: temporaryRepository });
    execFileSync("git", ["commit", "--quiet", "-m", "remove fixture"], { cwd: temporaryRepository });
    assert.ok(scanReachableGitBlobs(temporaryRepository).some((finding) =>
      finding === ".env [history]: forbidden environment file"));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("public-boundary blob scan rejects binary and oversized content", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-history-blob-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.name", "Fixture Author"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: temporaryRepository });
    fs.writeFileSync(path.join(temporaryRepository, "binary.dat"), Buffer.from([0, 1, 2, 3]));
    fs.writeFileSync(path.join(temporaryRepository, "large.dat"), Buffer.alloc(1_000_001, 65));
    execFileSync("git", ["add", "binary.dat", "large.dat"], { cwd: temporaryRepository });
    execFileSync("git", ["commit", "--quiet", "-m", "add blob fixtures"], { cwd: temporaryRepository });
    const findings = scanReachableGitBlobs(temporaryRepository);
    assert.ok(findings.includes(
      "binary.dat [history]: binary or non-UTF-8 content needs explicit provenance review",
    ));
    assert.ok(findings.includes(
      "large.dat [history]: file exceeds the 1 MB automatic scan limit and needs explicit provenance review",
    ));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("public-boundary scan inspects staged content separately from the working tree", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-index-"));
  try {
    execFileSync("git", ["init", "--quiet"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: temporaryRepository });
    const fakeSecret = [["s", "k-"].join(""), "x".repeat(24)].join("");
    const fixturePath = path.join(temporaryRepository, "fixture.txt");
    fs.writeFileSync(fixturePath, `staged ${fakeSecret}\n`, "utf8");
    const secretPath = `${fakeSecret}.txt`;
    fs.writeFileSync(path.join(temporaryRepository, secretPath), "safe content\n", "utf8");
    const liveEvalPath = path.join(temporaryRepository, "artifacts", "live-evals", "run.json");
    fs.mkdirSync(path.dirname(liveEvalPath), { recursive: true });
    fs.writeFileSync(liveEvalPath, '{"output":"synthetic"}\n', "utf8");
    const environmentPath = path.join(temporaryRepository, ".env", "config.json");
    fs.mkdirSync(path.dirname(environmentPath), { recursive: true });
    fs.writeFileSync(environmentPath, "{}\n", "utf8");
    execFileSync("git", ["add", "fixture.txt", secretPath], { cwd: temporaryRepository });
    execFileSync("git", ["add", "--force", "artifacts/live-evals/run.json"], {
      cwd: temporaryRepository,
    });
    execFileSync("git", ["add", "--force", ".env/config.json"], {
      cwd: temporaryRepository,
    });
    fs.writeFileSync(fixturePath, "safe working tree\n", "utf8");
    const findings = scanGitIndex(temporaryRepository);
    assert.ok(findings.includes("fixture.txt [index]: possible OpenAI-style secret"));
    assert.ok(findings.includes(
      "repository path [index]: possible OpenAI-style secret",
    ));
    assert.ok(findings.includes(
      "artifacts/live-evals/run.json [index]: forbidden raw trace directory",
    ));
    assert.ok(findings.includes(".env/config.json [index]: forbidden environment file"));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("public-boundary classifier rejects Windows and Unix home paths", () => {
  const windowsPath = ["C:", "Users", "example", "project"].join("/");
  const unixPath = ["", "home", "example", "project"].join("/");
  assert.deepEqual(classifyText(windowsPath), ["local home path"]);
  assert.deepEqual(classifyText(unixPath), ["local home path"]);
});

test("license verifier scans dependencies nested under workspace node_modules", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-license-"));
  try {
    const nestedPath = path.join(temporaryRepository, "apps", "replay-web", "node_modules", "fixture");
    fs.mkdirSync(nestedPath, { recursive: true });
    fs.writeFileSync(path.join(temporaryRepository, "package.json"), JSON.stringify({
      name: "fixture-root",
      version: "1.0.0",
      license: "Apache-2.0",
    }));
    fs.copyFileSync(fromRoot("LICENSE"), path.join(temporaryRepository, "LICENSE"));
    fs.writeFileSync(path.join(nestedPath, "package.json"), JSON.stringify({
      name: "nested-dependency",
      version: "1.0.0",
      license: "Proprietary",
    }));
    fs.writeFileSync(path.join(temporaryRepository, "package-lock.json"), JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { name: "fixture-root", version: "1.0.0", license: "Apache-2.0" },
        "apps/replay-web/node_modules/fixture": {
          name: "nested-dependency",
          version: "1.0.0",
          license: "Proprietary",
        },
      },
    }));
    assert.deepEqual(verifyLicensesAtRoot(temporaryRepository), [
      "nested-dependency@1.0.0: unreviewed license Proprietary",
    ]);
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("license verifier locks repository and workspace Apache-2.0 declarations and text", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-repository-license-"));
  try {
    const workspace = path.join(temporaryRepository, "packages", "example");
    fs.mkdirSync(workspace, { recursive: true });
    fs.writeFileSync(path.join(temporaryRepository, "package.json"), JSON.stringify({
      name: "fixture-root",
      version: "1.0.0",
      license: "MIT",
      workspaces: ["packages/*"],
    }));
    fs.writeFileSync(path.join(workspace, "package.json"), JSON.stringify({
      name: "fixture-workspace",
      version: "1.0.0",
      license: "MIT",
    }));
    fs.writeFileSync(path.join(temporaryRepository, "package-lock.json"), JSON.stringify({
      lockfileVersion: 3,
      packages: {},
    }));
    fs.writeFileSync(path.join(temporaryRepository, "LICENSE"), "Apache License\nVersion 2.0\n");
    assert.deepEqual(verifyLicensesAtRoot(temporaryRepository), [
      "package.json: repository license must be Apache-2.0",
      "packages/example/package.json: workspace license must be Apache-2.0",
      "LICENSE: content must match canonical Apache-2.0 text",
    ]);
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("current work packages satisfy the executable handoff schema", async () => {
  assert.deepEqual(
    await validateWorkPackagesOffline(
      loadWorkPackages(),
      readText("docs/acceptance/catalog.md"),
      loadAcceptedPlans(),
    ),
    [],
  );
});

test("work-package verifier requires accepted plans to resolve", async () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  assert.ok(foundation);
  foundation.acceptedPlan = "VSC-PLAN-2099-01-01.1";
  foundation.metadata.accepted_plan = foundation.acceptedPlan;
  const errors = await validateWorkPackagesOffline(
    packages,
    readText("docs/acceptance/catalog.md"),
    loadAcceptedPlans(),
  );
  assert.ok(errors.some((error) => error.includes("does not resolve to an Accepted plan record")));
});

test("work-package verifier rejects cross-milestone acceptance ownership", async () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  assert.ok(foundation);
  foundation.acceptance.push("VSC-PROOF-001");
  foundation.metadata.acceptance = foundation.acceptance.join(", ");
  const errors = await validateWorkPackagesOffline(packages, readText("docs/acceptance/catalog.md"));
  assert.ok(errors.some((error) =>
    error.includes("acceptance gate VSC-PROOF-001 is owned by WP-2026-002")));
});

test("accepted seed packages cannot bypass the foundation dependency chain", async () => {
  const packages = structuredClone(loadWorkPackages());
  const proofPackage = packages.find((item) => item.id === "WP-2026-002");
  assert.ok(proofPackage);
  proofPackage.dependsOn = [];
  proofPackage.metadata.depends_on = "none";
  proofPackage.status = "Ready";
  proofPackage.metadata.status = "Ready";
  const errors = await validateWorkPackagesOffline(
    packages,
    readText("docs/acceptance/catalog.md"),
  );
  assert.ok(errors.some((error) =>
    error.includes("accepted seed dependency must be WP-2026-001")));
});

test("work-package verifier rejects duplicate required sections", async () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  assert.ok(foundation);
  foundation.body += "\n\n## Next action\n\n- Conflicting second action.\n";
  const errors = await validateWorkPackagesOffline(packages, readText("docs/acceptance/catalog.md"));
  assert.ok(errors.some((error) => error.includes("duplicate Next action section")));
});

test("work-package verifier rejects unsupported promotion and empty Done evidence", async () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  const dependent = packages[1];
  assert.ok(foundation && dependent);

  foundation.status = "Done";
  foundation.body = foundation.body
    .replace(
      /## Validation\n[\s\S]*?(?=\n## Delivery evidence)/,
      "## Validation\n\nNo validation evidence exists.\n",
    )
    .replace(
      /## Delivery evidence\n[\s\S]*?(?=\n## Known limitations and blockers)/,
      "## Delivery evidence\n\nNo delivery evidence exists.\n",
    );
  dependent.status = "Ready";

  const errors = await validateWorkPackagesOffline(packages, readText("docs/acceptance/catalog.md"));
  assert.ok(errors.some((error) => error.includes("Done work requires exact completed validation")));
  assert.ok(errors.some((error) => error.includes("Done work requires a linked")));
});

test("work-package verifier ties a passing result directly to npm run verify", async () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  assert.ok(foundation);
  foundation.status = "Done";
  foundation.body = foundation.body
    .replace(
      /## Validation\n[\s\S]*?(?=\n## Delivery evidence)/,
      "## Validation\n\n- `npm run verify` did not pass; documentation passed.\n",
    )
    .replace(
      /## Delivery evidence\n[\s\S]*?(?=\n## Known limitations and blockers)/,
      "## Delivery evidence\n\n[PR](https://github.com/memorex386/verified-sudoku-coach/pull/1); commit `6afaeca0857b067b481e011bfa71d8d20f26fd39`.\n",
    );
  const errors = await validateWorkPackages(
    packages,
    readText("docs/acceptance/catalog.md"),
    loadAcceptedPlans(),
    () => true,
  );
  assert.ok(errors.some((error) => error.includes("exact completed validation commands/results")));
});

test("Done requires a PASS result for every listed validation command", async () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  assert.ok(foundation);
  foundation.status = "Done";
  foundation.body = foundation.body
    .replace(
      /(## Validation\n[\s\S]*?)(?=\n## Delivery evidence)/,
      "$1\n- `npm run verify`: PASS — fixture.\n",
    )
    .replace(
      /## Delivery evidence\n[\s\S]*?(?=\n## Known limitations and blockers)/,
      "## Delivery evidence\n\n[PR](https://github.com/memorex386/verified-sudoku-coach/pull/1); commit `6afaeca0857b067b481e011bfa71d8d20f26fd39`.\n",
    );
  const errors = await validateWorkPackages(
    packages,
    readText("docs/acceptance/catalog.md"),
    loadAcceptedPlans(),
    () => true,
  );
  assert.ok(errors.some((error) => error.includes("missing unambiguous PASS rows for npm ci")));
});

test("work-package verifier rejects shaped but nonexistent Done evidence", async () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  assert.ok(foundation);
  foundation.status = "Done";
  foundation.body = foundation.body
    .replace(
      /## Validation\n[\s\S]*?(?=\n## Delivery evidence)/,
      "## Validation\n\n`npm run verify` passed.\n",
    )
    .replace(
      /## Delivery evidence\n[\s\S]*?(?=\n## Known limitations and blockers)/,
      "## Delivery evidence\n\nPR https://github.com/example/example/pull/1; commit `deadbee`.\n",
    );
  const errors = await validateWorkPackagesOffline(packages, readText("docs/acceptance/catalog.md"));
  assert.ok(errors.some((error) => error.includes("remote head/tag")));
});

test("work-package verifier rejects a real commit paired with another repository", async () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  assert.ok(foundation);
  foundation.status = "Done";
  foundation.body = foundation.body
    .replace(
      /## Validation\n[\s\S]*?(?=\n## Delivery evidence)/,
      "## Validation\n\n`npm run verify` passed.\n",
    )
    .replace(
      /## Delivery evidence\n[\s\S]*?(?=\n## Known limitations and blockers)/,
      "## Delivery evidence\n\n[PR](https://github.com/attacker/fake/pull/999); commit `6afaeca0857b067b481e011bfa71d8d20f26fd39`.\n",
    );
  const errors = await validateWorkPackagesOffline(packages, readText("docs/acceptance/catalog.md"));
  assert.ok(errors.some((error) => error.includes("memorex386/verified-sudoku-coach")));
});

test("work-package verifier rejects a nonexistent same-repository review", async () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  assert.ok(foundation);
  foundation.status = "Done";
  foundation.body = foundation.body
    .replace(
      /## Validation\n[\s\S]*?(?=\n## Delivery evidence)/,
      "## Validation\n\n```powershell\nnpm run verify\n```\n\n`npm run verify` passed.\n",
    )
    .replace(
      /## Delivery evidence\n[\s\S]*?(?=\n## Known limitations and blockers)/,
      "## Delivery evidence\n\n[PR](https://github.com/memorex386/verified-sudoku-coach/pull/999999); commit `6afaeca0857b067b481e011bfa71d8d20f26fd39`.\n",
    );
  const errors = await validateWorkPackages(
    packages,
    readText("docs/acceptance/catalog.md"),
    loadAcceptedPlans(),
    () => false,
  );
  assert.ok(errors.some((error) => error.includes("remote head/tag")));
});

test("remote Done evidence requires a merged PR or published release", async () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-done-evidence-"));
  try {
    execFileSync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.name", "Fixture Author"], { cwd: temporaryRepository });
    execFileSync("git", ["config", "user.email", "fixture@example.test"], { cwd: temporaryRepository });
    const workPackageDirectory = path.join(temporaryRepository, "docs", "work-packages");
    fs.mkdirSync(workPackageDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(workPackageDirectory, "WP-2026-001-foundation.md"),
      "# Fixture\n",
      "utf8",
    );
    execFileSync("git", ["add", "."], { cwd: temporaryRepository });
    execFileSync("git", ["commit", "--quiet", "-m", "add work package"], {
      cwd: temporaryRepository,
    });
    const revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: temporaryRepository,
      encoding: "utf8",
    }).trim();
    const getRemoteShas = () => new Set([revision]);
    const mergedPull = {
      state: "closed",
      merged: true,
      draft: false,
      base: { ref: "main" },
      head: { sha: revision },
      merged_at: "2026-09-03T00:00:00Z",
    };
    const options = {
      repositoryRoot: temporaryRepository,
      getRemoteShas,
      getGitHubJson: async () => mergedPull,
    };
    assert.equal(await verifyRemoteReviewEvidenceWith(
      { kind: "pull", value: "7" },
      [revision],
      "WP-2026-001",
      options,
    ), true);
    assert.equal(await verifyRemoteReviewEvidenceWith(
      { kind: "pull", value: "7" },
      [revision],
      "WP-2026-001",
      {
        ...options,
        getGitHubJson: async () => ({ ...mergedPull, state: "open", merged: false }),
      },
    ), false);
    assert.equal(await verifyRemoteReviewEvidenceWith(
      { kind: "release", value: "v1.0.0" },
      [revision],
      "WP-2026-001",
      {
        ...options,
        getGitHubJson: async () => null,
      },
    ), false);
    assert.equal(await verifyRemoteReviewEvidenceWith(
      { kind: "release", value: "v1.0.0" },
      [revision],
      "WP-2026-001",
      {
        ...options,
        getGitHubJson: async () => ({
          draft: false,
          tag_name: "v1.0.0",
          published_at: "2026-09-03T00:00:00Z",
        }),
      },
    ), true);
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("work-package verifier requires exactly one next action", async () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  assert.ok(foundation);
  foundation.body = foundation.body.replace(
    /(## Next action\n\n- .+\n)/,
    "$1- Start a second competing action.\n",
  );
  const errors = await validateWorkPackagesOffline(packages, readText("docs/acceptance/catalog.md"));
  assert.ok(errors.some((error) => error.includes("Next action must contain exactly one list item")));
});

test("work-package verifier requires executable validation commands before handoff", async () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  assert.ok(foundation);
  foundation.body = foundation.body.replace(
    /## Validation\n[\s\S]*?(?=\n## Delivery evidence)/,
    "## Validation\n\nRun the complete suite.\n",
  );
  const errors = await validateWorkPackagesOffline(packages, readText("docs/acceptance/catalog.md"));
  assert.ok(errors.some((error) => error.includes("at least one exact executable command")));
});

test("checkpoint history follows work-package ID across a filename change", () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  assert.ok(foundation);
  foundation.file = "docs/work-packages/WP-2026-001-renamed.md";
  foundation.checkpointContent = "- 2026-09-03 — rewritten history";
  const errors = validateCheckpointHistory(packages, [{
    file: "docs/work-packages/WP-2026-001-original.md",
    id: "WP-2026-001",
    status: "In progress",
    checkpointContent: "- 2026-09-03 — original history",
  }]);
  assert.deepEqual(errors, [
    "docs/work-packages/WP-2026-001-renamed.md: checkpoints must preserve the exact base history and append only",
  ]);
});

test("checkpoint history preserves multiline content and enforces lifecycle transitions", () => {
  const base = [{
    file: "docs/work-packages/WP-2026-009-result.md",
    id: "WP-2026-009",
    status: "Done",
    checkpointContent: "- 2026-09-03 — sealed evidence\n  with reviewed denominators",
  }];
  const demoted = [{
    file: base[0].file,
    id: base[0].id,
    status: "Draft",
    checkpointContent: base[0].checkpointContent,
  }];
  assert.ok(validateCheckpointHistory(demoted, base).some((error) =>
    error.includes("invalid work-package status transition Done -> Draft")));

  const rewritten = structuredClone(demoted);
  rewritten[0].status = "Done";
  rewritten[0].checkpointContent = "- 2026-09-03 — sealed evidence\n  with changed denominators";
  assert.ok(validateCheckpointHistory(rewritten, base).some((error) =>
    error.includes("preserve the exact base history")));

  const appended = structuredClone(rewritten);
  appended[0].checkpointContent = `${base[0].checkpointContent}\n- 2026-09-04 — appended correction`;
  assert.deepEqual(validateCheckpointHistory(appended, base), []);

  const active = [{
    ...base[0],
    status: "In progress",
  }];
  const activeDemoted = [{
    ...active[0],
    status: "Ready",
  }];
  assert.ok(validateCheckpointHistory(activeDemoted, active).some((error) =>
    error.includes("invalid work-package status transition In progress -> Ready")));
});

test("a not-started package may replace setup prose with its first checkpoint", () => {
  const base = [{
    file: "docs/work-packages/WP-2026-002-proof.md",
    id: "WP-2026-002",
    status: "Ready",
    checkpointContent: "Implementation has not begun.",
  }];
  const started = [{
    file: base[0].file,
    id: base[0].id,
    status: "In progress",
    checkpointContent: "- 2026-09-04 — implementation began",
  }];
  assert.deepEqual(validateCheckpointHistory(started, base), []);
});

test("work-package verifier rejects an all-zero push base", async () => {
  const previous = process.env.WORK_PACKAGE_BASE_REF;
  process.env.WORK_PACKAGE_BASE_REF = "0".repeat(40);
  try {
    const errors = await validateWorkPackagesOffline(
      loadWorkPackages(),
      readText("docs/acceptance/catalog.md"),
      loadAcceptedPlans(),
    );
    assert.ok(errors.includes("WORK_PACKAGE_BASE_REF must not be an all-zero revision"));
  } finally {
    if (previous === undefined) {
      delete process.env.WORK_PACKAGE_BASE_REF;
    } else {
      process.env.WORK_PACKAGE_BASE_REF = previous;
    }
  }
});

test("Ready permits decision-complete commands that implementation will create", async () => {
  const packages = structuredClone(loadWorkPackages());
  const foundation = packages[0];
  const proofPackage = packages[1];
  assert.ok(foundation && proofPackage);
  foundation.status = "Done";
  foundation.metadata.status = "Done";
  foundation.body = foundation.body
    .replace(
      /## Validation\n[\s\S]*?(?=\n## Delivery evidence)/,
      "## Validation\n\n```powershell\nnpm run verify\n```\n\n- `npm run verify`: PASS — fixture.\n",
    )
    .replace(
      /## Delivery evidence\n[\s\S]*?(?=\n## Known limitations and blockers)/,
      "## Delivery evidence\n\n[PR](https://github.com/memorex386/verified-sudoku-coach/pull/1); commit `6afaeca0857b067b481e011bfa71d8d20f26fd39`.\n",
    );
  proofPackage.status = "Ready";
  proofPackage.metadata.status = "Ready";
  assert.deepEqual(await validateWorkPackagesOffline(
    packages,
    readText("docs/acceptance/catalog.md"),
    loadAcceptedPlans(),
    () => true,
  ), []);
});

test("work-package verifier permits future schema-valid packages beyond the accepted seed", async () => {
  const packages = structuredClone(loadWorkPackages());
  const future = structuredClone(packages.at(-1));
  assert.ok(future);
  future.id = "WP-2027-001";
  future.metadata.id = future.id;
  future.title = "Future maintenance package";
  future.metadata.title = future.title;
  future.file = "docs/work-packages/WP-2027-001-future-maintenance.md";
  future.status = "Draft";
  future.metadata.status = future.status;
  future.dependsOn = ["WP-2026-009"];
  future.metadata.depends_on = "WP-2026-009";
  future.acceptance = ["VSC-MAINT-001"];
  future.metadata.acceptance = "VSC-MAINT-001";
  packages.push(future);
  const acceptanceContent = [
    readText("docs/acceptance/catalog.md"),
    "## VSC-MAINT-001 — Future maintenance evidence",
    "",
    "Owner: `WP-2027-001`",
    "",
    "The future package has one atomic observable outcome.",
    "",
  ].join("\n");
  assert.deepEqual(
    await validateWorkPackagesOffline(packages, acceptanceContent),
    [],
  );
});
