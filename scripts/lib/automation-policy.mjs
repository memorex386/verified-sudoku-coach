const policyKeys = [
  "schemaVersion",
  "policyVersion",
  "mode",
  "source",
  "eligibility",
  "identity",
  "decisionOrder",
  "attemptCaps",
  "authority",
  "terminalOutcomes",
];
const sourceKeys = ["kind", "ecosystem", "classification"];
const eligibilityKeys = [
  "dependencySection",
  "updateType",
  "allowedFiles",
  "statefulChanges",
  "irreversibleChanges",
  "ineligibleOutcome",
];
const identityKeys = ["headSha", "idempotencyKeyTemplate"];
const attemptCapKeys = [
  "cheapAssessments",
  "strongEscalations",
  "repairAttempts",
  "ciFlakeReruns",
  "deployAttempts",
  "rollbackAttempts",
];
const authorityKeys = ["pullRequestMerge", "productionDeploy"];
const mergeAuthorityKeys = ["grantId", "required", "automatic"];
const deployAuthorityKeys = [
  "grantId",
  "required",
  "automatic",
  "humanGatedPhase",
];
const dependencyPullRequestKeys = [
  "source",
  "ecosystem",
  "dependencyName",
  "dependencySection",
  "currentVersion",
  "proposedVersion",
  "changedFiles",
  "headSha",
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
  "ci-flake-rerun",
  "merge-grant",
  "deploy-grant",
  "terminal-outcome",
];
const expectedTerminalOutcomes = ["verified", "deferred", "escalated", "reverted"];
const fullLowercaseSha1 = /^[0-9a-f]{40}$/;
const stableSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const npmPackageName = /^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/;

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

  const merge = authority.pullRequestMerge;
  const deploy = authority.productionDeploy;
  errors.push(...exactObjectErrors(
    merge,
    "authority.pullRequestMerge",
    mergeAuthorityKeys,
  ));
  errors.push(...exactObjectErrors(
    deploy,
    "authority.productionDeploy",
    deployAuthorityKeys,
  ));

  if (isExactObject(merge)) {
    if (merge.grantId !== "dependency-pr-merge") {
      errors.push("authority.pullRequestMerge.grantId must be dependency-pr-merge");
    }
    if (merge.required !== true) {
      errors.push("authority.pullRequestMerge.required must be true");
    }
    if (typeof merge.automatic !== "boolean") {
      errors.push("authority.pullRequestMerge.automatic must be a boolean");
    }
  }

  if (isExactObject(deploy)) {
    if (deploy.grantId !== "production-deploy") {
      errors.push("authority.productionDeploy.grantId must be production-deploy");
    }
    if (deploy.required !== true) {
      errors.push("authority.productionDeploy.required must be true");
    }
    if (typeof deploy.automatic !== "boolean") {
      errors.push("authority.productionDeploy.automatic must be a boolean");
    }
    if (deploy.humanGatedPhase !== "evidence") {
      errors.push("authority.productionDeploy.humanGatedPhase must be evidence");
    }
  }

  if (isExactObject(merge) && isExactObject(deploy) && merge.grantId === deploy.grantId) {
    errors.push("pull-request merge and production deploy must use separate grants");
  }
  if (mode === "shadow" && isExactObject(merge) && merge.automatic !== false) {
    errors.push("shadow mode cannot automatically merge a pull request");
  }
  if (mode === "shadow" && isExactObject(deploy) && deploy.automatic !== false) {
    errors.push("shadow mode cannot automatically deploy production");
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
    if (policy.identity.idempotencyKeyTemplate !== "dependabot:{headSha}") {
      errors.push("identity.idempotencyKeyTemplate must be dependabot:{headSha}");
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
    errors.push("terminalOutcomes must be exactly verified, deferred, escalated, and reverted");
  }
  return errors;
}

export function dependencyPullRequestIdempotencyKey(headSha) {
  return `dependabot:${headSha}`;
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
  if (candidate.ecosystem !== policy.source?.ecosystem) {
    reasons.push("ecosystem is not npm");
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

  if (!Array.isArray(candidate.changedFiles) || candidate.changedFiles.length === 0 ||
      new Set(candidate.changedFiles).size !== candidate.changedFiles.length ||
      candidate.changedFiles.some((file) =>
        !policy.eligibility?.allowedFiles?.includes(file))) {
    reasons.push("changedFiles must be a unique non-empty subset of the allowlist");
  }
  if (!fullLowercaseSha1.test(candidate.headSha ?? "")) {
    reasons.push("headSha must be an exact full lowercase SHA-1");
  }
  const expectedIdempotencyKey = dependencyPullRequestIdempotencyKey(candidate.headSha);
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
