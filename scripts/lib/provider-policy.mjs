import crypto from "node:crypto";
import { compareSemanticVersions } from "./runtime-ai.mjs";

const exactPolicyKeys = [
  "schemaVersion",
  "policyVersion",
  "policySha256",
  "profiles",
];
const exactProfileKeys = [
  "id",
  "profileVersion",
  "profileSha256",
  "provider",
  "runtimeAdmission",
  "adapter",
  "capabilities",
  "modelsByRole",
  "inferenceSettingsByRole",
  "dataHandling",
  "browserBoundary",
];
const exactAdapterKeys = ["package", "protocol", "protocolVersion"];
const exactDataHandlingKeys = ["requestStorage"];
const exactBrowserBoundaryKeys = [
  "dependencyPatterns",
  "credentialNamePatterns",
  "endpointPatterns",
];
const runtimeRoles = ["observer", "teacher"];
const runtimeAdmissions = new Set(["candidate", "approved", "retired", "boundary-only"]);
const requiredRuntimeCapabilities = [
  "no-tools",
  "request-storage-disabled",
  "strict-json-schema",
];
const identifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const adapterPackagePattern = /^@verified-sudoku\/adapter-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const capabilityPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const digestPattern = /^[0-9a-f]{64}$/;
const semanticVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function isExactObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalValue(value) {
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

function digest(value) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex");
}

function withoutKeys(value, omittedKeys) {
  if (!isExactObject(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !omittedKeys.includes(key)),
  );
}

export function providerProfileDigest(profile) {
  return digest(withoutKeys(profile, ["profileSha256", "runtimeAdmission"]));
}

export function providerPolicyDigest(policy) {
  return digest(withoutKeys(policy, ["policySha256"]));
}

function validateExactKeys(value, expectedKeys, label) {
  if (!isExactObject(value)) {
    return [`${label} must be an exact object`];
  }
  const errors = [];
  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) {
      errors.push(`${label}: missing ${key}`);
    }
  }
  for (const key of Object.keys(value)) {
    if (!expectedKeys.includes(key)) {
      errors.push(`${label}: unknown field ${key}`);
    }
  }
  return errors;
}

function validateStringSet(value, label, { allowEmpty = false, pattern } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    return [`${label} must be ${allowEmpty ? "an" : "a non-empty"} array of unique strings`];
  }
  const errors = [];
  if (value.some((item) => typeof item !== "string" || item.length === 0)) {
    errors.push(`${label} must contain only non-empty strings`);
    return errors;
  }
  if (new Set(value).size !== value.length) {
    errors.push(`${label} must not contain duplicates`);
  }
  if (JSON.stringify(value) !== JSON.stringify([...value].sort())) {
    errors.push(`${label} must be sorted`);
  }
  if (pattern && value.some((item) => !pattern.test(item))) {
    errors.push(`${label} contains an invalid identifier`);
  }
  return errors;
}

function validateRegexSet(value, label) {
  const errors = validateStringSet(value, label);
  if (errors.length > 0) {
    return errors;
  }
  for (const pattern of value) {
    if (pattern.length > 240) {
      errors.push(`${label}: pattern exceeds 240 characters`);
      continue;
    }
    try {
      new RegExp(pattern, "i");
    } catch {
      errors.push(`${label}: invalid regular expression ${pattern}`);
    }
  }
  return errors;
}

function validateRoleMap(value, label, validateValue) {
  if (!isExactObject(value)) {
    return [`${label} must be an exact object`];
  }
  const errors = [];
  for (const role of Object.keys(value)) {
    if (!runtimeRoles.includes(role)) {
      errors.push(`${label}: unknown role ${role}`);
    } else {
      errors.push(...validateValue(value[role], `${label}.${role}`));
    }
  }
  return errors;
}

function validateJsonValue(value, label) {
  if (!isExactObject(value)) {
    return [`${label} must be an exact object`];
  }
  const active = new Set();
  const isJsonValue = (candidate) => {
    if (candidate === null || typeof candidate === "string" ||
        typeof candidate === "boolean") {
      return true;
    }
    if (typeof candidate === "number") {
      return Number.isFinite(candidate);
    }
    if (typeof candidate !== "object" || active.has(candidate)) {
      return false;
    }
    active.add(candidate);
    const valid = Array.isArray(candidate)
      ? candidate.every((item) => isJsonValue(item))
      : isExactObject(candidate) && Object.values(candidate).every((item) => isJsonValue(item));
    active.delete(candidate);
    return valid;
  };
  if (!isJsonValue(value)) {
    return [`${label} must contain only JSON values`];
  }
  return [];
}

function sameKeys(left, right) {
  return JSON.stringify(Object.keys(left).sort()) === JSON.stringify(Object.keys(right).sort());
}

function profileLabel(profile, index) {
  return typeof profile?.id === "string"
    ? `provider profile ${profile.id}`
    : `provider profile at index ${index}`;
}

export function validateProviderPolicy(policy) {
  const errors = validateExactKeys(policy, exactPolicyKeys, "config/provider-policy.json");
  if (!isExactObject(policy)) {
    return errors;
  }
  if (policy.schemaVersion !== 1) {
    errors.push("config/provider-policy.json: schemaVersion must be 1");
  }
  if (typeof policy.policyVersion !== "string" ||
      !semanticVersionPattern.test(policy.policyVersion)) {
    errors.push("config/provider-policy.json: policyVersion must be a semantic-version string");
  }
  if (!digestPattern.test(policy.policySha256 ?? "")) {
    errors.push("config/provider-policy.json: policySha256 must be a lowercase SHA-256 digest");
  }
  if (!Array.isArray(policy.profiles) || policy.profiles.length === 0) {
    errors.push("config/provider-policy.json: profiles must be a non-empty array");
    return errors;
  }

  const ids = new Set();
  for (const [index, profile] of policy.profiles.entries()) {
    const label = profileLabel(profile, index);
    errors.push(...validateExactKeys(profile, exactProfileKeys, label));
    if (!isExactObject(profile)) {
      continue;
    }
    if (typeof profile.id !== "string" || !identifierPattern.test(profile.id)) {
      errors.push(`${label}: id must be a lowercase kebab-case string`);
    } else if (ids.has(profile.id)) {
      errors.push(`${label}: duplicate id`);
    } else {
      ids.add(profile.id);
    }
    if (typeof profile.profileVersion !== "string" ||
        !semanticVersionPattern.test(profile.profileVersion)) {
      errors.push(`${label}: profileVersion must be a semantic-version string`);
    }
    if (typeof profile.provider !== "string" || !identifierPattern.test(profile.provider)) {
      errors.push(`${label}: provider must be a lowercase kebab-case string`);
    }
    if (!runtimeAdmissions.has(profile.runtimeAdmission)) {
      errors.push(`${label}: invalid runtimeAdmission ${profile.runtimeAdmission}`);
    }

    if (profile.adapter === null) {
      if (profile.runtimeAdmission !== "boundary-only") {
        errors.push(`${label}: runtime-admitted profiles require an adapter`);
      }
    } else {
      errors.push(...validateExactKeys(profile.adapter, exactAdapterKeys, `${label}.adapter`));
      if (isExactObject(profile.adapter)) {
        if (typeof profile.adapter.package !== "string" ||
            !adapterPackagePattern.test(profile.adapter.package)) {
          errors.push(`${label}.adapter: package must be an @verified-sudoku/adapter-* workspace`);
        }
        if (typeof profile.adapter.protocol !== "string" ||
            !identifierPattern.test(profile.adapter.protocol)) {
          errors.push(`${label}.adapter: protocol must be a lowercase kebab-case string`);
        }
        if (typeof profile.adapter.protocolVersion !== "string" ||
            !semanticVersionPattern.test(profile.adapter.protocolVersion)) {
          errors.push(`${label}.adapter: protocolVersion must be a semantic-version string`);
        }
      }
      if (profile.runtimeAdmission === "boundary-only") {
        errors.push(`${label}: boundary-only profiles must not declare an adapter`);
      }
    }

    errors.push(...validateStringSet(
      profile.capabilities,
      `${label}.capabilities`,
      { allowEmpty: profile.runtimeAdmission === "boundary-only", pattern: capabilityPattern },
    ));
    if (["candidate", "approved"].includes(profile.runtimeAdmission) &&
        Array.isArray(profile.capabilities)) {
      for (const capability of requiredRuntimeCapabilities) {
        if (!profile.capabilities.includes(capability)) {
          errors.push(`${label}.capabilities: missing required capability ${capability}`);
        }
      }
    }
    errors.push(...validateRoleMap(
      profile.modelsByRole,
      `${label}.modelsByRole`,
      (model, modelLabel) => typeof model === "string" && model.length > 0
        ? []
        : [`${modelLabel} must be a non-empty string`],
    ));
    errors.push(...validateRoleMap(
      profile.inferenceSettingsByRole,
      `${label}.inferenceSettingsByRole`,
      validateJsonValue,
    ));
    if (isExactObject(profile.modelsByRole) && isExactObject(profile.inferenceSettingsByRole) &&
        !sameKeys(profile.modelsByRole, profile.inferenceSettingsByRole)) {
      errors.push(`${label}: modelsByRole and inferenceSettingsByRole must declare identical roles`);
    }
    if (["candidate", "approved"].includes(profile.runtimeAdmission) &&
        isExactObject(profile.modelsByRole) && Object.keys(profile.modelsByRole).length === 0) {
      errors.push(`${label}: runtime-admitted profiles must declare at least one role`);
    }
    if (profile.runtimeAdmission === "boundary-only" &&
        ((isExactObject(profile.modelsByRole) && Object.keys(profile.modelsByRole).length > 0) ||
         (isExactObject(profile.inferenceSettingsByRole) &&
          Object.keys(profile.inferenceSettingsByRole).length > 0))) {
      errors.push(`${label}: boundary-only profiles must not declare runtime roles`);
    }

    errors.push(...validateExactKeys(
      profile.dataHandling,
      exactDataHandlingKeys,
      `${label}.dataHandling`,
    ));
    if (profile.dataHandling?.requestStorage !== "disabled") {
      errors.push(`${label}.dataHandling: requestStorage must be disabled`);
    }

    errors.push(...validateExactKeys(
      profile.browserBoundary,
      exactBrowserBoundaryKeys,
      `${label}.browserBoundary`,
    ));
    if (isExactObject(profile.browserBoundary)) {
      errors.push(...validateStringSet(
        profile.browserBoundary.dependencyPatterns,
        `${label}.browserBoundary.dependencyPatterns`,
      ));
      errors.push(...validateRegexSet(
        profile.browserBoundary.credentialNamePatterns,
        `${label}.browserBoundary.credentialNamePatterns`,
      ));
      errors.push(...validateRegexSet(
        profile.browserBoundary.endpointPatterns,
        `${label}.browserBoundary.endpointPatterns`,
      ));
    }

    if (!digestPattern.test(profile.profileSha256 ?? "")) {
      errors.push(`${label}: profileSha256 must be a lowercase SHA-256 digest`);
    } else if (providerProfileDigest(profile) !== profile.profileSha256) {
      errors.push(`${label}: profileSha256 does not match the canonical descriptor`);
    }
  }

  if (digestPattern.test(policy.policySha256 ?? "") &&
      providerPolicyDigest(policy) !== policy.policySha256) {
    errors.push("config/provider-policy.json: policySha256 does not match the canonical policy");
  }
  return errors;
}

export function validateProviderPolicyTransition(currentPolicy, previousPolicy) {
  const errors = [];
  if (currentPolicy?.policySha256 !== previousPolicy?.policySha256 &&
      compareSemanticVersions(currentPolicy?.policyVersion, previousPolicy?.policyVersion) <= 0) {
    errors.push(
      "config/provider-policy.json: policyVersion must increase when provider policy changes",
    );
  }
  const currentById = new Map(
    (Array.isArray(currentPolicy?.profiles) ? currentPolicy.profiles : [])
      .map((profile) => [profile.id, profile]),
  );
  const allowedAdmissions = new Map([
    ["boundary-only", new Set(["boundary-only", "candidate"])],
    ["candidate", new Set(["candidate", "approved", "retired"])],
    ["approved", new Set(["approved", "retired"])],
    ["retired", new Set(["retired"])],
  ]);
  for (const previous of Array.isArray(previousPolicy?.profiles) ? previousPolicy.profiles : []) {
    const current = currentById.get(previous.id);
    if (!current) {
      errors.push(`${previous.id}: provider profiles are append-only; retire instead of removing`);
      continue;
    }
    if (!allowedAdmissions.get(previous.runtimeAdmission)?.has(current.runtimeAdmission)) {
      errors.push(
        `${previous.id}: invalid runtimeAdmission transition ` +
        `${previous.runtimeAdmission} -> ${current.runtimeAdmission}`,
      );
    }
    if (current.profileSha256 !== previous.profileSha256 &&
        compareSemanticVersions(current.profileVersion, previous.profileVersion) <= 0) {
      errors.push(
        `${previous.id}: profileVersion must increase when the provider descriptor changes`,
      );
    }
  }
  return errors;
}

export function browserBoundaryFromProviderPolicy(policy) {
  const boundary = {
    dependencyPatterns: new Set(),
    credentialNamePatterns: new Set(),
    endpointPatterns: new Set(),
  };
  for (const profile of Array.isArray(policy?.profiles) ? policy.profiles : []) {
    const configured = isExactObject(profile?.browserBoundary) ? profile.browserBoundary : {};
    for (const key of Object.keys(boundary)) {
      for (const pattern of Array.isArray(configured[key]) ? configured[key] : []) {
        if (typeof pattern === "string") {
          boundary[key].add(pattern);
        }
      }
    }
  }
  return Object.fromEntries(
    Object.entries(boundary).map(([key, values]) => [key, [...values].sort()]),
  );
}

function validateExactJson(actual, expected, path, errors) {
  if (isExactObject(expected)) {
    if (!isExactObject(actual)) {
      errors.push(`${path} must be an exact object`);
      return;
    }
    for (const key of Object.keys(expected)) {
      if (!Object.hasOwn(actual, key)) {
        errors.push(`${path}: missing ${key}`);
      }
    }
    for (const key of Object.keys(actual)) {
      if (!Object.hasOwn(expected, key)) {
        errors.push(`${path}: unknown field ${key}`);
      }
    }
    for (const key of Object.keys(expected)) {
      if (Object.hasOwn(actual, key)) {
        validateExactJson(actual[key], expected[key], `${path}.${key}`, errors);
      }
    }
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) ||
        JSON.stringify(canonicalValue(actual)) !== JSON.stringify(canonicalValue(expected))) {
      errors.push(`${path} must exactly match the provider profile`);
    }
    return;
  }
  if (!Object.is(actual, expected)) {
    errors.push(`${path} must equal ${JSON.stringify(expected)}`);
  }
}

export function validateRuntimeProviderSelection(registration, policy) {
  const label = typeof registration?.id === "string" ? registration.id : "registration";
  const profileId = registration?.providerProfileId;
  if (typeof profileId !== "string" || !identifierPattern.test(profileId)) {
    return [`${label}: providerProfileId must be a lowercase kebab-case string`];
  }
  const profiles = Array.isArray(policy?.profiles) ? policy.profiles : [];
  const profile = profiles.find((candidate) => candidate?.id === profileId);
  if (!profile) {
    return [`${label}: unknown providerProfileId ${profileId}`];
  }
  const errors = [];
  const allowedRegistrationStatuses = new Map([
    ["candidate", new Set(["candidate", "retired"])],
    ["approved", new Set(["candidate", "approved", "retired"])],
    ["retired", new Set(["retired"])],
  ]);
  if (!allowedRegistrationStatuses.get(profile.runtimeAdmission)?.has(
    registration.approvalStatus,
  )) {
    errors.push(`${label}: provider profile ${profileId} is not admitted for runtime use`);
    return errors;
  }
  if (registration.providerProfileSha256 !== profile.profileSha256) {
    errors.push(`${label}: providerProfileSha256 must match provider profile ${profileId}`);
  }
  if (registration.modelProfileVersion !== profile.profileVersion) {
    errors.push(`${label}: modelProfileVersion must match provider profile ${profileId}`);
  }
  const expectedModel = profile.modelsByRole?.[registration.role];
  if (typeof expectedModel !== "string") {
    errors.push(`${label}: provider profile ${profileId} does not support role ${registration.role}`);
  } else if (registration.requestedModel !== expectedModel) {
    errors.push(`${label}: requestedModel must be ${expectedModel} for provider profile ${profileId}`);
  }
  if (registration.requestStorage !== profile.dataHandling?.requestStorage) {
    errors.push(`${label}: requestStorage must be ${profile.dataHandling?.requestStorage}`);
  }
  const expectedSettings = profile.inferenceSettingsByRole?.[registration.role];
  if (expectedSettings !== undefined) {
    validateExactJson(
      registration.inferenceSettings,
      expectedSettings,
      `${label}: inferenceSettings`,
      errors,
    );
  }
  return errors;
}
