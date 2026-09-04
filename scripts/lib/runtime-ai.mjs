const numericIdentifier = "(?:0|[1-9]\\d*)";
const nonNumericIdentifier = "(?:\\d*[A-Za-z-][0-9A-Za-z-]*)";
const prereleaseIdentifier = `(?:${numericIdentifier}|${nonNumericIdentifier})`;
const buildIdentifier = "[0-9A-Za-z-]+";
const semanticVersion = new RegExp(
  `^(${numericIdentifier})\\.(${numericIdentifier})\\.(${numericIdentifier})` +
  `(?:-(${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*))?` +
  `(?:\\+(${buildIdentifier}(?:\\.${buildIdentifier})*))?$`,
);
const artifactPolicies = {
  prompt: ["ai/prompts/", ".md"],
  schema: ["packages/contracts/schemas/", ".json"],
  "renderer manifest": ["packages/coach-core/renderers/", ".json"],
  "proof policy": ["packages/proof-engine/policies/", ".json"],
  "evaluation-suite manifest": ["tools/eval-cli/suites/", ".json"],
  "comparison report": ["docs/evaluation/reports/", ".json"],
};

const runtimeRegistrationKeys = [
  "id",
  "role",
  "approvalStatus",
  "providerProfileId",
  "providerProfileSha256",
  "requestedModel",
  "modelProfileVersion",
  "inferenceSettings",
  "runtimeBehaviorVersion",
  "promptPath",
  "promptVersion",
  "promptSha256",
  "schemaPath",
  "schemaVersion",
  "schemaSha256",
  "rendererManifestPath",
  "rendererVersion",
  "rendererManifestSha256",
  "proofPolicyPath",
  "proofPolicyVersion",
  "proofPolicySha256",
  "evalSuiteManifestPath",
  "evalSuiteVersion",
  "evalSuiteManifestSha256",
  "comparisonReportPath",
  "comparisonReportSha256",
  "maxOutputTokens",
  "timeoutMs",
  "requestStorage",
  "automaticRetry",
  "failurePolicy",
];

export function validateRuntimeRegistrationShape(registration) {
  if (!registration || typeof registration !== "object" || Array.isArray(registration)) {
    return ["ai/runtime-manifest.json: every registration must be an exact object"];
  }
  const label = typeof registration.id === "string" ? registration.id : "registration";
  const errors = [];
  for (const field of runtimeRegistrationKeys) {
    if (!Object.hasOwn(registration, field) || registration[field] === undefined ||
        registration[field] === "") {
      errors.push(`${label}: missing ${field}`);
    }
  }
  for (const field of Object.keys(registration)) {
    if (!runtimeRegistrationKeys.includes(field)) {
      errors.push(`${label}: unknown field ${field}`);
    }
  }
  return errors;
}

export function validateRegistrationIdentity(registration) {
  const label = typeof registration.id === "string" ? registration.id : "registration";
  const errors = [];
  if (typeof registration.id !== "string" ||
      !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(registration.id)) {
    errors.push(`${label}: id must be a lowercase kebab-case string`);
  }
  for (const field of [
    "modelProfileVersion",
    "runtimeBehaviorVersion",
    "promptVersion",
    "schemaVersion",
    "rendererVersion",
    "proofPolicyVersion",
    "evalSuiteVersion",
  ]) {
    if (typeof registration[field] !== "string" || !semanticVersion.test(registration[field])) {
      errors.push(`${label}: ${field} must be a semantic-version string`);
    }
  }
  return errors;
}

export function validateArtifactPath(kind, artifactPath) {
  const policy = artifactPolicies[kind];
  if (!policy) {
    return [`unknown artifact kind ${kind}`];
  }
  const [prefix, suffix] = policy;
  if (typeof artifactPath !== "string" || !artifactPath.startsWith(prefix) ||
      !artifactPath.endsWith(suffix) || artifactPath.includes("\\") ||
      artifactPath.split("/").includes("..") || !/^[A-Za-z0-9._/-]+$/.test(artifactPath)) {
    return [`${kind} path must match ${prefix}*${suffix}`];
  }
  return [];
}

export function validateOutputTokenBound(registration) {
  const label = registration.id ?? "registration";
  if (!Number.isSafeInteger(registration.maxOutputTokens) || registration.maxOutputTokens < 1) {
    return [`${label}: maxOutputTokens must be a positive integer`];
  }
  const ceiling = registration.role === "observer"
    ? 256
    : registration.role === "teacher"
      ? 768
      : undefined;
  return ceiling !== undefined && registration.maxOutputTokens > ceiling
    ? [`${label}: ${registration.role} maxOutputTokens must not exceed ${ceiling}`]
    : [];
}

export function validateTimeoutBound(registration) {
  const label = registration.id ?? "registration";
  if (!Number.isSafeInteger(registration.timeoutMs) || registration.timeoutMs < 1) {
    return [`${label}: timeoutMs must be a positive integer`];
  }
  const ceiling = registration.role === "observer" ? 5_000 : 10_000;
  return registration.timeoutMs > ceiling
    ? [`${label}: ${registration.role ?? "unknown-role"} timeoutMs must not exceed ${ceiling}`]
    : [];
}

const behaviorFields = [
  "role",
  "providerProfileId",
  "providerProfileSha256",
  "requestedModel",
  "modelProfileVersion",
  "inferenceSettings",
  "promptPath",
  "promptVersion",
  "promptSha256",
  "schemaPath",
  "schemaVersion",
  "schemaSha256",
  "rendererManifestPath",
  "rendererVersion",
  "rendererManifestSha256",
  "proofPolicyPath",
  "proofPolicyVersion",
  "proofPolicySha256",
  "evalSuiteManifestPath",
  "evalSuiteVersion",
  "evalSuiteManifestSha256",
  "maxOutputTokens",
  "timeoutMs",
  "requestStorage",
  "automaticRetry",
  "failurePolicy",
];

function canonicalValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
    );
  }
  return value;
}

function fieldsChanged(current, previous, fields) {
  return fields.some((field) =>
    JSON.stringify(canonicalValue(current[field])) !==
      JSON.stringify(canonicalValue(previous[field])));
}

function semanticVersionParts(version) {
  if (typeof version !== "string") {
    return null;
  }
  const match = semanticVersion.exec(version);
  if (!match) {
    return null;
  }
  return {
    core: match.slice(1, 4),
    prerelease: match[4]?.split(".") ?? [],
  };
}

function compareAscii(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) {
      return difference;
    }
  }
  return left.length - right.length;
}

function compareNumericIdentifiers(left, right) {
  return left.length === right.length ? compareAscii(left, right) : left.length - right.length;
}

export function compareSemanticVersions(leftVersion, rightVersion) {
  const left = semanticVersionParts(leftVersion);
  const right = semanticVersionParts(rightVersion);
  if (!left || !right) {
    return Number.NaN;
  }
  for (let index = 0; index < 3; index += 1) {
    const difference = compareNumericIdentifiers(left.core[index], right.core[index]);
    if (difference !== 0) {
      return difference;
    }
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return right.prerelease.length - left.prerelease.length;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined || rightPart === undefined) {
      return leftPart === undefined ? -1 : 1;
    }
    if (leftPart === rightPart) {
      continue;
    }
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      return compareNumericIdentifiers(leftPart, rightPart);
    }
    if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    }
    return compareAscii(leftPart, rightPart);
  }
  return 0;
}

export function validateRuntimeManifestTransition(currentManifest, previousManifest) {
  const errors = [];
  const currentById = new Map(
    (currentManifest.registrations ?? []).map((registration) => [registration.id, registration]),
  );
  const allowedStatuses = new Map([
    ["candidate", new Set(["candidate", "approved", "retired"])],
    ["approved", new Set(["approved", "retired"])],
    ["retired", new Set(["retired"])],
  ]);

  for (const previous of previousManifest.registrations ?? []) {
    const current = currentById.get(previous.id);
    if (!current) {
      errors.push(`${previous.id}: registrations are append-only; retire instead of removing`);
      continue;
    }
    if (!allowedStatuses.get(previous.approvalStatus)?.has(current.approvalStatus)) {
      errors.push(
        `${previous.id}: invalid approvalStatus transition ${previous.approvalStatus} -> ${current.approvalStatus}`,
      );
    }

    if (!fieldsChanged(current, previous, behaviorFields)) {
      continue;
    }
    if (compareSemanticVersions(
      current.runtimeBehaviorVersion,
      previous.runtimeBehaviorVersion,
    ) <= 0) {
      errors.push(`${previous.id}: runtimeBehaviorVersion must increase when behavior changes`);
    }
    if (current.comparisonReportSha256 === previous.comparisonReportSha256) {
      errors.push(`${previous.id}: behavior changed without new comparative-evaluation evidence`);
    }
    for (const [component, versionField, componentFields] of [
      ["prompt", "promptVersion", ["promptPath", "promptSha256"]],
      ["schema", "schemaVersion", ["schemaPath", "schemaSha256"]],
      ["renderer", "rendererVersion", ["rendererManifestPath", "rendererManifestSha256"]],
      ["proof policy", "proofPolicyVersion", ["proofPolicyPath", "proofPolicySha256"]],
      ["evaluation suite", "evalSuiteVersion", ["evalSuiteManifestPath", "evalSuiteManifestSha256"]],
      ["model profile", "modelProfileVersion", [
        "providerProfileId",
        "providerProfileSha256",
        "requestedModel",
        "inferenceSettings",
        "maxOutputTokens",
        "timeoutMs",
        "requestStorage",
        "automaticRetry",
      ]],
    ]) {
      if (fieldsChanged(current, previous, componentFields) &&
          compareSemanticVersions(current[versionField], previous[versionField]) <= 0) {
        errors.push(`${previous.id}: ${versionField} must increase when ${component} changes`);
      }
    }
  }
  return errors;
}
