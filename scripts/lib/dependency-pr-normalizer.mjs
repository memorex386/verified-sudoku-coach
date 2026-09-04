import crypto from "node:crypto";
import {
  canonicalSha256,
  canonicalValue,
  dependencyPullRequestIdempotencyKey,
  dependencyPullRequestLineageKey,
  exactObjectErrors,
  fullLowercaseSha1,
  fullLowercaseSha256,
  githubRepository,
  isExactObject,
  isSemverPatchUpdate,
  npmPackageName,
  validateAutomationPolicyAdmission,
} from "./automation-policy.mjs";

const eventKeys = [
  "schemaVersion",
  "eventId",
  "authenticationReceiptSha256",
  "sourceKind",
  "sourceEvent",
  "authenticatedActor",
  "authenticatedSourceApp",
  "repository",
  "pullRequestNumber",
  "eventBaseSha",
  "eventHeadSha",
  "currentBaseSha",
  "currentHeadSha",
  "policyVersion",
  "policySha256",
  "payloadSha256",
];
const evidenceKeys = [
  "schemaVersion",
  "repository",
  "pullRequestNumber",
  "policyVersion",
  "policySha256",
  "baseSha",
  "headSha",
  "ecosystem",
  "dependencyName",
  "manifestBefore",
  "manifestAfter",
  "diff",
  "checks",
  "failureFingerprint",
  "statefulChange",
  "irreversibleChange",
];
const manifestObservationKeys = ["content", "byteLength", "sha256"];
const diffKeys = ["baseSha", "headSha", "complete", "files"];
const fileKeys = ["path", "status", "beforeSha256", "afterSha256"];
const checksKeys = ["headSha", "complete", "items"];
const checkKeys = ["name", "outcome", "findingCodes"];
const casKeys = ["repository", "pullRequestNumber", "baseSha", "headSha"];
const dependencySections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const lifecycleScripts = new Set([
  "dependencies",
  "install",
  "postinstall",
  "preinstall",
  "prepare",
  "prepack",
  "postpack",
  "prepublish",
  "prepublishOnly",
  "postpublish",
]);
const knownFindingCodes = new Set([
  "license-change",
  "lifecycle-script",
  "native-dependency",
  "peer-conflict",
  "security-sensitive-surface",
  "source-change",
  "vulnerability-increase",
  "workflow-change",
]);
const checkOutcomes = new Set(["success", "failure", "timeout", "skipped", "not-run"]);
const fileStatuses = new Set(["added", "modified", "removed", "renamed"]);
function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function stringWithin(value, maximum) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    !hasControlCharacter(value);
}

function digestUtf8(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function createManifestObservation(content) {
  return {
    content,
    byteLength: Buffer.byteLength(content, "utf8"),
    sha256: digestUtf8(content),
  };
}

function parseManifestObservation(observation, label, limits) {
  const errors = exactObjectErrors(observation, label, manifestObservationKeys);
  if (!isExactObject(observation)) {
    return { errors, manifest: null };
  }
  if (typeof observation.content !== "string") {
    errors.push(`${label}.content must be a string`);
    return { errors, manifest: null };
  }
  const bytes = Buffer.byteLength(observation.content, "utf8");
  if (bytes > (limits?.maxManifestBytes ?? 0)) {
    errors.push(`${label}.content exceeds the manifest byte limit`);
  }
  if (observation.byteLength !== bytes) {
    errors.push(`${label}.byteLength must match the UTF-8 content length`);
  }
  if (!fullLowercaseSha256.test(observation.sha256 ?? "") ||
      observation.sha256 !== digestUtf8(observation.content)) {
    errors.push(`${label}.sha256 must match the UTF-8 content`);
  }
  let manifest;
  try {
    manifest = JSON.parse(observation.content);
  } catch {
    errors.push(`${label}.content must be valid JSON`);
    return { errors, manifest: null };
  }
  if (!isExactObject(manifest)) {
    errors.push(`${label}.content must contain a JSON object`);
    return { errors, manifest: null };
  }
  if (Object.keys(manifest).length > (limits?.maxManifestEntriesPerSection ?? 0)) {
    errors.push(`${label}.content has too many top-level entries`);
  }
  validateManifestTree(manifest, label, limits, errors);
  return { errors, manifest };
}

function validateManifestTree(manifest, label, limits, errors) {
  const dangerousKeys = new Set(["__proto__", "constructor", "prototype"]);
  const inspect = (value, path, depth) => {
    if (depth > 8) {
      errors.push(`${path} exceeds the supported nesting depth`);
      return;
    }
    if (typeof value === "string") {
      if (value.length > (limits?.maxStringLength ?? 0) || hasControlCharacter(value)) {
        errors.push(`${path} must be a bounded string without control characters`);
      }
      return;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number") {
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > (limits?.maxManifestEntriesPerSection ?? 0)) {
        errors.push(`${path} has too many entries`);
      }
      value.forEach((item, index) => inspect(item, `${path}[${index}]`, depth + 1));
      return;
    }
    if (!isExactObject(value)) {
      errors.push(`${path} contains an unsupported value`);
      return;
    }
    const entries = Object.entries(value);
    if (entries.length > (limits?.maxManifestEntriesPerSection ?? 0)) {
      errors.push(`${path} has too many entries`);
    }
    for (const [key, item] of entries) {
      if (dangerousKeys.has(key) || key.length > (limits?.maxStringLength ?? 0) ||
          hasControlCharacter(key)) {
        errors.push(`${path} contains an unsafe or unbounded key`);
      }
      inspect(item, `${path}.${key}`, depth + 1);
    }
  };
  inspect(manifest, `${label}.content`, 0);

  for (const section of dependencySections) {
    if (!Object.hasOwn(manifest, section)) {
      continue;
    }
    const dependencies = manifest[section];
    if (!isExactObject(dependencies)) {
      errors.push(`${label}.${section} must be an object`);
      continue;
    }
    for (const [name, version] of Object.entries(dependencies)) {
      if (!npmPackageName.test(name) || typeof version !== "string") {
        errors.push(`${label}.${section} must map canonical package names to versions`);
      }
    }
  }
  if (Object.hasOwn(manifest, "scripts")) {
    if (!isExactObject(manifest.scripts)) {
      errors.push(`${label}.scripts must be an object`);
    } else {
      if (Object.keys(manifest.scripts).length > (limits?.maxScripts ?? 0)) {
        errors.push(`${label}.scripts has too many entries`);
      }
      if (Object.entries(manifest.scripts).some(([, value]) => typeof value !== "string")) {
        errors.push(`${label}.scripts must map names to strings`);
      }
    }
  }
}

function validatePosixPath(value, maximum) {
  if (!stringWithin(value, maximum) || value.startsWith("/") || value.includes("\\") ||
      value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    return false;
  }
  return true;
}

function normalizeDiff(diff, policy) {
  const errors = exactObjectErrors(diff, "evidence.diff", diffKeys);
  if (!isExactObject(diff)) {
    return { errors, files: [] };
  }
  for (const key of ["baseSha", "headSha"]) {
    if (!fullLowercaseSha1.test(diff[key] ?? "")) {
      errors.push(`evidence.diff.${key} must be an exact full lowercase SHA-1`);
    }
  }
  if (diff.complete !== true) {
    errors.push("evidence.diff.complete must be true");
  }
  if (!Array.isArray(diff.files) ||
      diff.files.length === 0 ||
      diff.files.length > (policy?.evidenceLimits?.maxFileChanges ?? 0)) {
    errors.push("evidence.diff.files must be a non-empty bounded array");
    return { errors, files: [] };
  }
  const files = [];
  const seenPaths = new Set();
  for (const [index, file] of diff.files.entries()) {
    const label = `evidence.diff.files[${index}]`;
    errors.push(...exactObjectErrors(file, label, fileKeys));
    if (!isExactObject(file)) {
      continue;
    }
    if (!validatePosixPath(file.path, policy.evidenceLimits.maxStringLength)) {
      errors.push(`${label}.path must be a normalized bounded relative POSIX path`);
    }
    const foldedPath = typeof file.path === "string" ? file.path.toLowerCase() : "";
    if (seenPaths.has(foldedPath)) {
      errors.push(`${label}.path must be unique case-insensitively`);
    }
    seenPaths.add(foldedPath);
    if (!fileStatuses.has(file.status)) {
      errors.push(`${label}.status is unknown`);
    }
    for (const key of ["beforeSha256", "afterSha256"]) {
      if (!fullLowercaseSha256.test(file[key] ?? "")) {
        errors.push(`${label}.${key} must be an exact lowercase SHA-256`);
      }
    }
    files.push({
      path: file.path,
      status: file.status,
      beforeSha256: file.beforeSha256,
      afterSha256: file.afterSha256,
    });
  }
  files.sort((left, right) => compareCodeUnits(left.path, right.path));
  return { errors, files };
}

function normalizeChecks(checks, policy) {
  const errors = exactObjectErrors(checks, "evidence.checks", checksKeys);
  if (!isExactObject(checks)) {
    return { errors, checks: [] };
  }
  if (!fullLowercaseSha1.test(checks.headSha ?? "")) {
    errors.push("evidence.checks.headSha must be an exact full lowercase SHA-1");
  }
  if (checks.complete !== true) {
    errors.push("evidence.checks.complete must be true");
  }
  if (!Array.isArray(checks.items) ||
      checks.items.length > (policy?.evidenceLimits?.maxRequiredChecks ?? 0)) {
    errors.push("evidence.checks.items must be a bounded array");
    return { errors, checks: [] };
  }
  const normalized = [];
  const seen = new Set();
  for (const [index, check] of checks.items.entries()) {
    const label = `evidence.checks.items[${index}]`;
    errors.push(...exactObjectErrors(check, label, checkKeys));
    if (!isExactObject(check)) {
      continue;
    }
    if (!policy.eligibility.requiredChecks.includes(check.name)) {
      errors.push(`${label}.name is not a configured required check`);
    }
    if (seen.has(check.name)) {
      errors.push(`${label}.name must be unique`);
    }
    seen.add(check.name);
    if (!checkOutcomes.has(check.outcome)) {
      errors.push(`${label}.outcome is unknown`);
    }
    if (!Array.isArray(check.findingCodes) ||
        check.findingCodes.some((code) => !knownFindingCodes.has(code)) ||
        new Set(check.findingCodes).size !== check.findingCodes.length) {
      errors.push(`${label}.findingCodes must be a unique array of known codes`);
    }
    const findingCodes = Array.isArray(check.findingCodes)
      ? [...check.findingCodes].sort()
      : [];
    if (check.outcome === "success" && findingCodes.length > 0) {
      errors.push(`${label} cannot report findings with a successful outcome`);
    }
    normalized.push({ name: check.name, outcome: check.outcome, findingCodes });
  }
  normalized.sort((left, right) => compareCodeUnits(left.name, right.name));
  return { errors, checks: normalized };
}

export function dependencyFailureFingerprint(riskCodes, requiredChecks) {
  const normalizedRisks = Array.isArray(riskCodes)
    ? [...new Set(riskCodes)].sort()
    : [];
  const normalizedChecks = Array.isArray(requiredChecks)
    ? requiredChecks.map((check) => ({
      name: check.name,
      outcome: check.outcome,
      findingCodes: Array.isArray(check.findingCodes)
        ? [...new Set(check.findingCodes)].sort()
        : [],
    })).sort((left, right) => compareCodeUnits(left.name, right.name))
    : [];
  const hasFailure = normalizedRisks.length > 0 ||
    normalizedChecks.some((check) => check.outcome !== "success");
  return canonicalSha256({
    schemaVersion: 1,
    status: hasFailure ? "failure" : "no-failure",
    riskCodes: normalizedRisks,
    requiredChecks: normalizedChecks,
  });
}

export function dependencyIntentDigest(intent) {
  return canonicalSha256({
    schemaVersion: 1,
    ecosystem: intent?.ecosystem ?? null,
    dependencyName: intent?.dependencyName ?? null,
    dependencySection: intent?.dependencySection ?? null,
    currentVersion: intent?.currentVersion ?? null,
    proposedVersion: intent?.proposedVersion ?? null,
  });
}

function dependencyDeltas(before, after) {
  const deltas = [];
  for (const section of dependencySections) {
    const beforeMap = isExactObject(before?.[section]) ? before[section] : {};
    const afterMap = isExactObject(after?.[section]) ? after[section] : {};
    const names = new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)]);
    for (const name of [...names].sort()) {
      if (beforeMap[name] !== afterMap[name]) {
        deltas.push({
          dependencyName: name,
          dependencySection: section,
          currentVersion: beforeMap[name] ?? null,
          proposedVersion: afterMap[name] ?? null,
        });
      }
    }
  }
  return deltas;
}

function onlyTargetManifestChange(before, after, delta) {
  if (!delta || delta.currentVersion === null || delta.proposedVersion === null) {
    return false;
  }
  const projected = structuredClone(before);
  projected[delta.dependencySection][delta.dependencyName] = delta.proposedVersion;
  return JSON.stringify(canonicalValue(projected)) === JSON.stringify(canonicalValue(after));
}

function lifecycleChanged(before, after) {
  const beforeScripts = isExactObject(before?.scripts) ? before.scripts : {};
  const afterScripts = isExactObject(after?.scripts) ? after.scripts : {};
  return [...lifecycleScripts].some((name) => beforeScripts[name] !== afterScripts[name]);
}

function risksFromPath(path, allowedFiles) {
  const risks = [];
  const lowercase = path.toLowerCase();
  if (!allowedFiles.includes(path)) {
    risks.push("source-change");
  }
  if (lowercase.startsWith(".github/workflows/") || lowercase.includes("workflow")) {
    risks.push("workflow-change", "security-sensitive-surface");
  }
  if (lowercase.endsWith(".node") || lowercase.includes("/native/") ||
      lowercase.startsWith("native/") || lowercase.includes("binding.gyp")) {
    risks.push("native-dependency");
  }
  if (lowercase.includes("security") || lowercase.includes("auth") ||
      lowercase.includes("permission") || lowercase.includes("secret")) {
    risks.push("security-sensitive-surface");
  }
  return risks;
}

export function validateTrustedPullRequestEvent(event, policy) {
  const errors = exactObjectErrors(event, "trusted pull request event", eventKeys);
  if (!isExactObject(event)) {
    return errors;
  }
  if (event.schemaVersion !== 1) {
    errors.push("trusted pull request event schemaVersion must be 1");
  }
  if (!stringWithin(event.eventId, policy?.evidenceLimits?.maxStringLength ?? 0)) {
    errors.push("trusted pull request event eventId must be a bounded string");
  }
  for (const key of ["authenticationReceiptSha256", "payloadSha256", "policySha256"]) {
    if (!fullLowercaseSha256.test(event[key] ?? "")) {
      errors.push(`trusted pull request event ${key} must be an exact lowercase SHA-256`);
    }
  }
  for (const key of ["sourceKind", "sourceEvent", "authenticatedActor", "authenticatedSourceApp"]) {
    if (!stringWithin(event[key], policy?.evidenceLimits?.maxStringLength ?? 0)) {
      errors.push(`trusted pull request event ${key} must be a bounded string`);
    }
  }
  if (typeof event.repository !== "string" || !githubRepository.test(event.repository)) {
    errors.push("trusted pull request event repository must be a canonical lowercase owner/name");
  }
  if (!Number.isSafeInteger(event.pullRequestNumber) || event.pullRequestNumber < 1) {
    errors.push("trusted pull request event pullRequestNumber must be a positive safe integer");
  }
  for (const key of ["eventBaseSha", "eventHeadSha", "currentBaseSha", "currentHeadSha"]) {
    if (!fullLowercaseSha1.test(event[key] ?? "")) {
      errors.push(`trusted pull request event ${key} must be an exact full lowercase SHA-1`);
    }
  }
  if (event.policyVersion !== policy?.policyVersion) {
    errors.push("trusted pull request event policyVersion must match the active policy");
  }
  return errors;
}

export function comparePullRequestCas(expected, current) {
  const errors = [
    ...exactObjectErrors(expected, "expected pull request identity", casKeys),
    ...exactObjectErrors(current, "current pull request identity", casKeys),
  ];
  if (!isExactObject(expected) || !isExactObject(current)) {
    return { matches: false, terminalOutcome: "stale", reasons: errors };
  }
  for (const [value, label] of [
    [expected, "expected pull request identity"],
    [current, "current pull request identity"],
  ]) {
    if (typeof value.repository !== "string" || !githubRepository.test(value.repository)) {
      errors.push(`${label} repository must be canonical`);
    }
    if (!Number.isSafeInteger(value.pullRequestNumber) || value.pullRequestNumber < 1) {
      errors.push(`${label} pullRequestNumber must be positive`);
    }
    for (const key of ["baseSha", "headSha"]) {
      if (!fullLowercaseSha1.test(value[key] ?? "")) {
        errors.push(`${label} ${key} must be an exact full lowercase SHA-1`);
      }
    }
  }
  for (const key of ["repository", "pullRequestNumber", "baseSha", "headSha"]) {
    if (expected[key] !== current[key]) {
      errors.push(`pull request ${key} changed`);
    }
  }
  return {
    matches: errors.length === 0,
    terminalOutcome: errors.length === 0 ? null : "stale",
    reasons: errors,
  };
}

function failedResult(terminalOutcome, reasons) {
  return {
    eligible: false,
    nextStage: null,
    terminalOutcome,
    reasons: [...new Set(reasons)].sort(),
    candidate: null,
  };
}

export function classifyDependencyPullRequest(policy, event, evidence, policyRegistry) {
  try {
    const policyErrors = validateAutomationPolicyAdmission(policy, policyRegistry);
    if (policyErrors.length > 0) {
      return failedResult("failed-terminal", policyErrors.map((error) => `policy: ${error}`));
    }
    const eventErrors = validateTrustedPullRequestEvent(event, policy);
    if (eventErrors.length > 0) {
      return failedResult("failed-terminal", eventErrors);
    }
    const evidenceErrors = exactObjectErrors(evidence, "dependency pull request evidence", evidenceKeys);
    if (!isExactObject(evidence)) {
      return failedResult("failed-terminal", evidenceErrors);
    }
    if (evidence.schemaVersion !== 1) {
      evidenceErrors.push("dependency pull request evidence schemaVersion must be 1");
    }
    if (typeof evidence.repository !== "string" || !githubRepository.test(evidence.repository)) {
      evidenceErrors.push("dependency pull request evidence repository must be canonical");
    }
    if (!Number.isSafeInteger(evidence.pullRequestNumber) || evidence.pullRequestNumber < 1) {
      evidenceErrors.push("dependency pull request evidence pullRequestNumber must be positive");
    }
    for (const key of ["baseSha", "headSha"]) {
      if (!fullLowercaseSha1.test(evidence[key] ?? "")) {
        evidenceErrors.push(`dependency pull request evidence ${key} must be a full SHA-1`);
      }
    }
    if (evidence.policyVersion !== policy.policyVersion ||
        evidence.policySha256 !== policy.policySha256) {
      evidenceErrors.push("dependency pull request evidence policy identity must match");
    }
    if (evidence.ecosystem !== policy.source.ecosystem) {
      evidenceErrors.push("dependency pull request evidence ecosystem must be npm");
    }
    if (typeof evidence.dependencyName !== "string" ||
        !npmPackageName.test(evidence.dependencyName)) {
      evidenceErrors.push("dependency pull request evidence dependencyName must be canonical");
    }
    if (typeof evidence.statefulChange !== "boolean" ||
        typeof evidence.irreversibleChange !== "boolean") {
      evidenceErrors.push("dependency pull request evidence change flags must be booleans");
    }
    if (!fullLowercaseSha256.test(evidence.failureFingerprint ?? "")) {
      evidenceErrors.push("dependency pull request evidence failureFingerprint must be a SHA-256");
    }

    const before = parseManifestObservation(
      evidence.manifestBefore,
      "evidence.manifestBefore",
      policy.evidenceLimits,
    );
    const after = parseManifestObservation(
      evidence.manifestAfter,
      "evidence.manifestAfter",
      policy.evidenceLimits,
    );
    const diff = normalizeDiff(evidence.diff, policy);
    const checks = normalizeChecks(evidence.checks, policy);
    evidenceErrors.push(...before.errors, ...after.errors, ...diff.errors, ...checks.errors);
    if (evidenceErrors.length > 0) {
      return failedResult("failed-terminal", evidenceErrors);
    }

    const staleReasons = [];
    const identityPairs = [
      [event.repository, evidence.repository, "repository"],
      [event.pullRequestNumber, evidence.pullRequestNumber, "pullRequestNumber"],
      [event.currentBaseSha, evidence.baseSha, "baseSha"],
      [event.currentHeadSha, evidence.headSha, "headSha"],
      [event.currentBaseSha, evidence.diff.baseSha, "diff baseSha"],
      [event.currentHeadSha, evidence.diff.headSha, "diff headSha"],
      [event.currentHeadSha, evidence.checks.headSha, "checks headSha"],
      [event.policyVersion, evidence.policyVersion, "policyVersion"],
      [event.policySha256, evidence.policySha256, "policySha256"],
    ];
    if (event.eventBaseSha !== event.currentBaseSha) {
      staleReasons.push("event base SHA is stale");
    }
    if (event.eventHeadSha !== event.currentHeadSha) {
      staleReasons.push("event head SHA is stale");
    }
    for (const [trusted, observed, label] of identityPairs) {
      if (trusted !== observed) {
        staleReasons.push(`${label} does not match the trusted current event`);
      }
    }
    if (staleReasons.length > 0) {
      return failedResult("stale", staleReasons);
    }

    const sourceReasons = [];
    if (event.sourceKind !== policy.source.kind) {
      sourceReasons.push("authenticated source kind is not allowlisted");
    }
    if (event.sourceEvent !== policy.source.event) {
      sourceReasons.push("authenticated source event is not allowlisted");
    }
    if (event.authenticatedActor !== policy.source.actor) {
      sourceReasons.push("authenticated source actor is not allowlisted");
    }
    if (event.authenticatedSourceApp !== policy.source.app) {
      sourceReasons.push("authenticated source app is not allowlisted");
    }

    const deltas = dependencyDeltas(before.manifest, after.manifest);
    const delta = deltas.length === 1 ? deltas[0] : null;
    const derivedDependencyName = delta?.dependencyName ?? evidence.dependencyName;
    const risks = new Set();
    if (policy.eligibility.compilerBuildTools.includes(derivedDependencyName)) {
      risks.add("compiler-or-build-tool");
    }
    if (deltas.length !== 1 || !onlyTargetManifestChange(before.manifest, after.manifest, delta)) {
      risks.add("source-change");
    }
    if (delta?.currentVersion === null && delta?.proposedVersion !== null) {
      risks.add("new-direct-package");
    }
    if (before.manifest.license !== after.manifest.license) {
      risks.add("license-change");
    }
    if (lifecycleChanged(before.manifest, after.manifest)) {
      risks.add("lifecycle-script");
    }
    for (const file of diff.files) {
      for (const risk of risksFromPath(file.path, policy.eligibility.allowedFiles)) {
        risks.add(risk);
      }
      if (file.status !== "modified") {
        risks.add("source-change");
      }
      if (file.beforeSha256 === file.afterSha256) {
        risks.add("missing-telemetry");
      }
    }
    for (const check of checks.checks) {
      for (const finding of check.findingCodes) {
        risks.add(finding);
      }
      if (check.outcome !== "success" && check.findingCodes.length === 0) {
        risks.add("missing-telemetry");
      }
    }
    const checkNames = new Set(checks.checks.map((check) => check.name));
    if (policy.eligibility.requiredChecks.some((name) => !checkNames.has(name))) {
      risks.add("missing-telemetry");
    }

    const packageFile = diff.files.find((file) => file.path === "package.json");
    if (!packageFile || packageFile.beforeSha256 !== evidence.manifestBefore.sha256 ||
        packageFile.afterSha256 !== evidence.manifestAfter.sha256) {
      risks.add("missing-telemetry");
    }
    const changedFiles = diff.files.map((file) => file.path);
    const allowedFiles = [...policy.eligibility.allowedFiles].sort(compareCodeUnits);
    if (JSON.stringify(changedFiles) !== JSON.stringify(allowedFiles)) {
      risks.add("source-change");
    }

    const riskCodes = [...risks].sort();
    const failureFingerprint = dependencyFailureFingerprint(riskCodes, checks.checks);
    const normalizedEvidenceIdentity = {
      schemaVersion: 1,
      repository: evidence.repository,
      pullRequestNumber: evidence.pullRequestNumber,
      policyVersion: evidence.policyVersion,
      policySha256: evidence.policySha256,
      baseSha: evidence.baseSha,
      headSha: evidence.headSha,
      ecosystem: evidence.ecosystem,
      dependencyName: evidence.dependencyName,
      manifestBeforeSha256: evidence.manifestBefore.sha256,
      manifestAfterSha256: evidence.manifestAfter.sha256,
      files: diff.files,
      checks: checks.checks,
      statefulChange: evidence.statefulChange,
      irreversibleChange: evidence.irreversibleChange,
    };
    const candidate = {
      schemaVersion: 1,
      repository: event.repository,
      pullRequestNumber: event.pullRequestNumber,
      baseSha: event.currentBaseSha,
      headSha: event.currentHeadSha,
      policyVersion: event.policyVersion,
      policySha256: event.policySha256,
      dependencyName: derivedDependencyName,
      dependencySection: delta?.dependencySection ?? null,
      directDependency: delta?.currentVersion !== null && delta?.currentVersion !== undefined,
      existingDependency: delta?.currentVersion !== null && delta?.currentVersion !== undefined,
      currentVersion: delta?.currentVersion ?? null,
      proposedVersion: delta?.proposedVersion ?? null,
      changedFiles,
      riskCodes,
      failureFingerprint,
      dependencyIntentSha256: dependencyIntentDigest({
        ecosystem: evidence.ecosystem,
        dependencyName: derivedDependencyName,
        dependencySection: delta?.dependencySection ?? null,
        currentVersion: delta?.currentVersion ?? null,
        proposedVersion: delta?.proposedVersion ?? null,
      }),
      inputEvidenceSha256: canonicalSha256(normalizedEvidenceIdentity),
      statefulChange: evidence.statefulChange,
      irreversibleChange: evidence.irreversibleChange,
    };
    candidate.idempotencyKey = dependencyPullRequestIdempotencyKey(candidate);
    candidate.lineageKey = dependencyPullRequestLineageKey(candidate);

    const reasons = [...sourceReasons];
    if (!delta || delta.dependencyName !== evidence.dependencyName) {
      reasons.push("dependencyName does not match the sole manifest dependency delta");
    }
    if (candidate.dependencySection !== policy.eligibility.dependencySection) {
      reasons.push("dependency is not an existing devDependency");
    }
    if (!candidate.directDependency || !candidate.existingDependency) {
      reasons.push("dependency must be direct and already declared");
    }
    if (!isSemverPatchUpdate(candidate.currentVersion, candidate.proposedVersion)) {
      reasons.push("dependency update is not a stable semver patch");
    }
    if (candidate.failureFingerprint !== evidence.failureFingerprint) {
      reasons.push("failureFingerprint does not match deterministic evidence");
    }
    if (candidate.statefulChange) {
      reasons.push("stateful changes are ineligible");
    }
    if (candidate.irreversibleChange) {
      reasons.push("irreversible changes are ineligible");
    }
    if (riskCodes.length > 0) {
      reasons.push(`forbidden dependency risk: ${riskCodes.join(",")}`);
    }
    const eligible = reasons.length === 0;
    return {
      eligible,
      nextStage: eligible ? "cheap-model-assessment" : null,
      terminalOutcome: eligible ? null : "deferred",
      reasons: [...new Set(reasons)].sort(),
      candidate,
    };
  } catch {
    return failedResult("failed-terminal", ["dependency evidence normalization failed closed"]);
  }
}
