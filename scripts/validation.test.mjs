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
  classifyProviderBoundarySource,
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
  canonicalSkillNames,
  claudeAdapterBody,
  verifySkillsAtRoot,
} from "./verify-skills.mjs";
import {
  compareSemanticVersions,
  validateArtifactPath,
  validateOutputTokenBound,
  validateRegistrationIdentity,
  validateRuntimeRegistrationShape,
  validateRuntimeManifestTransition,
  validateTimeoutBound,
} from "./lib/runtime-ai.mjs";
import {
  browserBoundaryFromProviderPolicy,
  providerPolicyDigest,
  providerProfileDigest,
  validateProviderPolicy,
  validateProviderPolicyTransition,
  validateRuntimeProviderSelection,
} from "./lib/provider-policy.mjs";

function loadProviderPolicy() {
  return JSON.parse(readText("config/provider-policy.json"));
}

function signProviderProfile(profile) {
  profile.profileSha256 = providerProfileDigest(profile);
  return profile;
}

function signProviderPolicy(policy) {
  for (const profile of policy.profiles) {
    signProviderProfile(profile);
  }
  policy.policySha256 = providerPolicyDigest(policy);
  return policy;
}

function currentBrowserBoundary() {
  return browserBoundaryFromProviderPolicy(loadProviderPolicy());
}

function runtimeRegistrationFixture(profile, role = "observer") {
  return {
    id: `${role}-v1`,
    role,
    approvalStatus: "candidate",
    providerProfileId: profile.id,
    providerProfileSha256: profile.profileSha256,
    requestedModel: profile.modelsByRole[role],
    modelProfileVersion: profile.profileVersion,
    inferenceSettings: structuredClone(profile.inferenceSettingsByRole[role]),
    runtimeBehaviorVersion: "1.0.0",
    promptPath: `ai/prompts/${role}-v1.md`,
    promptVersion: "1.0.0",
    promptSha256: "a".repeat(64),
    schemaPath: `packages/contracts/schemas/${role}-v1.json`,
    schemaVersion: "1.0.0",
    schemaSha256: "b".repeat(64),
    rendererManifestPath: "packages/coach-core/renderers/deterministic-v1.json",
    rendererVersion: "1.0.0",
    rendererManifestSha256: "c".repeat(64),
    proofPolicyPath: "packages/proof-engine/policies/classic-v1.json",
    proofPolicyVersion: "1.0.0",
    proofPolicySha256: "d".repeat(64),
    evalSuiteManifestPath: "tools/eval-cli/suites/frozen-v1.json",
    evalSuiteVersion: "1.0.0",
    evalSuiteManifestSha256: "e".repeat(64),
    comparisonReportPath: `docs/evaluation/reports/${role}-v1.json`,
    comparisonReportSha256: "f".repeat(64),
    maxOutputTokens: role === "observer" ? 256 : 768,
    timeoutMs: role === "observer" ? 5_000 : 10_000,
    responseStoragePolicy: profile.dataHandling.responseStoragePolicy,
    automaticRetry: false,
    failurePolicy: "visible-pause",
  };
}
import {
  automationPolicyDigest,
  canonicalSha256,
  checkedInAutomationPolicyRegistry,
  dependencyPullRequestIdempotencyKey,
  dependencyPullRequestLineageKey,
  isSemverPatchUpdate,
  isTerminalAutomationOutcome,
  validateAutomationPolicy,
  validateAutomationPolicyAdmission,
  validateAutomationWorkOrder,
} from "./lib/automation-policy.mjs";
import {
  classifyDependencyPullRequest,
  comparePullRequestCas,
  createManifestObservation,
  dependencyFailureFingerprint,
} from "./lib/dependency-pr-normalizer.mjs";
import {
  createAutomationState as createControllerAutomationState,
  createAutomationStateFromLedger as createControllerAutomationStateFromLedger,
  readAutomationResult,
  readLineageAttempts,
  readLineageSnapshot,
  recordAutomationResult,
  recordLineageAttempts,
  startDependencyAutomationWithStores as startControllerDependencyAutomationWithStores,
  transitionAutomationWithLedger as transitionControllerAutomationWithLedger,
} from "./lib/automation-controller.mjs";
import { runAutomationFixture } from "./run-automation-fixture.mjs";
import { verifyAutomationPolicyAtRoot } from "./verify-automation-policy.mjs";

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

function createAgentDiscoveryFixture() {
  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-agent-discovery-"));
  const writeFixture = (relativePath, content) => {
    const absolutePath = path.join(repositoryRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, "utf8");
  };

  writeFixture(".gitignore", "CLAUDE.local.md\n");
  writeFixture(
    "AGENTS.md",
    "# Canonical agent guidance\n\nUse `work/<work-package-id>-<short-topic>`.\n",
  );
  writeFixture(
    "CONTRIBUTING.md",
    "# Contributing\n\nUse `work/<work-package-id>-<short-topic>`.\n",
  );
  writeFixture("CLAUDE.md", "@AGENTS.md\n");
  writeFixture(
    ".gemini/settings.json",
    `${JSON.stringify({ context: { fileName: "AGENTS.md" } }, null, 2)}\n`,
  );
  writeFixture(
    "docs/runbooks/agent-workflow.md",
    "# Agent workflow\n\nUse `work/<work-package-id>-<short-topic>`.\n",
  );

  for (const skillName of canonicalSkillNames) {
    const description = `Exercise the ${skillName} workflow through canonical policy.`;
    writeFixture(
      `.agents/skills/${skillName}/SKILL.md`,
      [
        "---",
        `name: ${skillName}`,
        `description: ${description}`,
        "---",
        "",
        "Follow the [agent workflow](../../../docs/runbooks/agent-workflow.md).",
        skillName === "work-on-coach"
          ? "Use `work/<work-package-id>-<short-topic>`."
          : "",
        "",
      ].join("\n"),
    );
    writeFixture(
      `.claude/skills/${skillName}/SKILL.md`,
      [
        "---",
        `name: ${skillName}`,
        `description: ${description}`,
        "---",
        claudeAdapterBody(skillName),
      ].join("\n"),
    );
  }

  return { repositoryRoot, writeFixture };
}

test("front matter parser preserves colon-containing values", () => {
  const parsed = parseFrontMatter("---\nid: WP-2026-001\nsource: https://example.test/a\n---\n# Body\n");
  assert.deepEqual(parsed.metadata, {
    id: "WP-2026-001",
    source: "https://example.test/a",
  });
  assert.equal(parsed.body, "# Body\n");
});

test("agent discovery adapters remain exact thin mirrors of canonical skills", () => {
  assert.deepEqual(verifySkillsAtRoot(fromRoot()), []);
});

test("agent discovery verifier rejects adapter policy and metadata drift", () => {
  const { repositoryRoot, writeFixture } = createAgentDiscoveryFixture();
  try {
    assert.deepEqual(verifySkillsAtRoot(repositoryRoot), []);
    const skillName = canonicalSkillNames[0];
    assert.ok(skillName);
    const adapterPath = `.claude/skills/${skillName}/SKILL.md`;
    fs.appendFileSync(path.join(repositoryRoot, adapterPath), "Never run validation.\n", "utf8");
    writeFixture(".claude/skills/unreviewed/notes.md", "second authority\n");

    const errors = verifySkillsAtRoot(repositoryRoot);
    assert.ok(errors.some((error) => error.includes("exact canonical pointer")));
    assert.ok(errors.some((error) => error.includes("unexpected Claude skill adapter file")));
  } finally {
    fs.rmSync(repositoryRoot, { recursive: true, force: true });
  }
});

test("agent discovery verifier fails closed on instruction and discovery changes", () => {
  const { repositoryRoot, writeFixture } = createAgentDiscoveryFixture();
  try {
    writeFixture("CLAUDE.md", "Duplicated vendor-specific rules.\n");
    writeFixture(
      ".gemini/settings.json",
      `${JSON.stringify({ context: { fileName: ["AGENTS.md", "GEMINI.md"] } }, null, 2)}\n`,
    );
    const missingSkill = canonicalSkillNames.at(-1);
    assert.ok(missingSkill);
    fs.rmSync(path.join(repositoryRoot, ".claude", "skills", missingSkill, "SKILL.md"));

    const errors = verifySkillsAtRoot(repositoryRoot);
    assert.ok(errors.some((error) => error.includes("canonical import")));
    assert.ok(errors.some((error) => error.includes("context.fileName")));
    assert.ok(errors.some((error) => error.includes("missing Claude skill adapter")));

    writeFixture("CONTRIBUTING.md", "Use `codex/<short-topic>`.\n");
    const branchErrors = verifySkillsAtRoot(repositoryRoot);
    assert.ok(branchErrors.some((error) => error.includes(
      "must use the vendor-neutral branch convention",
    )));
    assert.ok(branchErrors.some((error) => error.includes(
      "must not prescribe the retired vendor-specific branch convention",
    )));
  } finally {
    fs.rmSync(repositoryRoot, { recursive: true, force: true });
  }
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

function loadAutomationFixture() {
  return JSON.parse(readText(
    "scripts/fixtures/automation/dependabot-typescript-7-pr-2.json",
  ));
}

function policyRegistryFor(policy) {
  if (policy?.policyVersion === "VSC-AUTOMATION-1") {
    return checkedInAutomationPolicyRegistry();
  }
  return new Map([[
    policy?.policyVersion,
    {
      policyVersion: policy?.policyVersion,
      policySha256: policy?.policySha256,
      mode: policy?.mode,
      authorizationRef: `test-only:human-approved:${policy?.policyVersion}`,
    },
  ]]);
}

function replayIdentityFor(candidate) {
  return {
    repository: candidate.repository,
    pullRequestNumber: candidate.pullRequestNumber,
    baseSha: candidate.baseSha,
    headSha: candidate.headSha,
    failureFingerprint: candidate.failureFingerprint,
    policyVersion: candidate.policyVersion,
  };
}

function replayResultFor(policy, terminalOutcome, reasonCodes = []) {
  return {
    schemaVersion: 1,
    terminalOutcome,
    attempts: Object.fromEntries(Object.keys(policy.attemptCaps).map((name) => [name, 0])),
    reasonCodes,
  };
}

function replayResultFromState(state) {
  return {
    schemaVersion: 1,
    terminalOutcome: state.outcome,
    attempts: structuredClone(state.attempts),
    reasonCodes: structuredClone(state.reasonCodes),
  };
}

function createAutomationState(policy, workOrder) {
  return createControllerAutomationState(policy, workOrder, policyRegistryFor(policy));
}

function createAutomationStateFromLedger(policy, workOrder, lineageStore) {
  return createControllerAutomationStateFromLedger(
    policy,
    workOrder,
    lineageStore,
    policyRegistryFor(policy),
  );
}

function transitionAutomationWithLedger(policy, workOrder, state, event, lineageStore) {
  return transitionControllerAutomationWithLedger(
    policy,
    workOrder,
    state,
    event,
    lineageStore,
    policyRegistryFor(policy),
  );
}

function startDependencyAutomationWithStores(
  policy,
  workOrder,
  event,
  lineageStore,
  resultStore,
) {
  return startControllerDependencyAutomationWithStores(
    policy,
    workOrder,
    event,
    lineageStore,
    resultStore,
    policyRegistryFor(policy),
  );
}

function cleanAutomationFixture() {
  const policy = JSON.parse(readText("config/automation-policy.json"));
  const fixture = loadAutomationFixture();
  const baseSha = "a".repeat(40);
  const headSha = "b".repeat(40);
  const beforeManifest = {
    name: "verified-sudoku-coach",
    version: "0.0.0",
    private: true,
    license: "Apache-2.0",
    scripts: { verify: "npm run doctor && npm test" },
    devDependencies: { globals: "17.12.0" },
  };
  const afterManifest = structuredClone(beforeManifest);
  afterManifest.devDependencies.globals = "17.12.1";
  const manifestBefore = createManifestObservation(JSON.stringify(beforeManifest));
  const manifestAfter = createManifestObservation(JSON.stringify(afterManifest));
  const checks = policy.eligibility.requiredChecks.map((name) => ({
    name,
    outcome: "success",
    findingCodes: [],
  }));
  const failureFingerprint = dependencyFailureFingerprint([], checks);
  fixture.trustedEvent = {
    ...fixture.trustedEvent,
    eventId: "fixture-clean-pr-42",
    repository: "memorex386/verified-sudoku-coach",
    pullRequestNumber: 42,
    eventBaseSha: baseSha,
    eventHeadSha: headSha,
    currentBaseSha: baseSha,
    currentHeadSha: headSha,
  };
  fixture.evidence = {
    ...fixture.evidence,
    repository: fixture.trustedEvent.repository,
    pullRequestNumber: fixture.trustedEvent.pullRequestNumber,
    baseSha,
    headSha,
    dependencyName: "globals",
    manifestBefore,
    manifestAfter,
    diff: {
      baseSha,
      headSha,
      complete: true,
      files: [
        {
          path: "package.json",
          status: "modified",
          beforeSha256: manifestBefore.sha256,
          afterSha256: manifestAfter.sha256,
        },
        {
          path: "package-lock.json",
          status: "modified",
          beforeSha256: "c".repeat(64),
          afterSha256: "d".repeat(64),
        },
      ],
    },
    checks: { headSha, complete: true, items: checks },
    failureFingerprint,
    statefulChange: false,
    irreversibleChange: false,
  };
  const identity = {
    repository: fixture.trustedEvent.repository,
    pullRequestNumber: fixture.trustedEvent.pullRequestNumber,
    baseSha,
    headSha,
    failureFingerprint,
    policyVersion: policy.policyVersion,
  };
  fixture.workOrder = {
    schemaVersion: 1,
    workOrderId: "fixture-clean-pr-42-v1",
    workflow: "dependency-pr",
    repository: identity.repository,
    pullRequestNumber: identity.pullRequestNumber,
    baseSha,
    headSha,
    failureFingerprint,
    inputEvidenceSha256: "0".repeat(64),
    dependencyIntentSha256: "0".repeat(64),
    policyVersion: policy.policyVersion,
    policySha256: policy.policySha256,
    idempotencyKey: dependencyPullRequestIdempotencyKey(identity),
    lineageKey: dependencyPullRequestLineageKey(identity),
    capabilities: ["model-assessment", "repair-proposal", "repo-read", "sanitized-evidence-read"],
    authorizedGrantIds: [],
    modelEscalationAuthority: "deterministic-controller",
  };
  const normalized = classifyDependencyPullRequest(
    policy,
    fixture.trustedEvent,
    fixture.evidence,
  );
  fixture.workOrder.inputEvidenceSha256 = normalized.candidate.inputEvidenceSha256;
  fixture.workOrder.dependencyIntentSha256 = normalized.candidate.dependencyIntentSha256;
  return { policy, fixture };
}

function assistedAutomationFixture() {
  const { policy: shadowPolicy, fixture } = cleanAutomationFixture();
  const policy = structuredClone(shadowPolicy);
  policy.policyVersion = "VSC-AUTOMATION-2";
  policy.mode = "assisted";
  policy.policySha256 = automationPolicyDigest(policy);
  fixture.trustedEvent.policyVersion = policy.policyVersion;
  fixture.trustedEvent.policySha256 = policy.policySha256;
  fixture.evidence.policyVersion = policy.policyVersion;
  fixture.evidence.policySha256 = policy.policySha256;
  const normalized = classifyDependencyPullRequest(
    policy,
    fixture.trustedEvent,
    fixture.evidence,
    policyRegistryFor(policy),
  );
  assert.equal(normalized.eligible, true);
  fixture.workOrder = {
    ...fixture.workOrder,
    workOrderId: "fixture-assisted-pr-42-v2",
    policyVersion: policy.policyVersion,
    policySha256: policy.policySha256,
    failureFingerprint: normalized.candidate.failureFingerprint,
    inputEvidenceSha256: normalized.candidate.inputEvidenceSha256,
    dependencyIntentSha256: normalized.candidate.dependencyIntentSha256,
    idempotencyKey: normalized.candidate.idempotencyKey,
    lineageKey: normalized.candidate.lineageKey,
  };
  return { policy, fixture };
}

function simpleAutomationEvent(type, source) {
  return { schemaVersion: 1, type, source };
}

function classificationAutomationEvent(fixture) {
  return {
    schemaVersion: 1,
    type: "classification-evaluated",
    source: "deterministic-controller",
    trustedEvent: fixture.trustedEvent,
    evidence: fixture.evidence,
  };
}

function renewalAutomationEvent(fixture) {
  return {
    schemaVersion: 1,
    type: "work-order-renewed",
    source: "deterministic-controller",
    trustedEvent: fixture.trustedEvent,
    evidence: fixture.evidence,
  };
}

function rebindAutomationFixtureHead(policy, sourceFixture, headSha, suffix = "repaired") {
  const fixture = structuredClone(sourceFixture);
  fixture.trustedEvent = {
    ...fixture.trustedEvent,
    eventId: `${fixture.trustedEvent.eventId}-${suffix}`,
    authenticationReceiptSha256: "5".repeat(64),
    payloadSha256: "6".repeat(64),
    eventHeadSha: headSha,
    currentHeadSha: headSha,
  };
  fixture.evidence = {
    ...fixture.evidence,
    headSha,
    diff: { ...fixture.evidence.diff, headSha },
    checks: { ...fixture.evidence.checks, headSha },
  };
  const normalized = classifyDependencyPullRequest(
    policy,
    fixture.trustedEvent,
    fixture.evidence,
    policyRegistryFor(policy),
  );
  assert.equal(normalized.eligible, true);
  fixture.workOrder = {
    ...fixture.workOrder,
    workOrderId: `${fixture.workOrder.workOrderId}-${suffix}`,
    headSha,
    failureFingerprint: normalized.candidate.failureFingerprint,
    inputEvidenceSha256: normalized.candidate.inputEvidenceSha256,
    dependencyIntentSha256: normalized.candidate.dependencyIntentSha256,
    idempotencyKey: normalized.candidate.idempotencyKey,
    lineageKey: normalized.candidate.lineageKey,
  };
  return fixture;
}

function substituteAutomationDependency(
  policy,
  sourceFixture,
  dependencyName,
  currentVersion,
  proposedVersion,
) {
  const fixture = structuredClone(sourceFixture);
  const before = JSON.parse(fixture.evidence.manifestBefore.content);
  before.devDependencies = { [dependencyName]: currentVersion };
  const after = structuredClone(before);
  after.devDependencies[dependencyName] = proposedVersion;
  fixture.evidence.manifestBefore = createManifestObservation(JSON.stringify(before));
  fixture.evidence.manifestAfter = createManifestObservation(JSON.stringify(after));
  fixture.evidence.dependencyName = dependencyName;
  fixture.evidence.diff.files = fixture.evidence.diff.files.map((file) =>
    file.path === "package.json"
      ? {
        ...file,
        beforeSha256: fixture.evidence.manifestBefore.sha256,
        afterSha256: fixture.evidence.manifestAfter.sha256,
      }
      : file);
  const normalized = classifyDependencyPullRequest(
    policy,
    fixture.trustedEvent,
    fixture.evidence,
    policyRegistryFor(policy),
  );
  assert.equal(normalized.eligible, true);
  fixture.workOrder = {
    ...fixture.workOrder,
    workOrderId: `${fixture.workOrder.workOrderId}-substitution`,
    failureFingerprint: normalized.candidate.failureFingerprint,
    inputEvidenceSha256: normalized.candidate.inputEvidenceSha256,
    dependencyIntentSha256: normalized.candidate.dependencyIntentSha256,
    idempotencyKey: normalized.candidate.idempotencyKey,
  };
  return fixture;
}

function startCleanDependencyAutomation(
  policy,
  fixture,
  workOrder = fixture.workOrder,
  initialState = createAutomationState(policy, workOrder),
) {
  const started = transitionAutomation(
    policy,
    workOrder,
    initialState,
    classificationAutomationEvent(fixture),
  );
  assert.equal(started.state.phase, "cheap-model-assessment");
  return started.state;
}

function reachPatchAuthorization(
  policy,
  fixture,
  workOrder = fixture.workOrder,
  initialState = createAutomationState(policy, workOrder),
) {
  let state = startCleanDependencyAutomation(policy, fixture, workOrder, initialState);
  state = transitionAutomation(
    policy,
    workOrder,
    state,
    simpleAutomationEvent("assessment-repair-proposed", "model-adapter"),
  ).state;
  state = transitionAutomation(
    policy,
    workOrder,
    state,
    simpleAutomationEvent("repair-produced", "repair-worker"),
  ).state;
  assert.equal(state.phase, "patch-authorization");
  return state;
}

function grantFor(policy, workOrder, authorityName, grantRef) {
  const authority = policy.authority[authorityName];
  return {
    schemaVersion: 1,
    grantRef,
    grantId: authority.grantId,
    credentialClass: authority.credentialClass,
    authorizationRef: `human:${grantRef}`,
    issuerClass: "human-authorization",
    repository: workOrder.repository,
    pullRequestNumber: workOrder.pullRequestNumber,
    baseSha: workOrder.baseSha,
    headSha: workOrder.headSha,
    policyVersion: workOrder.policyVersion,
    policySha256: workOrder.policySha256,
    idempotencyKey: workOrder.idempotencyKey,
    inputEvidenceSha256: workOrder.inputEvidenceSha256,
    dependencyIntentSha256: workOrder.dependencyIntentSha256,
  };
}

function authorizationEvent(policy, workOrder, authorityName, grantRef) {
  return {
    schemaVersion: 1,
    type: "authorization-granted",
    source: "authorization-broker",
    authorityName,
    currentBaseSha: workOrder.baseSha,
    currentHeadSha: workOrder.headSha,
    grant: grantFor(policy, workOrder, authorityName, grantRef),
  };
}

function transitionAutomation(policy, workOrder, state, event) {
  const lineageStore = recordLineageAttempts(
    new Map(),
    state?.lineageKey,
    state?.attempts,
  );
  return transitionAutomationWithLedger(
    policy,
    workOrder,
    state,
    event,
    lineageStore,
  );
}

function lineageStateAtCap(policy, workOrder, attemptName) {
  const attempts = Object.fromEntries(
    Object.keys(policy.attemptCaps).map((name) => [
      name,
      name === attemptName ? policy.attemptCaps[name] : 0,
    ]),
  );
  const lineageStore = recordLineageAttempts(new Map(), workOrder.lineageKey, attempts);
  return {
    lineageStore,
    state: createAutomationStateFromLedger(policy, workOrder, lineageStore),
  };
}

function reachCiValidationAtHead(policy, fixture, initialState, publishedHeadSha) {
  const originalWorkOrder = fixture.workOrder;
  let state = reachPatchAuthorization(policy, fixture, originalWorkOrder, initialState);
  state = transitionAutomation(
    policy,
    originalWorkOrder,
    state,
    authorizationEvent(policy, originalWorkOrder, "patchPublication", "grant-patch-cap-path"),
  ).state;
  const published = transitionAutomation(policy, originalWorkOrder, state, {
    schemaVersion: 1,
    type: "patch-publication-succeeded",
    source: "source-control-broker",
    expectedBaseSha: originalWorkOrder.baseSha,
    expectedHeadSha: originalWorkOrder.headSha,
    currentBaseSha: originalWorkOrder.baseSha,
    currentHeadSha: originalWorkOrder.headSha,
    publishedHeadSha,
  });
  const renewedFixture = rebindAutomationFixtureHead(
    policy,
    fixture,
    publishedHeadSha,
    "cap-path",
  );
  const renewed = transitionAutomation(
    policy,
    renewedFixture.workOrder,
    published.state,
    renewalAutomationEvent(renewedFixture),
  );
  assert.equal(renewed.state.phase, "ci-validation");
  return {
    state: renewed.state,
    fixture: renewedFixture,
    workOrder: renewedFixture.workOrder,
  };
}

test("automation policy is exact, shadow-only, and independently authorized", () => {
  const policy = JSON.parse(readText("config/automation-policy.json"));
  assert.deepEqual(verifyAutomationPolicyAtRoot(), []);
  assert.deepEqual(validateAutomationPolicy(policy), []);

  const unknown = structuredClone(policy);
  unknown.unreviewed = true;
  unknown.authority.pullRequestMerge.unreviewed = true;
  const unknownErrors = validateAutomationPolicy(unknown);
  assert.ok(unknownErrors.includes("automation policy unknown field unreviewed"));
  assert.ok(unknownErrors.includes("policySha256 must match the canonical automation policy"));
  assert.ok(unknownErrors.includes(
    "authority.pullRequestMerge unknown field unreviewed",
  ));
  const missing = structuredClone(policy);
  delete missing.source.classification;
  assert.ok(validateAutomationPolicy(missing).includes("source missing classification"));

  const selfSelecting = structuredClone(policy);
  selfSelecting.modelRoute.selfSelection = "allowed";
  assert.ok(validateAutomationPolicy(selfSelecting).includes(
    "modelRoute.selfSelection must be forbidden",
  ));

  for (const cap of Object.keys(policy.attemptCaps)) {
    const unbounded = structuredClone(policy);
    unbounded.attemptCaps[cap] = 2;
    assert.ok(validateAutomationPolicy(unbounded).includes(
      `attemptCaps.${cap} must be an integer from 0 through 1`,
    ));
  }

  for (const authorityName of Object.keys(policy.authority)) {
    const automatic = structuredClone(policy);
    automatic.authority[authorityName].automatic = true;
    assert.ok(validateAutomationPolicy(automatic).includes(
      `shadow mode cannot automatically exercise authority.${authorityName}`,
    ));
  }

  const conflated = structuredClone(policy);
  conflated.authority.productionDeploy.grantId = "dependency-pr-merge";
  conflated.authority.productionDeploy.credentialClass = "source-control-merge";
  const conflatedErrors = validateAutomationPolicy(conflated);
  assert.ok(conflatedErrors.includes(
    "authority.productionDeploy.grantId must be unique",
  ));
  assert.ok(conflatedErrors.includes(
    "authority.productionDeploy.grantId must be production-deploy",
  ));
  assert.ok(conflatedErrors.includes(
    "authority.productionDeploy.credentialClass must be unique",
  ));
  assert.ok(validateAutomationPolicy(null).includes(
    "automation policy must be an exact object",
  ));
  const assisted = assistedAutomationFixture();
  assert.ok(validateAutomationPolicy(assisted.policy).some(
    (error) => error.includes("automation policy admission"),
  ));
  assert.deepEqual(
    validateAutomationPolicyAdmission(
      assisted.policy,
      policyRegistryFor(assisted.policy),
    ),
    [],
  );
  assert.ok(validateAutomationPolicyAdmission(assisted.policy, assisted.policy).includes(
    "automation policy admission registry must be a trusted Map",
  ));
  assert.equal(assisted.policy.mode, "assisted");
});

test("automation policy has bounded terminal outcomes and deterministic ordering", () => {
  const policy = JSON.parse(readText("config/automation-policy.json"));
  for (const outcome of [
    "verified",
    "completed",
    "deferred",
    "stale",
    "awaiting-approval",
    "escalated",
    "failed-terminal",
    "reverted",
  ]) {
    assert.equal(isTerminalAutomationOutcome(policy, outcome), true);
  }
  assert.equal(isTerminalAutomationOutcome(policy, "retrying"), false);

  const incomplete = structuredClone(policy);
  incomplete.terminalOutcomes.pop();
  assert.ok(validateAutomationPolicy(incomplete).includes(
    "terminalOutcomes must be exactly verified, completed, deferred, stale, awaiting-approval, escalated, failed-terminal, reverted",
  ));

  const modelFirst = structuredClone(policy);
  modelFirst.decisionOrder.reverse();
  assert.ok(validateAutomationPolicy(modelFirst).includes(
    "decisionOrder must classify deterministically before model stages and terminate",
  ));
});

test("dependency evidence normalizer derives a clean patch without caller-authored trust", () => {
  const { policy, fixture } = cleanAutomationFixture();
  const result = classifyDependencyPullRequest(
    policy,
    fixture.trustedEvent,
    fixture.evidence,
  );
  assert.equal(result.eligible, true);
  assert.equal(result.nextStage, "cheap-model-assessment");
  assert.equal(result.terminalOutcome, null);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.candidate.dependencyName, "globals");
  assert.equal(result.candidate.dependencySection, "devDependencies");
  assert.equal(result.candidate.currentVersion, "17.12.0");
  assert.equal(result.candidate.proposedVersion, "17.12.1");
  assert.deepEqual(result.candidate.riskCodes, []);
  assert.equal(
    result.candidate.idempotencyKey,
    dependencyPullRequestIdempotencyKey(result.candidate),
  );
  assert.equal(isSemverPatchUpdate("1.2.3", "1.2.4"), true);
  assert.equal(isSemverPatchUpdate("1.2.3", "1.3.0"), false);
  assert.equal(isSemverPatchUpdate("1.2.3", "2.0.0"), false);
  assert.equal(isSemverPatchUpdate("1.2.3", "1.2.4-beta.1"), false);
});

test("authenticated event identity fails closed for hostile actors and all SHA drift", () => {
  const { policy, fixture } = cleanAutomationFixture();
  const hostile = structuredClone(fixture.trustedEvent);
  hostile.authenticatedActor = "attacker[bot]";
  const hostileResult = classifyDependencyPullRequest(policy, hostile, fixture.evidence);
  assert.equal(hostileResult.terminalOutcome, "deferred");
  assert.equal(hostileResult.nextStage, null);
  assert.ok(hostileResult.reasons.includes("authenticated source actor is not allowlisted"));

  for (const field of ["eventBaseSha", "eventHeadSha"]) {
    const staleEvent = structuredClone(fixture.trustedEvent);
    staleEvent[field] = "e".repeat(40);
    const stale = classifyDependencyPullRequest(policy, staleEvent, fixture.evidence);
    assert.equal(stale.terminalOutcome, "stale");
    assert.equal(stale.nextStage, null);
  }
  for (const field of ["baseSha", "headSha"]) {
    const wrongEvidence = structuredClone(fixture.evidence);
    wrongEvidence[field] = "f".repeat(40);
    const stale = classifyDependencyPullRequest(
      policy,
      fixture.trustedEvent,
      wrongEvidence,
    );
    assert.equal(stale.terminalOutcome, "stale");
  }
  const wrongCheckSha = structuredClone(fixture.evidence);
  wrongCheckSha.checks.headSha = "e".repeat(40);
  assert.equal(
    classifyDependencyPullRequest(policy, fixture.trustedEvent, wrongCheckSha)
      .terminalOutcome,
    "stale",
  );
  const cas = comparePullRequestCas(
    {
      repository: fixture.trustedEvent.repository,
      pullRequestNumber: 42,
      baseSha: "a".repeat(40),
      headSha: "b".repeat(40),
    },
    {
      repository: fixture.trustedEvent.repository,
      pullRequestNumber: 42,
      baseSha: "a".repeat(40),
      headSha: "c".repeat(40),
    },
  );
  assert.equal(cas.matches, false);
  assert.equal(cas.terminalOutcome, "stale");
  const malformedEqual = comparePullRequestCas(
    { repository: "bad", pullRequestNumber: 0, baseSha: "main", headSha: "head" },
    { repository: "bad", pullRequestNumber: 0, baseSha: "main", headSha: "head" },
  );
  assert.equal(malformedEqual.matches, false);
  assert.equal(malformedEqual.terminalOutcome, "stale");
});

test("malformed policy, event, evidence, and self-asserted trust never throw", () => {
  const { policy, fixture } = cleanAutomationFixture();
  for (const [changedPolicy, event, evidence] of [
    [null, fixture.trustedEvent, fixture.evidence],
    [policy, null, fixture.evidence],
    [policy, fixture.trustedEvent, null],
  ]) {
    assert.doesNotThrow(() => classifyDependencyPullRequest(changedPolicy, event, evidence));
    assert.equal(
      classifyDependencyPullRequest(changedPolicy, event, evidence).terminalOutcome,
      "failed-terminal",
    );
  }
  const selfAsserted = structuredClone(fixture.evidence);
  selfAsserted.authenticatedActor = "dependabot[bot]";
  const result = classifyDependencyPullRequest(policy, fixture.trustedEvent, selfAsserted);
  assert.equal(result.terminalOutcome, "failed-terminal");
  assert.equal(result.candidate, null);

  const malformedState = {
    ...createAutomationState(policy, fixture.workOrder),
    reasonCodes: null,
  };
  assert.doesNotThrow(() => transitionAutomation(
    policy,
    fixture.workOrder,
    malformedState,
    classificationAutomationEvent(fixture),
  ));
  assert.equal(
    transitionAutomation(
      policy,
      fixture.workOrder,
      malformedState,
      classificationAutomationEvent(fixture),
    ).state.outcome,
    "failed-terminal",
  );
  const unclonableState = createAutomationState(policy, fixture.workOrder);
  unclonableState.identity.repository = () => "hostile";
  assert.doesNotThrow(() => transitionAutomation(
    policy,
    fixture.workOrder,
    unclonableState,
    classificationAutomationEvent(fixture),
  ));
  const unclonableRejected = transitionAutomation(
    policy,
    fixture.workOrder,
    unclonableState,
    classificationAutomationEvent(fixture),
  );
  assert.equal(unclonableRejected.state.outcome, "failed-terminal");
  assert.equal(unclonableRejected.effects.length, 0);

  const cyclicState = createAutomationState(policy, fixture.workOrder);
  cyclicState.history = [cyclicState];
  assert.doesNotThrow(() => transitionAutomation(
    policy,
    fixture.workOrder,
    cyclicState,
    classificationAutomationEvent(fixture),
  ));
  assert.equal(
    transitionAutomation(
      policy,
      fixture.workOrder,
      cyclicState,
      classificationAutomationEvent(fixture),
    ).state.outcome,
    "failed-terminal",
  );

  const unclonableDedupe = recordAutomationResult(new Map(), {
    idempotencyKey: fixture.workOrder.idempotencyKey,
    inputEvidenceSha256: fixture.workOrder.inputEvidenceSha256,
    replayIdentity: replayIdentityFor(fixture.workOrder),
    result: { value: () => "hostile" },
  });
  assert.equal(unclonableDedupe.conflict, true);
  assert.equal(unclonableDedupe.result.terminalOutcome, "failed-terminal");
});

test("TypeScript major update risk is derived even when the caller cannot supply risk codes", () => {
  const policy = JSON.parse(readText("config/automation-policy.json"));
  const fixture = loadAutomationFixture();
  const result = classifyDependencyPullRequest(
    policy,
    fixture.trustedEvent,
    fixture.evidence,
  );
  assert.equal(result.eligible, false);
  assert.equal(result.nextStage, null);
  assert.equal(result.terminalOutcome, "deferred");
  assert.deepEqual(result.candidate.riskCodes, [
    "compiler-or-build-tool",
    "peer-conflict",
  ]);
  assert.equal(result.candidate.currentVersion, "5.9.2");
  assert.equal(result.candidate.proposedVersion, "7.0.2");

  const forged = structuredClone(fixture.evidence);
  forged.riskCodes = [];
  assert.equal(
    classifyDependencyPullRequest(policy, fixture.trustedEvent, forged).terminalOutcome,
    "failed-terminal",
  );
  const forgedDependency = structuredClone(fixture.evidence);
  forgedDependency.dependencyName = "globals";
  const forgedDependencyResult = classifyDependencyPullRequest(
    policy,
    fixture.trustedEvent,
    forgedDependency,
  );
  assert.equal(forgedDependencyResult.terminalOutcome, "deferred");
  assert.equal(forgedDependencyResult.candidate.dependencyName, "typescript");
  assert.ok(forgedDependencyResult.candidate.riskCodes.includes(
    "compiler-or-build-tool",
  ));
});

test("manifest, path, check, and telemetry risks are deterministically derived", () => {
  const { policy, fixture } = cleanAutomationFixture();
  const changed = structuredClone(fixture.evidence);
  const after = JSON.parse(changed.manifestAfter.content);
  after.license = "MIT";
  after.scripts.postinstall = "node install.js";
  changed.manifestAfter = createManifestObservation(JSON.stringify(after));
  changed.diff.files.find((file) => file.path === "package.json").afterSha256 =
    changed.manifestAfter.sha256;
  changed.diff.files.push(
    {
      path: ".github/workflows/release.yml",
      status: "modified",
      beforeSha256: "1".repeat(64),
      afterSha256: "2".repeat(64),
    },
    {
      path: "native/binding.node",
      status: "added",
      beforeSha256: "3".repeat(64),
      afterSha256: "4".repeat(64),
    },
    {
      path: "security/auth.ts",
      status: "modified",
      beforeSha256: "5".repeat(64),
      afterSha256: "6".repeat(64),
    },
  );
  changed.checks.items = changed.checks.items.filter((check) => check.name !== "codeql");
  const dependencyReview = changed.checks.items.find(
    (check) => check.name === "dependency-review",
  );
  dependencyReview.outcome = "failure";
  dependencyReview.findingCodes = ["vulnerability-increase"];
  const first = classifyDependencyPullRequest(policy, fixture.trustedEvent, changed);
  changed.failureFingerprint = first.candidate.failureFingerprint;
  const result = classifyDependencyPullRequest(policy, fixture.trustedEvent, changed);
  for (const risk of [
    "license-change",
    "lifecycle-script",
    "missing-telemetry",
    "native-dependency",
    "security-sensitive-surface",
    "source-change",
    "vulnerability-increase",
    "workflow-change",
  ]) {
    assert.ok(result.candidate.riskCodes.includes(risk), `missing derived ${risk}`);
  }
  assert.equal(result.terminalOutcome, "deferred");
});

test("fingerprints are canonical, order-invariant, caller-verified, and replay-safe", () => {
  const { policy, fixture } = cleanAutomationFixture();
  const checks = fixture.evidence.checks.items;
  const forward = dependencyFailureFingerprint(
    ["peer-conflict", "compiler-or-build-tool"],
    checks,
  );
  const reversed = dependencyFailureFingerprint(
    ["compiler-or-build-tool", "peer-conflict"],
    [...checks].reverse(),
  );
  assert.equal(forward, reversed);

  const reordered = structuredClone(fixture.evidence);
  reordered.checks.items.reverse();
  reordered.diff.files.reverse();
  const normalized = classifyDependencyPullRequest(
    policy,
    fixture.trustedEvent,
    reordered,
  );
  assert.equal(normalized.eligible, true);
  assert.equal(normalized.candidate.failureFingerprint, fixture.evidence.failureFingerprint);
  const original = classifyDependencyPullRequest(
    policy,
    fixture.trustedEvent,
    fixture.evidence,
  );
  assert.equal(
    normalized.candidate.inputEvidenceSha256,
    original.candidate.inputEvidenceSha256,
  );

  const tampered = structuredClone(fixture.evidence);
  tampered.failureFingerprint = "f".repeat(64);
  const rejected = classifyDependencyPullRequest(policy, fixture.trustedEvent, tampered);
  assert.equal(rejected.terminalOutcome, "deferred");
  assert.ok(rejected.reasons.includes(
    "failureFingerprint does not match deterministic evidence",
  ));

  const verifiedState = transitionAutomation(
    policy,
    fixture.workOrder,
    startCleanDependencyAutomation(policy, fixture),
    simpleAutomationEvent("assessment-no-repair", "model-adapter"),
  ).state;
  const verifiedResult = replayResultFromState(verifiedState);

  const first = recordAutomationResult(new Map(), {
    idempotencyKey: normalized.candidate.idempotencyKey,
    inputEvidenceSha256: normalized.candidate.inputEvidenceSha256,
    replayIdentity: replayIdentityFor(normalized.candidate),
    result: verifiedResult,
    terminalState: verifiedState,
  });
  const replay = recordAutomationResult(first.store, {
    idempotencyKey: normalized.candidate.idempotencyKey,
    inputEvidenceSha256: normalized.candidate.inputEvidenceSha256,
    replayIdentity: replayIdentityFor(normalized.candidate),
    result: verifiedResult,
    terminalState: verifiedState,
  });
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.result, verifiedResult);
  const conflict = recordAutomationResult(first.store, {
    idempotencyKey: normalized.candidate.idempotencyKey,
    inputEvidenceSha256: "0".repeat(64),
    replayIdentity: replayIdentityFor(normalized.candidate),
    result: verifiedResult,
    terminalState: verifiedState,
  });
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.result.terminalOutcome, "failed-terminal");

  const invalidOutcome = recordAutomationResult(new Map(), {
    idempotencyKey: normalized.candidate.idempotencyKey,
    inputEvidenceSha256: normalized.candidate.inputEvidenceSha256,
    replayIdentity: replayIdentityFor(normalized.candidate),
    result: replayResultFor(policy, "not-a-terminal"),
    terminalState: verifiedState,
  });
  assert.equal(invalidOutcome.conflict, true);
  assert.equal(invalidOutcome.store.size, 0);

  const poisonedResult = {
    ...replayResultFor(policy, "completed"),
    unknown: "poison",
  };
  const poisonedStore = new Map([[
    normalized.candidate.idempotencyKey,
    {
      idempotencyKey: "different-key",
      inputEvidenceSha256: normalized.candidate.inputEvidenceSha256,
      replayIdentity: replayIdentityFor(normalized.candidate),
      result: poisonedResult,
      terminalState: verifiedState,
    },
  ]]);
  const rejectedPoison = recordAutomationResult(poisonedStore, {
    idempotencyKey: normalized.candidate.idempotencyKey,
    inputEvidenceSha256: normalized.candidate.inputEvidenceSha256,
    replayIdentity: replayIdentityFor(normalized.candidate),
    result: verifiedResult,
    terminalState: verifiedState,
  });
  assert.equal(rejectedPoison.replayed, false);
  assert.equal(rejectedPoison.conflict, true);
  assert.equal(rejectedPoison.result.terminalOutcome, "failed-terminal");
  assert.equal(readAutomationResult(
    poisonedStore,
    normalized.candidate.idempotencyKey,
  ), undefined);
});

test("composed dependency start replays after identity derivation and before effects", () => {
  const { policy, fixture } = cleanAutomationFixture();
  const candidate = classifyDependencyPullRequest(
    policy,
    fixture.trustedEvent,
    fixture.evidence,
  ).candidate;
  const verifiedState = transitionAutomation(
    policy,
    fixture.workOrder,
    startCleanDependencyAutomation(policy, fixture),
    simpleAutomationEvent("assessment-no-repair", "model-adapter"),
  ).state;
  const priorResult = replayResultFromState(verifiedState);
  const priorStore = recordAutomationResult(new Map(), {
    idempotencyKey: candidate.idempotencyKey,
    inputEvidenceSha256: candidate.inputEvidenceSha256,
    replayIdentity: replayIdentityFor(candidate),
    result: priorResult,
    terminalState: verifiedState,
  }).store;
  const event = classificationAutomationEvent(fixture);
  const replayLineageStore = recordLineageAttempts(
    new Map(),
    fixture.workOrder.lineageKey,
    verifiedState.attempts,
  );

  const replay = startDependencyAutomationWithStores(
    policy,
    fixture.workOrder,
    event,
    replayLineageStore,
    priorStore,
  );
  assert.equal(replay.replayed, true);
  assert.equal(replay.state, null);
  assert.deepEqual(replay.effects, []);
  assert.deepEqual(replay.result, priorResult);

  const eligibleReasonForgedStore = new Map(priorStore);
  const eligibleReasonForged = eligibleReasonForgedStore.get(candidate.idempotencyKey);
  eligibleReasonForged.result.reasonCodes = ["ci-failed"];
  eligibleReasonForged.terminalState.reasonCodes = ["ci-failed"];
  const eligibleReasonRejected = startDependencyAutomationWithStores(
    policy,
    fixture.workOrder,
    event,
    replayLineageStore,
    eligibleReasonForgedStore,
  );
  assert.equal(eligibleReasonRejected.replayed, false);
  assert.equal(eligibleReasonRejected.conflict, true);
  assert.deepEqual(eligibleReasonRejected.effects, []);

  const ledgerRejected = startDependencyAutomationWithStores(
    policy,
    fixture.workOrder,
    event,
    new Map(),
    priorStore,
  );
  assert.equal(ledgerRejected.replayed, false);
  assert.equal(ledgerRejected.conflict, true);
  assert.deepEqual(ledgerRejected.effects, []);

  const attempts = replayResultFor(policy, "verified").attempts;
  const lineageStore = recordLineageAttempts(
    new Map(),
    fixture.workOrder.lineageKey,
    attempts,
  );
  const started = startDependencyAutomationWithStores(
    policy,
    fixture.workOrder,
    event,
    lineageStore,
    new Map(),
  );
  assert.equal(started.replayed, false);
  assert.equal(started.state.phase, "cheap-model-assessment");
  assert.equal(started.effects.length, 1);
  assert.equal(started.effects[0].type, "invoke-model");

  const poisonedStore = new Map(priorStore);
  poisonedStore.get(candidate.idempotencyKey).result.unknown = "poison";
  const rejected = startDependencyAutomationWithStores(
    policy,
    fixture.workOrder,
    event,
    lineageStore,
    poisonedStore,
  );
  assert.equal(rejected.conflict, true);
  assert.equal(rejected.result.terminalOutcome, "failed-terminal");
  assert.deepEqual(rejected.effects, []);

  const majorFixture = loadAutomationFixture();
  const majorLineageStore = recordLineageAttempts(
    new Map(),
    majorFixture.workOrder.lineageKey,
    attempts,
  );
  const majorFirst = startDependencyAutomationWithStores(
    policy,
    majorFixture.workOrder,
    classificationAutomationEvent(majorFixture),
    majorLineageStore,
    new Map(),
  );
  const forgedStore = new Map(majorFirst.resultStore);
  const forgedRecord = forgedStore.get(majorFixture.workOrder.idempotencyKey);
  forgedRecord.result.terminalOutcome = "completed";
  forgedRecord.terminalState.phase = "completed";
  forgedRecord.terminalState.outcome = "completed";
  const contradicted = startDependencyAutomationWithStores(
    policy,
    majorFixture.workOrder,
    classificationAutomationEvent(majorFixture),
    majorFirst.lineageStore,
    forgedStore,
  );
  assert.equal(contradicted.replayed, false);
  assert.equal(contradicted.conflict, true);
  assert.equal(contradicted.result.terminalOutcome, "failed-terminal");
  assert.deepEqual(contradicted.effects, []);

  const reasonForgedStore = new Map(majorFirst.resultStore);
  const reasonForgedRecord = reasonForgedStore.get(majorFixture.workOrder.idempotencyKey);
  reasonForgedRecord.result.reasonCodes = ["deployment-verified"];
  reasonForgedRecord.terminalState.reasonCodes = ["deployment-verified"];
  const reasonContradicted = startDependencyAutomationWithStores(
    policy,
    majorFixture.workOrder,
    classificationAutomationEvent(majorFixture),
    majorFirst.lineageStore,
    reasonForgedStore,
  );
  assert.equal(reasonContradicted.replayed, false);
  assert.equal(reasonContradicted.conflict, true);
  assert.equal(reasonContradicted.result.terminalOutcome, "failed-terminal");
  assert.deepEqual(reasonContradicted.effects, []);
});

test("persisted grants and reason codes retain their live boundary limits", () => {
  const { policy, fixture } = assistedAutomationFixture();
  fixture.workOrder.authorizedGrantIds = ["dependency-patch-publish"];
  const authorized = transitionAutomation(
    policy,
    fixture.workOrder,
    reachPatchAuthorization(policy, fixture),
    authorizationEvent(policy, fixture.workOrder, "patchPublication", "bounded-grant"),
  ).state;
  assert.equal(authorized.phase, "patch-publication");

  for (const field of ["grantRef", "authorizationRef"]) {
    const poisoned = structuredClone(authorized);
    poisoned.history.at(-1).grantProof[field] = "x".repeat(513);
    if (field === "grantRef") {
      poisoned.consumedGrantRefs = ["x".repeat(513)];
    }
    poisoned.historySha256 = canonicalSha256(poisoned.history);
    const rejected = transitionAutomation(
      policy,
      fixture.workOrder,
      poisoned,
      simpleAutomationEvent("stage-timeout", "source-control-broker"),
    );
    assert.equal(rejected.state.outcome, "failed-terminal");
    assert.equal(rejected.effects.length, 0);
    assert.ok(rejected.state.reasonCodes.includes("invalid-controller-state"));
  }

  const reasonPoisoned = structuredClone(authorized);
  reasonPoisoned.reasonCodes = Array.from({ length: 33 }, (_, index) => `reason-${index}`);
  const reasonRejected = transitionAutomation(
    policy,
    fixture.workOrder,
    reasonPoisoned,
    simpleAutomationEvent("stage-timeout", "source-control-broker"),
  );
  assert.equal(reasonRejected.state.outcome, "failed-terminal");
  assert.equal(reasonRejected.effects.length, 0);
  assert.ok(reasonRejected.state.reasonCodes.includes("invalid-controller-state"));
});

test("work orders separate workflow authority and controller forbids model self-escalation", () => {
  const { policy, fixture } = cleanAutomationFixture();
  assert.deepEqual(validateAutomationWorkOrder(policy, fixture.workOrder), []);
  const releaseWorkOrder = {
    ...fixture.workOrder,
    workOrderId: "fixture-release-identity-v1",
    workflow: "release",
    idempotencyKey: "release:fixture:identity-v1",
    lineageKey: "release-lineage:fixture:identity-v1",
    capabilities: ["repo-read"],
    authorizedGrantIds: [],
  };
  assert.deepEqual(validateAutomationWorkOrder(policy, releaseWorkOrder), []);
  for (const key of ["idempotencyKey", "lineageKey"]) {
    const emptyIdentity = { ...releaseWorkOrder, [key]: "" };
    assert.ok(validateAutomationWorkOrder(policy, emptyIdentity).some(
      (error) => error.includes(`${key} must be a non-empty canonical bounded string`),
    ));
  }
  const overprivileged = structuredClone(fixture.workOrder);
  overprivileged.authorizedGrantIds = ["production-deploy"];
  assert.ok(validateAutomationWorkOrder(policy, overprivileged).includes(
    "automation work order authorizedGrantIds must be a sorted unique workflow-specific subset",
  ));
  assert.equal(createAutomationState(policy, overprivileged).outcome, "failed-terminal");

  const state = startCleanDependencyAutomation(policy, fixture);
  const selfEscalation = transitionAutomation(
    policy,
    fixture.workOrder,
    state,
    simpleAutomationEvent("model-escalation-requested", "model-adapter"),
  );
  assert.equal(selfEscalation.state.outcome, "failed-terminal");
  assert.equal(selfEscalation.effects.length, 0);
  assert.ok(selfEscalation.state.reasonCodes.includes("model-self-escalation-forbidden"));
  const spoofedController = transitionAutomation(
    policy,
    fixture.workOrder,
    state,
    simpleAutomationEvent("controller-escalation-approved", "deterministic-controller"),
  );
  assert.equal(spoofedController.state.outcome, "failed-terminal");
  assert.equal(spoofedController.effects.length, 0);
});

test("controller cannot bypass normalization or work-order capabilities", () => {
  const policy = JSON.parse(readText("config/automation-policy.json"));
  const typescriptFixture = loadAutomationFixture();
  const initial = createAutomationState(policy, typescriptFixture.workOrder);
  const bypass = transitionAutomation(
    policy,
    typescriptFixture.workOrder,
    initial,
    simpleAutomationEvent("classification-eligible", "deterministic-controller"),
  );
  assert.equal(bypass.state.outcome, "failed-terminal");
  assert.equal(bypass.effects.length, 0);
  const evaluated = transitionAutomation(
    policy,
    typescriptFixture.workOrder,
    initial,
    classificationAutomationEvent(typescriptFixture),
  );
  assert.equal(evaluated.state.outcome, "deferred");
  assert.equal(evaluated.effects.length, 0);
  assert.equal(evaluated.state.attempts.cheapAssessments, 0);

  for (const missing of ["model-assessment", "repo-read", "sanitized-evidence-read"]) {
    const clean = cleanAutomationFixture().fixture;
    clean.workOrder.capabilities = clean.workOrder.capabilities.filter(
      (capability) => capability !== missing,
    );
    const missingModelCapability = transitionAutomation(
      policy,
      clean.workOrder,
      createAutomationState(policy, clean.workOrder),
      classificationAutomationEvent(clean),
    );
    assert.equal(missingModelCapability.state.outcome, "failed-terminal", missing);
    assert.equal(missingModelCapability.effects.length, 0, missing);
  }

  const repairFixture = cleanAutomationFixture().fixture;
  const cheap = startCleanDependencyAutomation(policy, repairFixture);
  for (const missing of ["repair-proposal", "repo-read", "sanitized-evidence-read"]) {
    const repairRestricted = structuredClone(repairFixture.workOrder);
    repairRestricted.capabilities = repairRestricted.capabilities.filter(
      (capability) => capability !== missing,
    );
    const missingRepairCapability = transitionAutomation(
      policy,
      repairRestricted,
      cheap,
      simpleAutomationEvent("assessment-repair-proposed", "model-adapter"),
    );
    assert.equal(missingRepairCapability.state.outcome, "stale", missing);
    assert.equal(missingRepairCapability.effects.length, 0, missing);
  }
});

test("checked-in shadow policy cannot emit any external mutation effect", () => {
  const { policy, fixture } = cleanAutomationFixture();
  fixture.workOrder.authorizedGrantIds = ["dependency-patch-publish"];
  const state = reachPatchAuthorization(policy, fixture);
  const blocked = transitionAutomation(
    policy,
    fixture.workOrder,
    state,
    authorizationEvent(policy, fixture.workOrder, "patchPublication", "shadow-patch-grant"),
  );
  assert.equal(blocked.state.outcome, "deferred");
  assert.ok(blocked.state.reasonCodes.includes("shadow-mode-mutation-forbidden"));
  assert.equal(blocked.state.attempts.patchPublications, 0);
  assert.deepEqual(blocked.effects, []);
});

test("controller rejects cross-workflow and prerequisite-free persisted phases", () => {
  const { policy, fixture } = cleanAutomationFixture();
  const releaseWorkOrder = {
    ...fixture.workOrder,
    workOrderId: "fixture-release-forgery-v1",
    workflow: "release",
    idempotencyKey: "release:fixture:forgery-v1",
    lineageKey: "release-lineage:fixture:forgery-v1",
    capabilities: ["repo-read"],
    authorizedGrantIds: [],
  };
  const forgedRelease = {
    ...createAutomationState(policy, releaseWorkOrder),
    phase: "deterministic-classification",
  };
  const crossWorkflow = transitionAutomation(
    policy,
    releaseWorkOrder,
    forgedRelease,
    classificationAutomationEvent(fixture),
  );
  assert.equal(crossWorkflow.state.outcome, "failed-terminal");
  assert.equal(crossWorkflow.effects.length, 0);

  const jumpedDependency = {
    ...createAutomationState(policy, fixture.workOrder),
    phase: "post-merge-verification",
  };
  const jumped = transitionAutomation(
    policy,
    fixture.workOrder,
    jumpedDependency,
    simpleAutomationEvent("post-merge-passed", "ci-adapter"),
  );
  assert.equal(jumped.state.outcome, "failed-terminal");
  assert.equal(jumped.effects.length, 0);

  const mergeWorkOrder = structuredClone(fixture.workOrder);
  mergeWorkOrder.authorizedGrantIds = ["dependency-pr-merge"];
  const forgedAwaiting = {
    ...createAutomationState(policy, mergeWorkOrder),
    phase: "awaiting-approval",
    resumePhase: "merge-authorization",
    outcome: "awaiting-approval",
  };
  const resumedWithoutHistory = transitionAutomation(
    policy,
    mergeWorkOrder,
    forgedAwaiting,
    authorizationEvent(policy, mergeWorkOrder, "pullRequestMerge", "forged-merge"),
  );
  assert.equal(resumedWithoutHistory.state.outcome, "failed-terminal");
  assert.equal(resumedWithoutHistory.effects.length, 0);

  const forgedTerminal = {
    ...createAutomationState(policy, fixture.workOrder),
    phase: "completed",
    outcome: "completed",
  };
  const terminalRejectedBeforeAbsorption = transitionAutomation(
    policy,
    fixture.workOrder,
    forgedTerminal,
    simpleAutomationEvent("post-merge-passed", "ci-adapter"),
  );
  assert.equal(terminalRejectedBeforeAbsorption.state.outcome, "failed-terminal");
  assert.equal(terminalRejectedBeforeAbsorption.effects.length, 0);
  assert.ok(terminalRejectedBeforeAbsorption.state.reasonCodes.includes("invalid-controller-state"));

  const forgedDelta = startCleanDependencyAutomation(policy, fixture);
  forgedDelta.history[0].attemptDeltas.strongEscalations = 1;
  forgedDelta.attempts.strongEscalations = 1;
  forgedDelta.historySha256 = canonicalSha256(forgedDelta.history);
  const deltaRejected = transitionAutomation(
    policy,
    fixture.workOrder,
    forgedDelta,
    simpleAutomationEvent("assessment-repair-proposed", "model-adapter"),
  );
  assert.equal(deltaRejected.state.outcome, "failed-terminal");
  assert.equal(deltaRejected.effects.length, 0);

  const assisted = assistedAutomationFixture();
  const patchPolicy = assisted.policy;
  const patchFixture = assisted.fixture;
  const patchWorkOrder = structuredClone(patchFixture.workOrder);
  patchWorkOrder.authorizedGrantIds = ["dependency-patch-publish"];
  patchFixture.workOrder = patchWorkOrder;
  let forgedAuthority = reachPatchAuthorization(patchPolicy, patchFixture, patchWorkOrder);
  forgedAuthority = transitionAutomation(
    patchPolicy,
    patchWorkOrder,
    forgedAuthority,
    authorizationEvent(patchPolicy, patchWorkOrder, "patchPublication", "correct-patch-grant"),
  ).state;
  const lastRecord = forgedAuthority.history.at(-1);
  lastRecord.grantProof.authorityName = "releasePromotion";
  lastRecord.grantProof.grantId = patchPolicy.authority.releasePromotion.grantId;
  lastRecord.grantProof.credentialClass = patchPolicy.authority.releasePromotion.credentialClass;
  forgedAuthority.historySha256 = canonicalSha256(forgedAuthority.history);
  const wrongAuthorityRejected = transitionAutomation(
    patchPolicy,
    patchWorkOrder,
    forgedAuthority,
    {
      schemaVersion: 1,
      type: "patch-publication-succeeded",
      source: "source-control-broker",
      expectedBaseSha: patchWorkOrder.baseSha,
      expectedHeadSha: patchWorkOrder.headSha,
      currentBaseSha: patchWorkOrder.baseSha,
      currentHeadSha: patchWorkOrder.headSha,
      publishedHeadSha: "c".repeat(40),
    },
  );
  assert.equal(wrongAuthorityRejected.state.outcome, "failed-terminal");
  assert.equal(wrongAuthorityRejected.effects.length, 0);
});

test("awaiting approval resumes dependency and release work with one persistent ledger", () => {
  const { policy, fixture } = assistedAutomationFixture();
  const dependencyWorkOrder = {
    ...fixture.workOrder,
    authorizedGrantIds: ["dependency-patch-publish"],
  };
  let dependencyState = createAutomationState(policy, dependencyWorkOrder);
  let dependencyLedger = recordLineageAttempts(
    new Map(),
    dependencyWorkOrder.lineageKey,
    dependencyState.attempts,
  );
  const stepDependency = (event) => {
    const result = transitionAutomationWithLedger(
      policy,
      dependencyWorkOrder,
      dependencyState,
      event,
      dependencyLedger,
    );
    dependencyState = result.state;
    dependencyLedger = result.lineageStore;
    return result;
  };
  stepDependency(classificationAutomationEvent(fixture));
  stepDependency(simpleAutomationEvent("assessment-repair-proposed", "model-adapter"));
  stepDependency(simpleAutomationEvent("repair-produced", "repair-worker"));
  const dependencyWaiting = stepDependency(
    simpleAutomationEvent("authorization-missing", "deterministic-controller"),
  );
  assert.equal(dependencyWaiting.state.outcome, "awaiting-approval");
  assert.equal(dependencyWaiting.state.resumePhase, "patch-authorization");
  const dependencyResumed = stepDependency(authorizationEvent(
    policy,
    dependencyWorkOrder,
    "patchPublication",
    "resume-dependency-patch",
  ));
  assert.equal(dependencyResumed.state.phase, "patch-publication");
  assert.equal(dependencyResumed.state.outcome, null);
  assert.deepEqual(dependencyResumed.effects, [{
    type: "publish-patch",
    grantRef: "resume-dependency-patch",
  }]);

  const releaseWorkOrder = {
    ...fixture.workOrder,
    workOrderId: "fixture-release-resume-v2",
    workflow: "release",
    idempotencyKey: "release:fixture:resume-v2",
    lineageKey: "release-lineage:fixture:resume-v2",
    capabilities: ["repo-read"],
    authorizedGrantIds: ["release-promotion"],
  };
  let releaseState = createAutomationState(policy, releaseWorkOrder);
  let releaseLedger = recordLineageAttempts(
    new Map(),
    releaseWorkOrder.lineageKey,
    releaseState.attempts,
  );
  const stepRelease = (event) => {
    const result = transitionAutomationWithLedger(
      policy,
      releaseWorkOrder,
      releaseState,
      event,
      releaseLedger,
    );
    releaseState = result.state;
    releaseLedger = result.lineageStore;
    return result;
  };
  const releaseWaiting = stepRelease(
    simpleAutomationEvent("authorization-missing", "deterministic-controller"),
  );
  assert.equal(releaseWaiting.state.outcome, "awaiting-approval");
  assert.equal(releaseWaiting.state.resumePhase, "release-promotion-authorization");
  const releaseResumed = stepRelease(authorizationEvent(
    policy,
    releaseWorkOrder,
    "releasePromotion",
    "resume-release-promotion",
  ));
  assert.equal(releaseResumed.state.phase, "release-promotion");
  assert.equal(releaseResumed.state.outcome, null);
  assert.deepEqual(releaseResumed.effects, [{
    type: "promote-release",
    grantRef: "resume-release-promotion",
  }]);
});

test("persisted state schema drift fails before an authorization effect", () => {
  const { policy, fixture } = assistedAutomationFixture();
  const releaseWorkOrder = {
    ...fixture.workOrder,
    workOrderId: "fixture-release-schema-v2",
    workflow: "release",
    idempotencyKey: "release:fixture:schema-v2",
    lineageKey: "release-lineage:fixture:schema-v2",
    capabilities: ["repo-read"],
    authorizedGrantIds: ["release-promotion"],
  };
  const state = {
    ...createAutomationState(policy, releaseWorkOrder),
    schemaVersion: 999,
  };
  const lineageStore = recordLineageAttempts(
    new Map(),
    releaseWorkOrder.lineageKey,
    state.attempts,
  );
  const result = transitionAutomationWithLedger(
    policy,
    releaseWorkOrder,
    state,
    authorizationEvent(
      policy,
      releaseWorkOrder,
      "releasePromotion",
      "schema-drift-release",
    ),
    lineageStore,
  );
  assert.equal(result.accepted, false);
  assert.equal(result.state.outcome, "failed-terminal");
  assert.deepEqual(result.effects, []);
  assert.ok(result.errors.includes("automation state schemaVersion must be 1"));
});

test("a replacement work order cannot add grants or capabilities mid-run", () => {
  const { policy, fixture } = assistedAutomationFixture();
  const releaseWorkOrder = {
    ...fixture.workOrder,
    workOrderId: "fixture-release-no-grants-v2",
    workflow: "release",
    idempotencyKey: "release:fixture:no-grants-v2",
    lineageKey: "release-lineage:fixture:no-grants-v2",
    capabilities: ["repo-read"],
    authorizedGrantIds: [],
  };
  const releaseState = createAutomationState(policy, releaseWorkOrder);
  const releaseLedger = recordLineageAttempts(
    new Map(),
    releaseWorkOrder.lineageKey,
    releaseState.attempts,
  );
  const grantEscalation = {
    ...releaseWorkOrder,
    workOrderId: "fixture-release-added-grant-v2",
    authorizedGrantIds: ["release-promotion"],
  };
  const grantResult = transitionAutomationWithLedger(
    policy,
    grantEscalation,
    releaseState,
    authorizationEvent(
      policy,
      grantEscalation,
      "releasePromotion",
      "replacement-work-order-grant",
    ),
    releaseLedger,
  );
  assert.equal(grantResult.accepted, false);
  assert.equal(grantResult.state.outcome, "stale");
  assert.deepEqual(grantResult.effects, []);

  const restrictedWorkOrder = {
    ...fixture.workOrder,
    workOrderId: "fixture-dependency-no-repair-v2",
    capabilities: ["model-assessment", "repo-read", "sanitized-evidence-read"],
  };
  let restrictedState = createAutomationState(policy, restrictedWorkOrder);
  let restrictedLedger = recordLineageAttempts(
    new Map(),
    restrictedWorkOrder.lineageKey,
    restrictedState.attempts,
  );
  const classified = transitionAutomationWithLedger(
    policy,
    restrictedWorkOrder,
    restrictedState,
    classificationAutomationEvent(fixture),
    restrictedLedger,
  );
  restrictedState = classified.state;
  restrictedLedger = classified.lineageStore;
  assert.equal(restrictedState.phase, "cheap-model-assessment");
  const capabilityEscalation = {
    ...restrictedWorkOrder,
    workOrderId: "fixture-dependency-added-repair-v2",
    capabilities: [
      "model-assessment",
      "repair-proposal",
      "repo-read",
      "sanitized-evidence-read",
    ],
  };
  const capabilityResult = transitionAutomationWithLedger(
    policy,
    capabilityEscalation,
    restrictedState,
    simpleAutomationEvent("assessment-repair-proposed", "model-adapter"),
    restrictedLedger,
  );
  assert.equal(capabilityResult.accepted, false);
  assert.equal(capabilityResult.state.outcome, "stale");
  assert.deepEqual(capabilityResult.effects, []);
});

test("lineage ledger is authoritative and survives AI-authored head changes", () => {
  const { policy, fixture } = cleanAutomationFixture();
  const consumed = lineageStateAtCap(policy, fixture.workOrder, "repairAttempts");
  let lineageStore = consumed.lineageStore;
  const changedFixture = rebindAutomationFixtureHead(policy, fixture, "9".repeat(40), "ai-head");
  const changedWorkOrder = changedFixture.workOrder;
  assert.equal(changedWorkOrder.lineageKey, fixture.workOrder.lineageKey);
  assert.notEqual(changedWorkOrder.idempotencyKey, fixture.workOrder.idempotencyKey);
  assert.notEqual(changedWorkOrder.inputEvidenceSha256, fixture.workOrder.inputEvidenceSha256);
  assert.equal(
    dependencyPullRequestLineageKey({
      ...changedWorkOrder,
      failureFingerprint: "8".repeat(64),
    }),
    changedWorkOrder.lineageKey,
  );

  let next = createAutomationStateFromLedger(policy, changedWorkOrder, lineageStore);
  let advanced = transitionAutomationWithLedger(
    policy,
    changedWorkOrder,
    next,
    classificationAutomationEvent(changedFixture),
    lineageStore,
  );
  assert.equal(advanced.state.phase, "cheap-model-assessment");
  assert.equal(advanced.effects[0].type, "invoke-model");
  lineageStore = advanced.lineageStore;
  next = advanced.state;
  const exhausted = transitionAutomationWithLedger(
    policy,
    changedWorkOrder,
    next,
    simpleAutomationEvent("assessment-repair-proposed", "model-adapter"),
    lineageStore,
  );
  assert.equal(exhausted.state.outcome, "failed-terminal");
  assert.equal(exhausted.effects.length, 0);
  assert.ok(exhausted.state.reasonCodes.includes("repairAttempts-exhausted"));
  lineageStore = exhausted.lineageStore;
  assert.equal(
    readLineageAttempts(lineageStore, changedWorkOrder.lineageKey).repairAttempts,
    1,
  );
  assert.equal(readLineageSnapshot(lineageStore, changedWorkOrder.lineageKey).revision, 2);

  const staleCounters = {
    ...next,
    attempts: { ...next.attempts, repairAttempts: 0 },
  };
  const rejectedBeforeEffect = transitionAutomationWithLedger(
    policy,
    changedWorkOrder,
    staleCounters,
    simpleAutomationEvent("assessment-repair-proposed", "model-adapter"),
    lineageStore,
  );
  assert.equal(rejectedBeforeEffect.state.outcome, "failed-terminal");
  assert.ok(rejectedBeforeEffect.state.reasonCodes.includes("lineage-ledger-stale"));
  assert.equal(rejectedBeforeEffect.effects.length, 0);

  const corruptLedger = new Map([[changedWorkOrder.lineageKey, null]]);
  const corruptRejected = transitionAutomationWithLedger(
    policy,
    changedWorkOrder,
    createAutomationState(policy, changedWorkOrder),
    classificationAutomationEvent(changedFixture),
    corruptLedger,
  );
  assert.equal(corruptRejected.state.outcome, "failed-terminal");
  assert.ok(corruptRejected.state.reasonCodes.includes("lineage-ledger-invalid"));
  assert.equal(corruptRejected.effects.length, 0);
  for (const missingLedger of [null, undefined, {}, new Map()]) {
    const missingRejected = transitionAutomationWithLedger(
      policy,
      changedWorkOrder,
      createAutomationState(policy, changedWorkOrder),
      classificationAutomationEvent(changedFixture),
      missingLedger,
    );
    assert.equal(missingRejected.state.outcome, "failed-terminal");
    assert.ok(missingRejected.state.reasonCodes.includes("lineage-ledger-invalid"));
    assert.equal(missingRejected.effects.length, 0);
  }
  assert.equal(
    createAutomationStateFromLedger(policy, changedWorkOrder, new Map()).outcome,
    "failed-terminal",
  );
});

test("every bounded controller attempt stops before a second side effect", () => {
  const { policy, fixture } = assistedAutomationFixture();
  const dependencyWorkOrder = structuredClone(fixture.workOrder);
  dependencyWorkOrder.authorizedGrantIds = [
    "dependency-patch-publish",
    "dependency-pr-merge",
  ];
  fixture.workOrder = dependencyWorkOrder;

  let capped = lineageStateAtCap(policy, dependencyWorkOrder, "cheapAssessments");
  let result = transitionAutomation(
    policy,
    dependencyWorkOrder,
    capped.state,
    classificationAutomationEvent(fixture),
  );
  assert.equal(result.state.outcome, "escalated");
  assert.equal(result.effects.length, 0);

  capped = lineageStateAtCap(policy, dependencyWorkOrder, "strongEscalations");
  let state = startCleanDependencyAutomation(
    policy,
    fixture,
    dependencyWorkOrder,
    capped.state,
  );
  result = transitionAutomation(
    policy,
    dependencyWorkOrder,
    state,
    simpleAutomationEvent("assessment-needs-escalation", "model-adapter"),
  );
  assert.equal(result.state.outcome, "escalated");
  assert.equal(result.effects.length, 0);

  capped = lineageStateAtCap(policy, dependencyWorkOrder, "repairAttempts");
  state = startCleanDependencyAutomation(policy, fixture, dependencyWorkOrder, capped.state);
  result = transitionAutomation(
    policy,
    dependencyWorkOrder,
    state,
    simpleAutomationEvent("assessment-repair-proposed", "model-adapter"),
  );
  assert.equal(result.state.outcome, "failed-terminal");
  assert.equal(result.effects.length, 0);

  capped = lineageStateAtCap(policy, dependencyWorkOrder, "patchPublications");
  state = reachPatchAuthorization(policy, fixture, dependencyWorkOrder, capped.state);
  result = transitionAutomation(
    policy,
    dependencyWorkOrder,
    state,
    authorizationEvent(policy, dependencyWorkOrder, "patchPublication", "patch-cap"),
  );
  assert.equal(result.state.outcome, "failed-terminal");
  assert.equal(result.effects.length, 0);

  capped = lineageStateAtCap(policy, dependencyWorkOrder, "ciFlakeReruns");
  let ciPath = reachCiValidationAtHead(policy, fixture, capped.state, "c".repeat(40));
  result = transitionAutomation(
    policy,
    ciPath.workOrder,
    ciPath.state,
    simpleAutomationEvent("ci-infra-flake", "ci-adapter"),
  );
  assert.equal(result.state.outcome, "failed-terminal");
  assert.equal(result.effects.length, 0);

  capped = lineageStateAtCap(policy, dependencyWorkOrder, "mergeAttempts");
  ciPath = reachCiValidationAtHead(policy, fixture, capped.state, "d".repeat(40));
  state = transitionAutomation(
    policy,
    ciPath.workOrder,
    ciPath.state,
    simpleAutomationEvent("ci-passed", "ci-adapter"),
  ).state;
  result = transitionAutomation(
    policy,
    ciPath.workOrder,
    state,
    authorizationEvent(policy, ciPath.workOrder, "pullRequestMerge", "merge-cap"),
  );
  assert.equal(result.state.outcome, "failed-terminal");
  assert.equal(result.effects.length, 0);

  const releaseWorkOrder = {
    ...dependencyWorkOrder,
    workOrderId: "fixture-release-cap-v1",
    workflow: "release",
    idempotencyKey: "release:fixture:cap-v1",
    lineageKey: "release-lineage:fixture:cap-v1",
    authorizedGrantIds: ["production-deploy", "production-rollback", "release-promotion"],
  };

  capped = lineageStateAtCap(policy, releaseWorkOrder, "releasePromotions");
  result = transitionAutomation(
    policy,
    releaseWorkOrder,
    capped.state,
    authorizationEvent(policy, releaseWorkOrder, "releasePromotion", "release-cap"),
  );
  assert.equal(result.state.outcome, "failed-terminal");
  assert.equal(result.effects.length, 0);

  capped = lineageStateAtCap(policy, releaseWorkOrder, "deployAttempts");
  state = transitionAutomation(
    policy,
    releaseWorkOrder,
    capped.state,
    authorizationEvent(policy, releaseWorkOrder, "releasePromotion", "release-before-deploy-cap"),
  ).state;
  state = transitionAutomation(
    policy,
    releaseWorkOrder,
    state,
    simpleAutomationEvent("release-promotion-succeeded", "release-broker"),
  ).state;
  result = transitionAutomation(
    policy,
    releaseWorkOrder,
    state,
    authorizationEvent(policy, releaseWorkOrder, "productionDeploy", "deploy-cap"),
  );
  assert.equal(result.state.outcome, "failed-terminal");
  assert.equal(result.effects.length, 0);

  capped = lineageStateAtCap(policy, releaseWorkOrder, "rollbackAttempts");
  state = transitionAutomation(
    policy,
    releaseWorkOrder,
    capped.state,
    authorizationEvent(policy, releaseWorkOrder, "releasePromotion", "release-before-rollback-cap"),
  ).state;
  state = transitionAutomation(
    policy,
    releaseWorkOrder,
    state,
    simpleAutomationEvent("release-promotion-succeeded", "release-broker"),
  ).state;
  state = transitionAutomation(
    policy,
    releaseWorkOrder,
    state,
    authorizationEvent(policy, releaseWorkOrder, "productionDeploy", "deploy-before-rollback-cap"),
  ).state;
  state = transitionAutomation(
    policy,
    releaseWorkOrder,
    state,
    simpleAutomationEvent("deploy-failed", "deploy-broker"),
  ).state;
  result = transitionAutomation(
    policy,
    releaseWorkOrder,
    state,
    authorizationEvent(policy, releaseWorkOrder, "productionRollback", "rollback-cap"),
  );
  assert.equal(result.state.outcome, "failed-terminal");
  assert.equal(result.effects.length, 0);
});

test("finite controller reaches every terminal branch without retry loops", () => {
  const { policy, fixture } = cleanAutomationFixture();
  const observed = new Set();

  const typescriptFixture = loadAutomationFixture();
  const deferred = transitionAutomation(
    policy,
    typescriptFixture.workOrder,
    createAutomationState(policy, typescriptFixture.workOrder),
    classificationAutomationEvent(typescriptFixture),
  );
  observed.add(deferred.state.outcome);

  const staleFixture = structuredClone(fixture);
  staleFixture.trustedEvent.eventHeadSha = "e".repeat(40);
  const stale = transitionAutomation(
    policy,
    fixture.workOrder,
    createAutomationState(policy, fixture.workOrder),
    classificationAutomationEvent(staleFixture),
  );
  observed.add(stale.state.outcome);

  const malformedEvent = classificationAutomationEvent(fixture);
  malformedEvent.evidence = null;
  const failed = transitionAutomation(
    policy,
    fixture.workOrder,
    createAutomationState(policy, fixture.workOrder),
    malformedEvent,
  );
  observed.add(failed.state.outcome);

  const awaiting = transitionAutomation(
    policy,
    fixture.workOrder,
    reachPatchAuthorization(policy, fixture),
    simpleAutomationEvent("authorization-missing", "deterministic-controller"),
  );
  observed.add(awaiting.state.outcome);

  const cheapState = startCleanDependencyAutomation(policy, fixture);
  const escalated = transitionAutomation(
    policy,
    fixture.workOrder,
    cheapState,
    simpleAutomationEvent("stage-timeout", "model-adapter"),
  );
  observed.add(escalated.state.outcome);
  const verified = transitionAutomation(
    policy,
    fixture.workOrder,
    cheapState,
    simpleAutomationEvent("assessment-no-repair", "model-adapter"),
  );
  observed.add(verified.state.outcome);

  const assisted = assistedAutomationFixture();
  const releasePolicy = assisted.policy;
  const releaseWorkOrder = {
    ...assisted.fixture.workOrder,
    workOrderId: "fixture-release-complete-v1",
    workflow: "release",
    idempotencyKey: "release:fixture:complete-v1",
    lineageKey: "release-lineage:fixture:complete-v1",
    capabilities: ["repo-read"],
    authorizedGrantIds: ["production-deploy", "release-promotion"],
  };
  let releaseState = createAutomationState(releasePolicy, releaseWorkOrder);
  releaseState = transitionAutomation(
    releasePolicy,
    releaseWorkOrder,
    releaseState,
    authorizationEvent(releasePolicy, releaseWorkOrder, "releasePromotion", "complete-release"),
  ).state;
  releaseState = transitionAutomation(
    releasePolicy,
    releaseWorkOrder,
    releaseState,
    simpleAutomationEvent("release-promotion-succeeded", "release-broker"),
  ).state;
  releaseState = transitionAutomation(
    releasePolicy,
    releaseWorkOrder,
    releaseState,
    authorizationEvent(releasePolicy, releaseWorkOrder, "productionDeploy", "complete-deploy"),
  ).state;
  releaseState = transitionAutomation(
    releasePolicy,
    releaseWorkOrder,
    releaseState,
    simpleAutomationEvent("deploy-succeeded", "deploy-broker"),
  ).state;
  const completed = transitionAutomation(
    releasePolicy,
    releaseWorkOrder,
    releaseState,
    simpleAutomationEvent("deploy-verification-passed", "deploy-broker"),
  ).state;
  observed.add(completed.outcome);

  const absorbed = transitionAutomation(
    releasePolicy,
    releaseWorkOrder,
    completed,
    simpleAutomationEvent("deploy-verification-passed", "deploy-broker"),
  );
  assert.equal(absorbed.accepted, false);
  assert.equal(absorbed.state.revision, completed.revision);
  assert.deepEqual([...observed].sort(), [
    "awaiting-approval",
    "completed",
    "deferred",
    "escalated",
    "failed-terminal",
    "stale",
    "verified",
  ]);
});

test("release controller requires distinct grants and has one verified rollback path", () => {
  const { policy, fixture } = assistedAutomationFixture();
  const workOrder = {
    ...fixture.workOrder,
    workOrderId: "fixture-release-v1",
    workflow: "release",
    idempotencyKey: "release:fixture:v1",
    lineageKey: "release-lineage:fixture:v1",
    capabilities: ["repo-read"],
    authorizedGrantIds: ["production-deploy", "production-rollback", "release-promotion"],
  };
  let state = createAutomationState(policy, workOrder);
  let result = transitionAutomation(
    policy,
    workOrder,
    state,
    authorizationEvent(policy, workOrder, "releasePromotion", "grant-release"),
  );
  assert.equal(result.effects[0].type, "promote-release");
  state = result.state;
  state = transitionAutomation(
    policy,
    workOrder,
    state,
    simpleAutomationEvent("release-promotion-succeeded", "release-broker"),
  ).state;
  state = transitionAutomation(
    policy,
    workOrder,
    state,
    authorizationEvent(policy, workOrder, "productionDeploy", "grant-deploy"),
  ).state;
  state = transitionAutomation(
    policy,
    workOrder,
    state,
    simpleAutomationEvent("deploy-succeeded", "deploy-broker"),
  ).state;
  state = transitionAutomation(
    policy,
    workOrder,
    state,
    simpleAutomationEvent("deploy-verification-failed", "deploy-broker"),
  ).state;
  state = transitionAutomation(
    policy,
    workOrder,
    state,
    authorizationEvent(policy, workOrder, "productionRollback", "grant-rollback"),
  ).state;
  state = transitionAutomation(
    policy,
    workOrder,
    state,
    simpleAutomationEvent("rollback-succeeded", "rollback-broker"),
  ).state;
  result = transitionAutomation(
    policy,
    workOrder,
    state,
    simpleAutomationEvent("rollback-verification-passed", "rollback-broker"),
  );
  assert.equal(result.state.outcome, "reverted");
  assert.equal(result.state.attempts.releasePromotions, 1);
  assert.equal(result.state.attempts.deployAttempts, 1);
  assert.equal(result.state.attempts.rollbackAttempts, 1);
  assert.deepEqual(result.state.consumedGrantRefs, [
    "grant-deploy",
    "grant-release",
    "grant-rollback",
  ]);
});

test("controller mutation authorization compares exact base and head SHAs", () => {
  const { policy, fixture } = assistedAutomationFixture();
  fixture.workOrder.authorizedGrantIds = ["dependency-patch-publish"];
  const state = reachPatchAuthorization(policy, fixture);
  const event = authorizationEvent(
    policy,
    fixture.workOrder,
    "patchPublication",
    "grant-patch",
  );
  event.currentHeadSha = "c".repeat(40);
  const result = transitionAutomation(policy, fixture.workOrder, state, event);
  assert.equal(result.state.outcome, "stale");
  assert.equal(result.effects.length, 0);
});

test("published repair renews its work order and completes a legal merge path", () => {
  const { policy, fixture } = assistedAutomationFixture();
  fixture.workOrder.authorizedGrantIds = [
    "dependency-patch-publish",
    "dependency-pr-merge",
  ];
  let state = reachPatchAuthorization(policy, fixture);
  state = transitionAutomation(
    policy,
    fixture.workOrder,
    state,
    authorizationEvent(policy, fixture.workOrder, "patchPublication", "grant-patch"),
  ).state;
  assert.equal(state.phase, "patch-publication");

  const publishedHeadSha = "c".repeat(40);
  const published = transitionAutomation(policy, fixture.workOrder, state, {
    schemaVersion: 1,
    type: "patch-publication-succeeded",
    source: "source-control-broker",
    expectedBaseSha: fixture.workOrder.baseSha,
    expectedHeadSha: fixture.workOrder.headSha,
    currentBaseSha: fixture.workOrder.baseSha,
    currentHeadSha: fixture.workOrder.headSha,
    publishedHeadSha,
  });
  assert.equal(published.state.phase, "work-order-renewal");
  assert.equal(published.effects[0].type, "renew-work-order");
  assert.equal(
    published.effects[0].requiredIdentity.headSha,
    publishedHeadSha,
  );
  assert.equal(published.state.identity.headSha, publishedHeadSha);
  assert.equal(published.state.lineageKey, fixture.workOrder.lineageKey);

  const staleWorkOrder = transitionAutomation(
    policy,
    fixture.workOrder,
    published.state,
    simpleAutomationEvent("work-order-renewed", "deterministic-controller"),
  );
  assert.equal(staleWorkOrder.state.outcome, "stale");

  const renewedFixture = rebindAutomationFixtureHead(
    policy,
    fixture,
    publishedHeadSha,
    "legal-merge",
  );
  const currentWorkOrder = renewedFixture.workOrder;
  const substitutedFixture = substituteAutomationDependency(
    policy,
    renewedFixture,
    "kleur",
    "4.1.4",
    "4.1.5",
  );
  const substituted = transitionAutomation(
    policy,
    substitutedFixture.workOrder,
    published.state,
    renewalAutomationEvent(substitutedFixture),
  );
  assert.equal(substituted.state.outcome, "stale");
  assert.equal(substituted.effects.length, 0);

  const bareRenewal = transitionAutomation(
    policy,
    currentWorkOrder,
    published.state,
    simpleAutomationEvent("work-order-renewed", "deterministic-controller"),
  );
  assert.equal(bareRenewal.state.outcome, "failed-terminal");
  assert.equal(bareRenewal.effects.length, 0);
  const oldEvidenceRenewal = transitionAutomation(
    policy,
    currentWorkOrder,
    published.state,
    renewalAutomationEvent(fixture),
  );
  assert.equal(oldEvidenceRenewal.state.outcome, "stale");
  assert.equal(oldEvidenceRenewal.effects.length, 0);

  state = transitionAutomation(
    policy,
    currentWorkOrder,
    published.state,
    renewalAutomationEvent(renewedFixture),
  ).state;
  assert.equal(state.phase, "ci-validation");
  state = transitionAutomation(
    policy,
    currentWorkOrder,
    state,
    simpleAutomationEvent("ci-passed", "ci-adapter"),
  ).state;
  assert.equal(state.phase, "merge-authorization");
  state = transitionAutomation(
    policy,
    currentWorkOrder,
    state,
    authorizationEvent(policy, currentWorkOrder, "pullRequestMerge", "grant-merge"),
  ).state;
  assert.equal(state.phase, "merge");
  state = transitionAutomation(policy, currentWorkOrder, state, {
    schemaVersion: 1,
    type: "merge-succeeded",
    source: "source-control-broker",
    expectedBaseSha: currentWorkOrder.baseSha,
    expectedHeadSha: currentWorkOrder.headSha,
    currentBaseSha: currentWorkOrder.baseSha,
    currentHeadSha: currentWorkOrder.headSha,
    mergedCommitSha: "d".repeat(40),
  }).state;
  assert.equal(state.phase, "post-merge-verification");
  const completed = transitionAutomation(
    policy,
    currentWorkOrder,
    state,
    simpleAutomationEvent("post-merge-passed", "ci-adapter"),
  );
  assert.equal(completed.state.outcome, "completed");
  assert.equal(completed.state.lineageKey, fixture.workOrder.lineageKey);
  assert.equal(completed.state.attempts.repairAttempts, 1);
  assert.equal(completed.state.attempts.patchPublications, 1);
  assert.equal(completed.state.attempts.mergeAttempts, 1);
});

test("work-order renewal requires a new authority id and new evidence before verification", () => {
  const { policy, fixture } = assistedAutomationFixture();
  fixture.workOrder.authorizedGrantIds = ["dependency-patch-publish"];
  let state = reachPatchAuthorization(policy, fixture);
  state = transitionAutomation(
    policy,
    fixture.workOrder,
    state,
    authorizationEvent(policy, fixture.workOrder, "patchPublication", "grant-patch"),
  ).state;
  const publishedHeadSha = "e".repeat(40);
  const publishedState = transitionAutomation(policy, fixture.workOrder, state, {
    schemaVersion: 1,
    type: "patch-publication-succeeded",
    source: "source-control-broker",
    expectedBaseSha: fixture.workOrder.baseSha,
    expectedHeadSha: fixture.workOrder.headSha,
    currentBaseSha: fixture.workOrder.baseSha,
    currentHeadSha: fixture.workOrder.headSha,
    publishedHeadSha,
  }).state;
  assert.equal(publishedState.phase, "work-order-renewal");
  const renewedFixture = rebindAutomationFixtureHead(
    policy,
    fixture,
    publishedHeadSha,
    "fresh-renewal",
  );

  const invalidRenewals = [
    {
      expectedOutcome: "failed-terminal",
      workOrder: {
        ...renewedFixture.workOrder,
        workOrderId: publishedState.identity.workOrderId,
      },
    },
    {
      expectedOutcome: "stale",
      workOrder: {
        ...renewedFixture.workOrder,
        inputEvidenceSha256: publishedState.identity.inputEvidenceSha256,
      },
    },
  ];
  for (const { expectedOutcome, workOrder } of invalidRenewals) {
    const rejected = transitionAutomation(
      policy,
      workOrder,
      publishedState,
      renewalAutomationEvent(renewedFixture),
      policyRegistryFor(policy),
    );
    assert.equal(rejected.state.outcome, expectedOutcome);
    assert.equal(rejected.effects.length, 0);
  }
});

test("credential-free TypeScript fixture is deferred before model or repair work", () => {
  const aggregate = runAutomationFixture();
  assert.equal(aggregate.terminalOutcome, "deferred");
  assert.equal(aggregate.nextStage, null);
  assert.equal(aggregate.modelAttempts, 0);
  assert.equal(aggregate.repairAttempts, 0);
  assert.equal(aggregate.mutationAttempts, 0);
  assert.equal(aggregate.networkCalls, 0);
  assert.equal(aggregate.replayed, true);
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
    plannedWorkPackage: "WP-2026-005",
    claimsMeasured: false,
    casesEvaluated: 0,
    message: "Frozen coach evaluation is planned for WP-2026-005; this bootstrap contains no evaluator or feature results.",
  });
});

test("provider policy is exact, self-digested, and OpenAI-first without admitting fallbacks", () => {
  const policy = loadProviderPolicy();
  assert.deepEqual(validateProviderPolicy(policy), []);
  assert.equal(policy.policySha256, providerPolicyDigest(policy));
  for (const profile of policy.profiles) {
    assert.equal(profile.profileSha256, providerProfileDigest(profile));
  }
  assert.deepEqual(
    policy.profiles.map(({ id, runtimeAdmission }) => [id, runtimeAdmission]),
    [
      ["openai-responses-v1", "candidate"],
      ["anthropic-boundary-v1", "boundary-only"],
      ["google-boundary-v1", "boundary-only"],
    ],
  );
  assert.equal(
    policy.profiles[0].inferenceSettingsByRole.observer.providerSettings.store,
    false,
  );
  assert.deepEqual(policy.profiles.slice(1).map((profile) => profile.dataHandling), [null, null]);
});

test("provider policy rejects unknown keys and any unsigned descriptor drift", () => {
  const policy = loadProviderPolicy();
  policy.unreviewedPolicy = true;
  policy.profiles[0].unreviewedProfile = true;
  policy.profiles[0].dataHandling.telemetry = "raw";
  policy.profiles[0].inferenceSettingsByRole.observer.providerSettings.temperature = 0;
  const errors = validateProviderPolicy(policy);
  assert.ok(errors.includes("config/provider-policy.json: unknown field unreviewedPolicy"));
  assert.ok(errors.includes(
    "provider profile openai-responses-v1: unknown field unreviewedProfile",
  ));
  assert.ok(errors.includes(
    "provider profile openai-responses-v1.dataHandling: unknown field telemetry",
  ));
  assert.ok(errors.includes(
    "provider profile openai-responses-v1: profileSha256 does not match the canonical descriptor",
  ));
  assert.ok(errors.includes(
    "config/provider-policy.json: policySha256 does not match the canonical policy",
  ));
});

test("boundary-only provider records cannot assert artifact or retention facts", () => {
  const policy = loadProviderPolicy();
  const profile = policy.profiles[1];
  profile.artifactIdentity = {
    kind: "hosted-route",
    revisionPolicy: "mutable-provider-route",
    resolvedIdentityEvidence: "required-per-call",
  };
  profile.dataHandling = {
    responseStoragePolicy: "request-not-to-store",
    abuseMonitoringPolicy: "provider-default",
    retentionControl: "not-verified",
  };
  signProviderPolicy(policy);
  const errors = validateProviderPolicy(policy);
  assert.ok(errors.includes(
    "provider profile anthropic-boundary-v1: boundary-only profiles must not assert artifact identity",
  ));
  assert.ok(errors.includes(
    "provider profile anthropic-boundary-v1: boundary-only profiles must not assert data handling",
  ));
});

test("a mutable or retention-unverified hosted route cannot become approved", () => {
  const policy = loadProviderPolicy();
  policy.profiles[0].runtimeAdmission = "approved";
  signProviderPolicy(policy);
  const errors = validateProviderPolicy(policy);
  assert.ok(errors.includes(
    "provider profile openai-responses-v1: approved hosted profiles require an immutable provider revision",
  ));
  assert.ok(errors.includes(
    "provider profile openai-responses-v1: approved profiles require host-verified retention control",
  ));
});

test("a hosted alias cannot gain immutable status by relabeling policy metadata", () => {
  const policy = loadProviderPolicy();
  const profile = policy.profiles[0];
  profile.runtimeAdmission = "approved";
  profile.artifactIdentity.revisionPolicy = "immutable-provider-revision";
  profile.artifactIdentity.requestedRevisionsByRole = structuredClone(profile.modelsByRole);
  profile.dataHandling.retentionControl = "host-verified";
  signProviderPolicy(policy);
  const errors = validateProviderPolicy(policy);
  assert.ok(errors.includes(
    "provider profile openai-responses-v1.artifactIdentity.requestedRevisionsByRole.observer must identify a dated or SHA-256 immutable provider revision",
  ));
  assert.ok(errors.includes(
    "provider profile openai-responses-v1.artifactIdentity.requestedRevisionsByRole.teacher must identify a dated or SHA-256 immutable provider revision",
  ));
});

test("provider policy accepts an unfamiliar provider through descriptor data alone", () => {
  const policy = loadProviderPolicy();
  const profile = structuredClone(policy.profiles[0]);
  profile.id = "local-json-v1";
  profile.provider = "local-model";
  profile.adapter.package = "@verified-sudoku/adapter-local-model";
  profile.adapter.protocol = "local-json";
  profile.modelsByRole = { observer: "fixture-observer" };
  profile.inferenceSettingsByRole = {
    observer: {
      providerSettings: { format: "json", retainRequest: false },
    },
  };
  profile.browserBoundary = {
    dependencyPatterns: ["@local-model/sdk"],
    credentialNamePatterns: ["\\bLOCAL_MODEL_TOKEN\\b"],
    endpointPatterns: ["\\blocal-model\\.example(?=[/:]|$)"],
  };
  policy.profiles.push(profile);
  signProviderPolicy(policy);
  assert.deepEqual(validateProviderPolicy(policy), []);
});

test("open-weight providers require immutable artifact and execution identity", () => {
  const policy = loadProviderPolicy();
  const profile = structuredClone(policy.profiles[0]);
  profile.id = "local-open-weight-v1";
  profile.provider = "local-model";
  profile.providerKind = "open-weight";
  profile.adapter.package = "@verified-sudoku/adapter-local-model";
  profile.adapter.protocol = "local-json";
  profile.modelsByRole = { observer: "fixture-observer" };
  profile.inferenceSettingsByRole = {
    observer: { providerSettings: { format: "json" } },
  };
  profile.artifactIdentity = {
    kind: "open-weight-artifact",
    weightsSha256: "1".repeat(64),
    quantization: "q4-k-m",
    inferenceServer: {
      name: "vllm",
      version: "1.0.0",
      artifactSha256: "2".repeat(64),
    },
    promptTemplateSha256: "3".repeat(64),
    executionEnvironment: {
      runtime: "cuda",
      runtimeVersion: "12.8.0",
      hardwareClass: "nvidia-l4",
    },
  };
  profile.dataHandling = {
    responseStoragePolicy: "self-hosted-ephemeral",
    abuseMonitoringPolicy: "self-hosted",
    retentionControl: "host-verified",
  };
  profile.browserBoundary = {
    dependencyPatterns: ["@local-model/sdk"],
    credentialNamePatterns: ["\\bLOCAL_MODEL_TOKEN\\b"],
    endpointPatterns: ["\\blocal-model\\.example(?=[/:]|$)"],
  };
  policy.profiles.push(profile);
  signProviderPolicy(policy);
  assert.deepEqual(validateProviderPolicy(policy), []);

  delete profile.artifactIdentity.weightsSha256;
  signProviderPolicy(policy);
  assert.ok(validateProviderPolicy(policy).includes(
    "provider profile local-open-weight-v1.artifactIdentity: missing weightsSha256",
  ));
});

test("runtime-admitted provider profiles retain the neutral safety capabilities", () => {
  const policy = loadProviderPolicy();
  policy.profiles[0].capabilities = policy.profiles[0].capabilities.filter(
    (capability) => capability !== "strict-json-schema",
  );
  signProviderPolicy(policy);
  assert.ok(validateProviderPolicy(policy).includes(
    "provider profile openai-responses-v1.capabilities: missing required capability strict-json-schema",
  ));
});

test("provider policy changes require monotonic policy, profile, and admission transitions", () => {
  const previous = loadProviderPolicy();
  const changed = structuredClone(previous);
  changed.profiles[1].browserBoundary.endpointPatterns = ["\\bnever-matches\\.invalid$"];
  signProviderPolicy(changed);
  assert.deepEqual(validateProviderPolicyTransition(changed, previous), [
    "config/provider-policy.json: policyVersion must increase when provider policy changes",
    "anthropic-boundary-v1: profileVersion must increase when the provider descriptor changes",
  ]);

  changed.policyVersion = "1.1.0";
  changed.profiles[1].profileVersion = "1.1.0";
  signProviderPolicy(changed);
  assert.deepEqual(validateProviderPolicyTransition(changed, previous), []);

  const weakened = structuredClone(previous);
  weakened.policyVersion = "2.0.0";
  weakened.profiles[0].profileVersion = "2.0.0";
  weakened.profiles[0].runtimeAdmission = "boundary-only";
  weakened.profiles[0].adapter = null;
  weakened.profiles[0].capabilities = [];
  weakened.profiles[0].modelsByRole = {};
  weakened.profiles[0].inferenceSettingsByRole = {};
  signProviderPolicy(weakened);
  assert.ok(validateProviderPolicyTransition(weakened, previous).includes(
    "openai-responses-v1: invalid runtimeAdmission transition candidate -> boundary-only",
  ));

  const removed = structuredClone(previous);
  removed.policyVersion = "2.0.0";
  removed.profiles.shift();
  signProviderPolicy(removed);
  assert.ok(validateProviderPolicyTransition(removed, previous).includes(
    "openai-responses-v1: provider profiles are append-only; retire instead of removing",
  ));
});

test("runtime provider selection is exact, role-bound, and provider-neutral", () => {
  const policy = loadProviderPolicy();
  const profile = policy.profiles[0];
  const registration = runtimeRegistrationFixture(profile);
  assert.deepEqual(validateRuntimeRegistrationShape(registration), []);
  assert.deepEqual(validateRuntimeProviderSelection(registration, policy), []);

  const malformed = structuredClone(registration);
  delete malformed.providerProfileId;
  malformed.provider = "openai";
  malformed.store = false;
  assert.deepEqual(validateRuntimeRegistrationShape(malformed), [
    "observer-v1: missing providerProfileId",
    "observer-v1: unknown field provider",
    "observer-v1: unknown field store",
  ]);

  const drifted = structuredClone(registration);
  drifted.providerProfileSha256 = "0".repeat(64);
  drifted.modelProfileVersion = "2.0.0";
  drifted.requestedModel = "unregistered-model";
  drifted.responseStoragePolicy = "provider-default";
  delete drifted.inferenceSettings.providerSettings.store;
  drifted.inferenceSettings.providerSettings.temperature = 0;
  const errors = validateRuntimeProviderSelection(drifted, policy);
  assert.ok(errors.includes(
    "observer-v1: providerProfileSha256 must match provider profile openai-responses-v1",
  ));
  assert.ok(errors.includes(
    "observer-v1: modelProfileVersion must match provider profile openai-responses-v1",
  ));
  assert.ok(errors.includes(
    "observer-v1: requestedModel must be gpt-5.6-luna for provider profile openai-responses-v1",
  ));
  assert.ok(errors.includes(
    "observer-v1: responseStoragePolicy must be request-not-to-store",
  ));
  assert.ok(errors.includes("observer-v1: inferenceSettings.providerSettings: missing store"));
  assert.ok(errors.includes(
    "observer-v1: inferenceSettings.providerSettings: unknown field temperature",
  ));

  const boundaryOnly = structuredClone(registration);
  boundaryOnly.providerProfileId = "anthropic-boundary-v1";
  assert.deepEqual(validateRuntimeProviderSelection(boundaryOnly, policy), [
    "observer-v1: provider profile anthropic-boundary-v1 is not admitted for runtime use",
  ]);

  const prematurelyApproved = structuredClone(registration);
  prematurelyApproved.approvalStatus = "approved";
  assert.deepEqual(validateRuntimeProviderSelection(prematurelyApproved, policy), [
    "observer-v1: provider profile openai-responses-v1 is not admitted for runtime use",
  ]);

  const retiredPolicy = structuredClone(policy);
  retiredPolicy.policyVersion = "2.0.0";
  retiredPolicy.profiles[0].runtimeAdmission = "retired";
  signProviderPolicy(retiredPolicy);
  const retiredRegistration = runtimeRegistrationFixture(retiredPolicy.profiles[0]);
  retiredRegistration.approvalStatus = "retired";
  assert.deepEqual(validateRuntimeProviderSelection(retiredRegistration, retiredPolicy), []);
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
      providerProfileId: "openai-responses-v1",
      providerProfileSha256: "c".repeat(64),
      responseStoragePolicy: "request-not-to-store",
      inferenceSettings: { reasoning: { effort: "low" } },
    }],
  };
  const changed = structuredClone(previous);
  changed.registrations[0].inferenceSettings.reasoning.effort = "medium";
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
  downgraded.registrations[0].inferenceSettings.reasoning.effort = "high";
  downgraded.registrations[0].comparisonReportSha256 = "d".repeat(64);
  assert.ok(validateRuntimeManifestTransition(downgraded, downgradeBase).some((error) =>
    error.includes("runtimeBehaviorVersion must increase")));
  assert.ok(validateRuntimeManifestTransition(downgraded, downgradeBase).some((error) =>
    error.includes("modelProfileVersion must increase")));

  const removed = { registrations: [] };
  assert.deepEqual(validateRuntimeManifestTransition(removed, previous), [
    "observer-v1: registrations are append-only; retire instead of removing",
  ]);

  const providerChanged = structuredClone(previous);
  providerChanged.registrations[0].providerProfileId = "local-json-v1";
  providerChanged.registrations[0].providerProfileSha256 = "d".repeat(64);
  assert.deepEqual(validateRuntimeManifestTransition(providerChanged, previous), [
    "observer-v1: runtimeBehaviorVersion must increase when behavior changes",
    "observer-v1: behavior changed without new comparative-evaluation evidence",
    "observer-v1: modelProfileVersion must increase when model profile changes",
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
    error.includes("policy differs from the accepted VSC-ARCH-2 workspace graph")));
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
    classifyBrowserSource(
      readText("scripts/fixtures/architecture/forbidden-browser.tsx"),
      currentBrowserBoundary(),
    ),
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
      classifyBrowserSource(`export const credentialName = "${name}";`, currentBrowserBoundary()),
      ["provider credential name"],
    );
  }
  assert.deepEqual(
    classifyBrowserSource(
      'export const call = () => fetch("https://api.openai.com/v1/responses");',
      currentBrowserBoundary(),
    ),
    ["direct provider endpoint"],
  );
  assert.deepEqual(
    classifyBrowserSource(
      'export const endpoint = "https://api." + `openai.${"com"}/v1/responses`;',
      currentBrowserBoundary(),
    ),
    ["direct provider endpoint"],
  );
  assert.deepEqual(
    classifyBrowserSource(
      'export const credentialName = "OPEN" + "AI_API_KEY";',
      currentBrowserBoundary(),
    ),
    ["provider credential name"],
  );
  assert.deepEqual(
    classifyBrowserSource(
      'export const endpoint = ["https://api", "openai", "com/v1"].join(".");',
      currentBrowserBoundary(),
    ),
    ["direct provider endpoint"],
  );
});

test("browser provider boundary covers OpenAI, Anthropic, and Google SDKs and wire data", () => {
  const boundary = currentBrowserBoundary();
  for (const dependency of [
    "openai",
    "@openai/agents",
    "@ai-sdk/openai",
    "@langchain/openai",
    "@anthropic-ai/sdk",
    "@ai-sdk/anthropic",
    "@langchain/anthropic",
    "@google/genai",
    "@google/generative-ai",
    "@google-cloud/vertexai",
    "@ai-sdk/google",
    "@langchain/google-genai",
    "@langchain/google-vertexai",
  ]) {
    assert.deepEqual(
      classifyBrowserSource(`import provider from "${dependency}";`, boundary),
      [`Node-only import ${dependency}`],
    );
  }
  for (const credential of [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_GENAI_API_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS",
  ]) {
    assert.deepEqual(
      classifyBrowserSource(`export const credential = "${credential}";`, boundary),
      ["provider credential name"],
    );
  }
  for (const endpoint of [
    "https://api.openai.com/v1/responses",
    "https://api.anthropic.com/v1/messages",
    "https://generativelanguage.googleapis.com/v1beta/models",
    "https://us-central1-aiplatform.googleapis.com/v1/projects",
  ]) {
    assert.deepEqual(
      classifyBrowserSource(`export const endpoint = "${endpoint}";`, boundary),
      ["direct provider endpoint"],
    );
  }
  assert.deepEqual(
    classifyBrowserSource(
      'export const key = "ANTH" + "ROPIC_API_KEY"; export const host = "generative" + "language.googleapis.com";',
      boundary,
    ),
    ["provider credential name", "direct provider endpoint"],
  );
  assert.deepEqual(
    classifyBrowserSource(
      'export const host = "api" + String.fromCharCode(46) + "anthropic.com";',
      boundary,
    ),
    ["direct provider endpoint"],
  );
});

test("provider boundary classifier covers browser build inputs without banning Node tooling", () => {
  const boundary = currentBrowserBoundary();
  assert.deepEqual(
    classifyProviderBoundarySource([
      'import path from "node:path";',
      'const key = process.env.ANTHROPIC_API_KEY;',
      'export const endpoint = "https://api.anthropic.com/v1/messages";',
    ].join("\n"), boundary),
    ["provider credential name", "direct provider endpoint"],
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
    classifyBrowserSource(
      'void import(`node:fs`); import/* boundary */("openai");',
      currentBrowserBoundary(),
    ),
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

test("architecture verifier scans browser build code outside src for provider leakage", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-browser-build-boundary-"));
  try {
    fs.cpSync(
      fromRoot("scripts/fixtures/architecture/workspace"),
      temporaryRepository,
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(temporaryRepository, "apps", "replay-web", "vite.config.ts"),
      [
        'import path from "node:path";',
        "void path;",
        'export const credential = "OPENAI_API_KEY";',
        'export const endpoint = "https://api.openai.com/v1/responses";',
      ].join("\n"),
    );
    const errors = verifyArchitectureAtRoot(temporaryRepository);
    assert.ok(errors.includes(
      "apps/replay-web/vite.config.ts: browser-safe graph forbids provider credential name",
    ));
    assert.ok(errors.includes(
      "apps/replay-web/vite.config.ts: browser-safe graph forbids direct provider endpoint",
    ));
    assert.ok(!errors.includes(
      "apps/replay-web/vite.config.ts: browser-safe graph forbids Node-only import node:path",
    ));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
});

test("architecture verifier reports a null provider policy without crashing", () => {
  const temporaryRepository = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-null-provider-policy-"));
  try {
    fs.cpSync(
      fromRoot("scripts/fixtures/architecture/workspace"),
      temporaryRepository,
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(temporaryRepository, "config", "provider-policy.json"),
      "null\n",
    );
    assert.ok(verifyArchitectureAtRoot(temporaryRepository).includes(
      "config/provider-policy.json must be an exact object",
    ));
  } finally {
    fs.rmSync(temporaryRepository, { recursive: true, force: true });
  }
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
    error.includes("acceptance gate VSC-PROOF-001 is owned by WP-2026-003")));
});

test("accepted seed packages cannot bypass the foundation dependency chain", async () => {
  const packages = structuredClone(loadWorkPackages());
  const proofPackage = packages.find((item) => item.id === "WP-2026-003");
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
    error.includes("accepted seed dependency must be WP-2026-002")));
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
      /## Validation\n[\s\S]*?(?=\n## Delivery evidence)/,
      "## Validation\n\n```powershell\nnpm ci\nnpm run verify\n```\n\n- `npm run verify`: PASS — fixture.\n",
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
    file: "docs/work-packages/WP-2026-010-result.md",
    id: "WP-2026-010",
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
    file: "docs/work-packages/WP-2026-003-proof.md",
    id: "WP-2026-003",
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

test("a decision-complete Draft may start atomically with its first checkpoint", () => {
  const base = [{
    file: "docs/work-packages/WP-2026-002-portability.md",
    id: "WP-2026-002",
    status: "Draft",
    checkpointContent: "Implementation has not begun.",
  }];
  const started = [{
    file: base[0].file,
    id: base[0].id,
    status: "In progress",
    checkpointContent: "- 2026-09-04 — accepted plan and implementation start recorded together",
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
  const proofPackage = packages.find((item) => item.status === "In progress");
  assert.ok(proofPackage);
  proofPackage.status = "Ready";
  proofPackage.metadata.status = "Ready";
  assert.deepEqual(await validateWorkPackagesOffline(
    packages,
    readText("docs/acceptance/catalog.md"),
    loadAcceptedPlans(),
    () => true,
  ), []);
});

test("In progress rejects unfinished decisions just like Ready", async () => {
  const packages = structuredClone(loadWorkPackages());
  const active = packages.find((item) => item.status === "In progress");
  assert.ok(active);
  active.body = active.body.replace("## Goal", "## Goal\n\nTBD");
  const errors = await validateWorkPackagesOffline(
    packages,
    readText("docs/acceptance/catalog.md"),
    loadAcceptedPlans(),
  );
  assert.ok(errors.includes(
    `${active.file}: In progress work may not contain unfinished decisions or commands`,
  ));
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
  future.dependsOn = ["WP-2026-010"];
  future.metadata.depends_on = "WP-2026-010";
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
