import crypto from "node:crypto";

export const fullLowercaseSha1 = /^[0-9a-f]{40}$/;
export const fullLowercaseSha256 = /^[0-9a-f]{64}$/;
export const stableSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const npmPackageName = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/;
export const githubRepository = /^[a-z0-9][a-z0-9_.-]{0,99}\/[a-z0-9][a-z0-9_.-]{0,99}$/;
export const automationIdentityKey = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/;

export const automationTerminalOutcomes = Object.freeze([
  "verified",
  "completed",
  "deferred",
  "stale",
  "awaiting-approval",
  "escalated",
  "failed-terminal",
  "reverted",
]);

export const automationAttemptNames = Object.freeze([
  "cheapAssessments",
  "strongEscalations",
  "repairAttempts",
  "patchPublications",
  "ciFlakeReruns",
  "mergeAttempts",
  "releasePromotions",
  "deployAttempts",
  "rollbackAttempts",
]);

const policyKeys = [
  "schemaVersion",
  "policyVersion",
  "policySha256",
  "mode",
  "source",
  "eligibility",
  "identity",
  "evidenceLimits",
  "modelRoute",
  "decisionOrder",
  "attemptCaps",
  "authority",
  "terminalOutcomes",
];
const sourceKeys = ["kind", "ecosystem", "actor", "app", "event", "classification"];
const eligibilityKeys = [
  "dependencySection",
  "directDependency",
  "existingDependency",
  "updateType",
  "allowedFiles",
  "compilerBuildTools",
  "requiredChecks",
  "forbiddenRiskCodes",
  "statefulChanges",
  "irreversibleChanges",
  "ineligibleOutcome",
];
const identityKeys = ["baseSha", "headSha", "failureFingerprint", "idempotencyKeyTemplate"];
const evidenceLimitKeys = [
  "maxFileChanges",
  "maxManifestBytes",
  "maxManifestEntriesPerSection",
  "maxRequiredChecks",
  "maxScripts",
  "maxStringLength",
];
const modelRouteKeys = [
  "selectionAuthority",
  "cheapProfileClass",
  "strongProfileClass",
  "selfSelection",
  "inputData",
  "outputMode",
];
const authorityKeys = [
  "patchPublication",
  "pullRequestMerge",
  "releasePromotion",
  "productionDeploy",
  "productionRollback",
];
const authorityGrantKeys = [
  "grantId",
  "credentialClass",
  "required",
  "automatic",
  "humanGatedPhase",
];
const workOrderKeys = [
  "schemaVersion",
  "workOrderId",
  "workflow",
  "repository",
  "pullRequestNumber",
  "baseSha",
  "headSha",
  "failureFingerprint",
  "inputEvidenceSha256",
  "dependencyIntentSha256",
  "policyVersion",
  "policySha256",
  "idempotencyKey",
  "lineageKey",
  "capabilities",
  "authorizedGrantIds",
  "modelEscalationAuthority",
];

const expectedAllowedFiles = Object.freeze(["package.json", "package-lock.json"]);
const expectedCompilerBuildTools = Object.freeze([
  "@typescript-eslint/eslint-plugin",
  "@typescript-eslint/parser",
  "@typescript-eslint/utils",
  "esbuild",
  "eslint",
  "rollup",
  "typescript",
  "typescript-eslint",
  "vite",
  "vitest",
  "webpack",
]);
const expectedRequiredChecks = Object.freeze([
  "install",
  "verify",
  "ubuntu-ci",
  "windows-ci",
  "dependency-review",
  "codeql",
]);
export const dependencyRiskCodes = Object.freeze([
  "compiler-or-build-tool",
  "license-change",
  "lifecycle-script",
  "missing-telemetry",
  "native-dependency",
  "new-direct-package",
  "peer-conflict",
  "security-sensitive-surface",
  "source-change",
  "vulnerability-increase",
  "workflow-change",
]);
const expectedDecisionOrder = Object.freeze([
  "deterministic-classification",
  "cheap-model-assessment",
  "strong-model-escalation",
  "repair",
  "patch-publication-grant",
  "ci-flake-rerun",
  "merge-grant",
  "release-promotion-grant",
  "deploy-grant",
  "rollback-grant",
  "terminal-outcome",
]);
const expectedLimits = Object.freeze({
  maxFileChanges: 16,
  maxManifestBytes: 262_144,
  maxManifestEntriesPerSection: 512,
  maxRequiredChecks: 32,
  maxScripts: 128,
  maxStringLength: 512,
});
const acceptedPolicySha256 = "c71116495cef31a2d75323eb66fe95cb8e3e92a582563c43aa9e0b34caaa5024";
const policyAdmissionKeys = [
  "policyVersion",
  "policySha256",
  "mode",
  "authorizationRef",
];

export function isExactObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function exactObjectErrors(value, label, expectedKeys) {
  if (!isExactObject(value)) {
    return [`${label} must be an exact object`];
  }
  const errors = [];
  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      errors.push(`${label} missing ${key}`);
    }
  }
  for (const key of Object.keys(value)) {
    if (!expectedKeys.includes(key)) {
      errors.push(`${label} unknown field ${key}`);
    }
  }
  return errors;
}

export function canonicalValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalValue(item));
  }
  if (isExactObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

export function canonicalSha256(value) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex");
}

export function automationPolicyDigest(policy) {
  const withoutDigest = isExactObject(policy)
    ? Object.fromEntries(Object.entries(policy).filter(([key]) => key !== "policySha256"))
    : policy;
  return canonicalSha256(withoutDigest);
}

function exactArray(value, expected) {
  return Array.isArray(value) && JSON.stringify(value) === JSON.stringify(expected);
}

function validateAuthority(authority, mode) {
  const errors = exactObjectErrors(authority, "authority", authorityKeys);
  if (!isExactObject(authority)) {
    return errors;
  }

  const expectedGrants = {
    patchPublication: ["dependency-patch-publish", "source-control-patch"],
    pullRequestMerge: ["dependency-pr-merge", "source-control-merge"],
    releasePromotion: ["release-promotion", "release-artifact"],
    productionDeploy: ["production-deploy", "production-deploy"],
    productionRollback: ["production-rollback", "production-rollback"],
  };
  const seenGrantIds = new Set();
  const seenCredentialClasses = new Set();
  for (const key of authorityKeys) {
    const grant = authority[key];
    errors.push(...exactObjectErrors(grant, `authority.${key}`, authorityGrantKeys));
    if (!isExactObject(grant)) {
      continue;
    }
    const [expectedGrantId, expectedCredentialClass] = expectedGrants[key];
    if (grant.grantId !== expectedGrantId) {
      errors.push(`authority.${key}.grantId must be ${expectedGrantId}`);
    }
    if (grant.credentialClass !== expectedCredentialClass) {
      errors.push(`authority.${key}.credentialClass must be ${expectedCredentialClass}`);
    }
    if (grant.required !== true) {
      errors.push(`authority.${key}.required must be true`);
    }
    if (typeof grant.automatic !== "boolean") {
      errors.push(`authority.${key}.automatic must be a boolean`);
    }
    if (grant.humanGatedPhase !== "evidence") {
      errors.push(`authority.${key}.humanGatedPhase must be evidence`);
    }
    if (seenGrantIds.has(grant.grantId)) {
      errors.push(`authority.${key}.grantId must be unique`);
    }
    if (seenCredentialClasses.has(grant.credentialClass)) {
      errors.push(`authority.${key}.credentialClass must be unique`);
    }
    seenGrantIds.add(grant.grantId);
    seenCredentialClasses.add(grant.credentialClass);
    if (mode === "shadow" && grant.automatic !== false) {
      errors.push(`shadow mode cannot automatically exercise authority.${key}`);
    }
  }
  return errors;
}

export function validateAutomationPolicyShape(policy) {
  const errors = exactObjectErrors(policy, "automation policy", policyKeys);
  if (!isExactObject(policy)) {
    return errors;
  }

  if (policy.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (typeof policy.policyVersion !== "string" ||
      !/^VSC-AUTOMATION-(?:[1-9]\d*)$/.test(policy.policyVersion)) {
    errors.push("policyVersion must be a monotonic VSC-AUTOMATION integer version");
  }
  if (!fullLowercaseSha256.test(policy.policySha256 ?? "")) {
    errors.push("policySha256 must be a lowercase SHA-256 digest");
  } else {
    if (automationPolicyDigest(policy) !== policy.policySha256) {
      errors.push("policySha256 must match the canonical automation policy");
    }
  }
  if (!["shadow", "assisted", "active"].includes(policy.mode)) {
    errors.push("mode must be shadow, assisted, or active");
  }

  errors.push(...exactObjectErrors(policy.source, "source", sourceKeys));
  if (isExactObject(policy.source)) {
    const expectedSource = {
      kind: "dependabot",
      ecosystem: "npm",
      actor: "dependabot[bot]",
      app: "dependabot",
      event: "pull_request",
      classification: "deterministic-diff",
    };
    for (const [key, expected] of Object.entries(expectedSource)) {
      if (policy.source[key] !== expected) {
        errors.push(`source.${key} must be ${expected}`);
      }
    }
  }

  errors.push(...exactObjectErrors(policy.eligibility, "eligibility", eligibilityKeys));
  if (isExactObject(policy.eligibility)) {
    if (policy.eligibility.dependencySection !== "devDependencies") {
      errors.push("eligibility.dependencySection must be devDependencies");
    }
    if (policy.eligibility.directDependency !== "required") {
      errors.push("eligibility.directDependency must be required");
    }
    if (policy.eligibility.existingDependency !== "required") {
      errors.push("eligibility.existingDependency must be required");
    }
    if (policy.eligibility.updateType !== "semver-patch") {
      errors.push("eligibility.updateType must be semver-patch");
    }
    if (!exactArray(policy.eligibility.allowedFiles, expectedAllowedFiles)) {
      errors.push("eligibility.allowedFiles must be exactly package.json and package-lock.json");
    }
    if (!exactArray(policy.eligibility.compilerBuildTools, expectedCompilerBuildTools)) {
      errors.push("eligibility.compilerBuildTools must contain the exact reviewed tool set");
    }
    if (!exactArray(policy.eligibility.requiredChecks, expectedRequiredChecks)) {
      errors.push("eligibility.requiredChecks must contain the exact reviewed check set");
    }
    if (!exactArray(policy.eligibility.forbiddenRiskCodes, dependencyRiskCodes)) {
      errors.push("eligibility.forbiddenRiskCodes must contain the exact reviewed risk set");
    }
    if (policy.eligibility.statefulChanges !== "ineligible") {
      errors.push("eligibility.statefulChanges must be ineligible");
    }
    if (policy.eligibility.irreversibleChanges !== "ineligible") {
      errors.push("eligibility.irreversibleChanges must be ineligible");
    }
    if (policy.eligibility.ineligibleOutcome !== "deferred") {
      errors.push("eligibility.ineligibleOutcome must be deferred");
    }
  }

  errors.push(...exactObjectErrors(policy.identity, "identity", identityKeys));
  if (isExactObject(policy.identity)) {
    if (policy.identity.baseSha !== "required-full-lowercase-sha1") {
      errors.push("identity.baseSha must require a full lowercase SHA-1");
    }
    if (policy.identity.headSha !== "required-full-lowercase-sha1") {
      errors.push("identity.headSha must require a full lowercase SHA-1");
    }
    if (policy.identity.failureFingerprint !== "required-lowercase-sha256") {
      errors.push("identity.failureFingerprint must require a lowercase SHA-256");
    }
    const expectedTemplate = "dependabot:{repository}:pr-{pullRequestNumber}:{baseSha}:{headSha}:{failureFingerprint}:{policyVersion}";
    if (policy.identity.idempotencyKeyTemplate !== expectedTemplate) {
      errors.push(`identity.idempotencyKeyTemplate must be ${expectedTemplate}`);
    }
  }

  errors.push(...exactObjectErrors(policy.evidenceLimits, "evidenceLimits", evidenceLimitKeys));
  if (isExactObject(policy.evidenceLimits)) {
    for (const [key, expected] of Object.entries(expectedLimits)) {
      if (policy.evidenceLimits[key] !== expected) {
        errors.push(`evidenceLimits.${key} must be ${expected}`);
      }
    }
  }

  errors.push(...exactObjectErrors(policy.modelRoute, "modelRoute", modelRouteKeys));
  if (isExactObject(policy.modelRoute)) {
    const expectedModelRoute = {
      selectionAuthority: "deterministic-controller",
      cheapProfileClass: "low-cost-diagnosis",
      strongProfileClass: "complex-diagnosis",
      selfSelection: "forbidden",
      inputData: "sanitized-evidence",
      outputMode: "strict-proposal",
    };
    for (const [key, expected] of Object.entries(expectedModelRoute)) {
      if (policy.modelRoute[key] !== expected) {
        errors.push(`modelRoute.${key} must be ${expected}`);
      }
    }
  }

  if (!exactArray(policy.decisionOrder, expectedDecisionOrder)) {
    errors.push("decisionOrder must classify deterministically before model stages and terminate");
  }

  errors.push(...exactObjectErrors(policy.attemptCaps, "attemptCaps", automationAttemptNames));
  if (isExactObject(policy.attemptCaps)) {
    for (const key of automationAttemptNames) {
      const value = policy.attemptCaps[key];
      if (!Number.isSafeInteger(value) || value < 0 || value > 1) {
        errors.push(`attemptCaps.${key} must be an integer from 0 through 1`);
      }
    }
  }

  errors.push(...validateAuthority(policy.authority, policy.mode));
  if (!exactArray(policy.terminalOutcomes, automationTerminalOutcomes)) {
    errors.push(`terminalOutcomes must be exactly ${automationTerminalOutcomes.join(", ")}`);
  }
  return errors;
}

export function checkedInAutomationPolicyRegistry() {
  return new Map([[
    "VSC-AUTOMATION-1",
    {
      policyVersion: "VSC-AUTOMATION-1",
      policySha256: acceptedPolicySha256,
      mode: "shadow",
      authorizationRef: "checked-in:ADR-0008:VSC-AUTOMATION-1",
    },
  ]]);
}

export function validateAutomationPolicyAdmission(
  policy,
  registry = checkedInAutomationPolicyRegistry(),
) {
  const errors = validateAutomationPolicyShape(policy);
  if (!(registry instanceof Map)) {
    errors.push("automation policy admission registry must be a trusted Map");
    return errors;
  }
  const admission = registry.get(policy?.policyVersion);
  errors.push(...exactObjectErrors(admission, "automation policy admission", policyAdmissionKeys));
  if (!isExactObject(admission)) return errors;
  for (const key of ["policyVersion", "policySha256", "mode"]) {
    if (admission[key] !== policy?.[key]) {
      errors.push(`automation policy admission ${key} must match the candidate policy`);
    }
  }
  if (typeof admission.authorizationRef !== "string" ||
      admission.authorizationRef.length === 0 || admission.authorizationRef.length > 512) {
    errors.push("automation policy admission authorizationRef must be bounded approval evidence");
  }
  return errors;
}

export function validateAutomationPolicy(policy) {
  return validateAutomationPolicyAdmission(policy, checkedInAutomationPolicyRegistry());
}

export function isSemverPatchUpdate(currentVersion, proposedVersion) {
  const current = stableSemver.exec(currentVersion ?? "");
  const proposed = stableSemver.exec(proposedVersion ?? "");
  if (!current || !proposed) {
    return false;
  }
  return current[1] === proposed[1] && current[2] === proposed[2] &&
    BigInt(proposed[3]) > BigInt(current[3]);
}

export function dependencyPullRequestIdempotencyKey(candidate) {
  return [
    "dependabot",
    candidate?.repository,
    `pr-${candidate?.pullRequestNumber}`,
    candidate?.baseSha,
    candidate?.headSha,
    candidate?.failureFingerprint,
    candidate?.policyVersion,
  ].join(":");
}

export function dependencyPullRequestLineageKey(candidate) {
  return [
    "dependabot-lineage",
    candidate?.repository,
    `pr-${candidate?.pullRequestNumber}`,
    candidate?.policyVersion,
  ].join(":");
}

export function validateAutomationWorkOrder(policy, workOrder, policyRegistry) {
  const policyErrors = policyRegistry === undefined
    ? validateAutomationPolicy(policy)
    : validateAutomationPolicyAdmission(policy, policyRegistry);
  const errors = policyErrors.map((error) => `policy: ${error}`);
  errors.push(...exactObjectErrors(workOrder, "automation work order", workOrderKeys));
  if (!isExactObject(workOrder) || !isExactObject(policy)) {
    return errors;
  }
  if (workOrder.schemaVersion !== 1) {
    errors.push("automation work order schemaVersion must be 1");
  }
  if (typeof workOrder.workOrderId !== "string" ||
      !/^[a-z0-9][a-z0-9._:-]{0,127}$/.test(workOrder.workOrderId)) {
    errors.push("automation work order workOrderId must be a bounded canonical ID");
  }
  if (!["dependency-pr", "release"].includes(workOrder.workflow)) {
    errors.push("automation work order workflow must be dependency-pr or release");
  }
  if (typeof workOrder.repository !== "string" || !githubRepository.test(workOrder.repository)) {
    errors.push("automation work order repository must be a canonical lowercase owner/name");
  }
  if (!Number.isSafeInteger(workOrder.pullRequestNumber) || workOrder.pullRequestNumber < 1) {
    errors.push("automation work order pullRequestNumber must be a positive safe integer");
  }
  for (const key of ["baseSha", "headSha"]) {
    if (!fullLowercaseSha1.test(workOrder[key] ?? "")) {
      errors.push(`automation work order ${key} must be an exact full lowercase SHA-1`);
    }
  }
  if (!fullLowercaseSha256.test(workOrder.failureFingerprint ?? "")) {
    errors.push("automation work order failureFingerprint must be an exact lowercase SHA-256");
  }
  if (!fullLowercaseSha256.test(workOrder.inputEvidenceSha256 ?? "")) {
    errors.push("automation work order inputEvidenceSha256 must be an exact lowercase SHA-256");
  }
  if (!fullLowercaseSha256.test(workOrder.dependencyIntentSha256 ?? "")) {
    errors.push("automation work order dependencyIntentSha256 must be an exact lowercase SHA-256");
  }
  if (workOrder.policyVersion !== policy.policyVersion ||
      workOrder.policySha256 !== policy.policySha256) {
    errors.push("automation work order policy identity must match the active policy");
  }
  if (typeof workOrder.idempotencyKey !== "string" ||
      !automationIdentityKey.test(workOrder.idempotencyKey)) {
    errors.push("automation work order idempotencyKey must be a non-empty canonical bounded string");
  } else if (workOrder.workflow === "dependency-pr" &&
      workOrder.idempotencyKey !== dependencyPullRequestIdempotencyKey(workOrder)) {
    errors.push("automation work order idempotencyKey must bind repository, PR, base, head, fingerprint, and policy");
  }
  const expectedLineage = dependencyPullRequestLineageKey(workOrder);
  if (workOrder.workflow === "dependency-pr" && workOrder.lineageKey !== expectedLineage) {
    errors.push(`automation work order lineageKey must be exactly ${expectedLineage}`);
  }
  if (typeof workOrder.lineageKey !== "string" ||
      !automationIdentityKey.test(workOrder.lineageKey)) {
    errors.push("automation work order lineageKey must be a non-empty canonical bounded string");
  }
  const allowedCapabilities = [
    "model-assessment",
    "repair-proposal",
    "repo-read",
    "sanitized-evidence-read",
  ];
  if (!Array.isArray(workOrder.capabilities) ||
      workOrder.capabilities.some((item) => !allowedCapabilities.includes(item)) ||
      new Set(workOrder.capabilities).size !== workOrder.capabilities.length ||
      JSON.stringify(workOrder.capabilities) !== JSON.stringify([...workOrder.capabilities].sort())) {
    errors.push("automation work order capabilities must be a sorted unique subset of read/proposal capabilities");
  }
  const dependencyGrantIds = [
    policy.authority?.patchPublication?.grantId,
    policy.authority?.pullRequestMerge?.grantId,
  ];
  const releaseGrantIds = [
    policy.authority?.releasePromotion?.grantId,
    policy.authority?.productionDeploy?.grantId,
    policy.authority?.productionRollback?.grantId,
  ];
  const allowedGrantIds = workOrder.workflow === "dependency-pr"
    ? dependencyGrantIds
    : releaseGrantIds;
  if (!Array.isArray(workOrder.authorizedGrantIds) ||
      workOrder.authorizedGrantIds.some((item) => !allowedGrantIds.includes(item)) ||
      new Set(workOrder.authorizedGrantIds).size !== workOrder.authorizedGrantIds.length ||
      JSON.stringify(workOrder.authorizedGrantIds) !==
        JSON.stringify([...workOrder.authorizedGrantIds].sort())) {
    errors.push("automation work order authorizedGrantIds must be a sorted unique workflow-specific subset");
  }
  if (workOrder.modelEscalationAuthority !== "deterministic-controller") {
    errors.push("automation work order modelEscalationAuthority must be deterministic-controller");
  }
  return errors;
}

export function isTerminalAutomationOutcome(policy, outcome) {
  return validateAutomationPolicy(policy).length === 0 &&
    policy.terminalOutcomes.includes(outcome);
}
