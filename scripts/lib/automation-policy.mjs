const policyKeys = [
  "schemaVersion",
  "policyVersion",
  "mode",
  "source",
  "eligibility",
  "identity",
  "modelRoute",
  "decisionOrder",
  "attemptCaps",
  "authority",
  "terminalOutcomes",
];
const sourceKeys = ["kind", "ecosystem", "actor", "event", "classification"];
const eligibilityKeys = [
  "dependencySection",
  "updateType",
  "allowedFiles",
  "statefulChanges",
  "irreversibleChanges",
  "ineligibleOutcome",
];
const identityKeys = ["headSha", "failureFingerprint", "idempotencyKeyTemplate"];
const modelRouteKeys = [
  "selectionAuthority",
  "cheapProfileClass",
  "strongProfileClass",
  "selfSelection",
  "inputData",
  "outputMode",
];
const attemptCapKeys = [
  "cheapAssessments",
  "strongEscalations",
  "repairAttempts",
  "patchPublications",
  "ciFlakeReruns",
  "mergeAttempts",
  "releasePromotions",
  "deployAttempts",
  "rollbackAttempts",
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
const dependencyPullRequestKeys = [
  "source",
  "sourceActor",
  "sourceEvent",
  "ecosystem",
  "repository",
  "pullRequestNumber",
  "dependencyName",
  "dependencySection",
  "currentVersion",
  "proposedVersion",
  "changedFiles",
  "headSha",
  "failureFingerprint",
  "policyVersion",
  "idempotencyKey",
  "statefulChange",
  "irreversibleChange",
];

const expectedAllowedFiles = ["package.json", "package-lock.json"];
const expectedDecisionOrder = [
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
];
const expectedTerminalOutcomes = [
  "verified",
  "completed",
  "deferred",
  "stale",
  "awaiting-approval",
  "escalated",
  "failed-terminal",
  "reverted",
];
const fullLowercaseSha1 = /^[0-9a-f]{40}$/;
const fullLowercaseSha256 = /^[0-9a-f]{64}$/;
const stableSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const npmPackageName = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/;
const githubRepository = /^[a-z0-9][a-z0-9_.-]{0,99}\/[a-z0-9][a-z0-9_.-]{0,99}$/;

function isExactObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactObjectErrors(value, label, expectedKeys) {
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

export function validateAutomationPolicy(policy) {
  const errors = exactObjectErrors(policy, "automation policy", policyKeys);
  if (!isExactObject(policy)) {
    return errors;
  }

  if (policy.schemaVersion !== 1) {
    errors.push("schemaVersion must be 1");
  }
  if (policy.policyVersion !== "VSC-AUTOMATION-1") {
    errors.push("policyVersion must be VSC-AUTOMATION-1");
  }
  if (policy.mode !== "shadow") {
    errors.push("mode must remain shadow for VSC-AUTOMATION-1");
  }

  errors.push(...exactObjectErrors(policy.source, "source", sourceKeys));
  if (isExactObject(policy.source)) {
    if (policy.source.kind !== "dependabot") {
      errors.push("source.kind must be dependabot");
    }
    if (policy.source.ecosystem !== "npm") {
      errors.push("source.ecosystem must be npm");
    }
    if (policy.source.actor !== "dependabot[bot]") {
      errors.push("source.actor must be dependabot[bot]");
    }
    if (policy.source.event !== "pull_request") {
      errors.push("source.event must be pull_request");
    }
    if (policy.source.classification !== "deterministic-diff") {
      errors.push("source.classification must be deterministic-diff");
    }
  }

  errors.push(...exactObjectErrors(policy.eligibility, "eligibility", eligibilityKeys));
  if (isExactObject(policy.eligibility)) {
    if (policy.eligibility.dependencySection !== "devDependencies") {
      errors.push("eligibility.dependencySection must be devDependencies");
    }
    if (policy.eligibility.updateType !== "semver-patch") {
      errors.push("eligibility.updateType must be semver-patch");
    }
    if (!exactArray(policy.eligibility.allowedFiles, expectedAllowedFiles)) {
      errors.push("eligibility.allowedFiles must be exactly package.json and package-lock.json");
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
    if (policy.identity.headSha !== "required-full-lowercase-sha1") {
      errors.push("identity.headSha must require a full lowercase SHA-1");
    }
    if (policy.identity.failureFingerprint !== "required-lowercase-sha256") {
      errors.push("identity.failureFingerprint must require a lowercase SHA-256");
    }
    const expectedTemplate = "dependabot:{repository}:pr-{pullRequestNumber}:{headSha}:{failureFingerprint}:{policyVersion}";
    if (policy.identity.idempotencyKeyTemplate !== expectedTemplate) {
      errors.push(`identity.idempotencyKeyTemplate must be ${expectedTemplate}`);
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

  errors.push(...exactObjectErrors(policy.attemptCaps, "attemptCaps", attemptCapKeys));
  if (isExactObject(policy.attemptCaps)) {
    for (const key of attemptCapKeys) {
      const value = policy.attemptCaps[key];
      if (!Number.isSafeInteger(value) || value < 0 || value > 1) {
        errors.push(`attemptCaps.${key} must be an integer from 0 through 1`);
      }
    }
  }

  errors.push(...validateAuthority(policy.authority, policy.mode));
  if (!exactArray(policy.terminalOutcomes, expectedTerminalOutcomes)) {
    errors.push(`terminalOutcomes must be exactly ${expectedTerminalOutcomes.join(", ")}`);
  }
  return errors;
}

export function dependencyPullRequestIdempotencyKey(candidate) {
  return [
    "dependabot",
    candidate.repository,
    `pr-${candidate.pullRequestNumber}`,
    candidate.headSha,
    candidate.failureFingerprint,
    candidate.policyVersion,
  ].join(":");
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

export function classifyDependencyPullRequest(policy, candidate) {
  const reasons = validateAutomationPolicy(policy).map((error) => `policy: ${error}`);
  reasons.push(...exactObjectErrors(
    candidate,
    "dependency pull request",
    dependencyPullRequestKeys,
  ));
  if (!isExactObject(candidate)) {
    return {
      eligible: false,
      nextStage: null,
      terminalOutcome: "deferred",
      reasons,
    };
  }

  if (candidate.source !== policy.source?.kind) {
    reasons.push("source is not the allowlisted dependency updater");
  }
  if (candidate.sourceActor !== policy.source?.actor) {
    reasons.push("source actor is not the verified Dependabot actor");
  }
  if (candidate.sourceEvent !== policy.source?.event) {
    reasons.push("source event is not an allowlisted pull request event");
  }
  if (candidate.ecosystem !== policy.source?.ecosystem) {
    reasons.push("ecosystem is not npm");
  }
  if (typeof candidate.repository !== "string" || !githubRepository.test(candidate.repository)) {
    reasons.push("repository must be a canonical lowercase owner/name");
  }
  if (!Number.isSafeInteger(candidate.pullRequestNumber) || candidate.pullRequestNumber < 1) {
    reasons.push("pullRequestNumber must be a positive safe integer");
  }
  if (typeof candidate.dependencyName !== "string" ||
      !npmPackageName.test(candidate.dependencyName)) {
    reasons.push("dependencyName must be a canonical lowercase npm package name");
  }
  if (candidate.dependencySection !== policy.eligibility?.dependencySection) {
    reasons.push("dependency is not a devDependency");
  }
  if (!isSemverPatchUpdate(candidate.currentVersion, candidate.proposedVersion)) {
    reasons.push("dependency update is not a stable semver patch");
  }

  if (!exactArray(candidate.changedFiles, expectedAllowedFiles)) {
    reasons.push("changedFiles must be exactly package.json and package-lock.json");
  }
  if (!fullLowercaseSha1.test(candidate.headSha ?? "")) {
    reasons.push("headSha must be an exact full lowercase SHA-1");
  }
  if (!fullLowercaseSha256.test(candidate.failureFingerprint ?? "")) {
    reasons.push("failureFingerprint must be an exact lowercase SHA-256");
  }
  if (candidate.policyVersion !== policy.policyVersion) {
    reasons.push("policyVersion must match the active automation policy");
  }
  const expectedIdempotencyKey = dependencyPullRequestIdempotencyKey(candidate);
  if (candidate.idempotencyKey !== expectedIdempotencyKey) {
    reasons.push(`idempotencyKey must be exactly ${expectedIdempotencyKey}`);
  }
  if (candidate.statefulChange !== false) {
    reasons.push("stateful changes are ineligible");
  }
  if (candidate.irreversibleChange !== false) {
    reasons.push("irreversible changes are ineligible");
  }
  const eligible = reasons.length === 0;
  return {
    eligible,
    nextStage: eligible ? "cheap-model-assessment" : null,
    terminalOutcome: eligible ? null : policy.eligibility?.ineligibleOutcome ?? "deferred",
    reasons,
  };
}

export function isTerminalAutomationOutcome(policy, outcome) {
  return validateAutomationPolicy(policy).length === 0 &&
    policy.terminalOutcomes.includes(outcome);
}
