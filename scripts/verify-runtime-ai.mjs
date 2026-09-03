#!/usr/bin/env node

import crypto from "node:crypto";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  fromRoot,
  inspectRepositoryPath,
  readJson,
  readText,
  reportErrors,
  walkFiles,
} from "./lib/project.mjs";
import {
  validateArtifactPath,
  validateInferenceSettings,
  validateOutputTokenBound,
  validateRegistrationIdentity,
  validateRuntimeManifestTransition,
  validateTimeoutBound,
} from "./lib/runtime-ai.mjs";

const errors = [];
const manifest = readJson("ai/runtime-manifest.json");
const manifestKeys = new Set(Object.keys(manifest));
for (const expected of ["schemaVersion", "status", "registrations"]) {
  if (!manifestKeys.has(expected)) {
    errors.push(`ai/runtime-manifest.json: missing ${expected}`);
  }
}
for (const actual of manifestKeys) {
  if (!["schemaVersion", "status", "registrations"].includes(actual)) {
    errors.push(`ai/runtime-manifest.json: unknown field ${actual}`);
  }
}
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.registrations)) {
  errors.push("ai/runtime-manifest.json: expected schemaVersion 1 and registrations array");
}

const registrations = Array.isArray(manifest.registrations) ? manifest.registrations : [];
if (registrations.length === 0 && manifest.status !== "no-runtime-ai-registered") {
  errors.push("ai/runtime-manifest.json: empty manifest must state no-runtime-ai-registered");
}
if (registrations.length > 0 && manifest.status !== "registered") {
  errors.push("ai/runtime-manifest.json: populated manifest must state registered");
}

const registeredPrompts = new Set();
const ids = new Set();
for (const registration of registrations) {
  if (!registration || typeof registration !== "object" || Array.isArray(registration)) {
    errors.push("ai/runtime-manifest.json: every registration must be an exact object");
    continue;
  }
  const required = new Set([
    "id",
    "role",
    "approvalStatus",
    "provider",
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
    "store",
    "automaticRetry",
    "failurePolicy",
  ]);
  for (const field of required) {
    if (registration[field] === undefined || registration[field] === "") {
      errors.push(`${registration.id ?? "registration"}: missing ${field}`);
    }
  }
  for (const field of Object.keys(registration)) {
    if (!required.has(field)) {
      errors.push(`${registration.id ?? "registration"}: unknown field ${field}`);
    }
  }
  if (ids.has(registration.id)) {
    errors.push(`ai/runtime-manifest.json: duplicate registration ${registration.id}`);
  }
  ids.add(registration.id);
  errors.push(...validateRegistrationIdentity(registration));
  if (registration.store !== false) {
    errors.push(`${registration.id}: store must be false`);
  }
  if (registration.automaticRetry !== false) {
    errors.push(`${registration.id}: automaticRetry must be false`);
  }
  if (!["candidate", "approved", "retired"].includes(registration.approvalStatus)) {
    errors.push(`${registration.id}: invalid approvalStatus ${registration.approvalStatus}`);
  }
  if (!["observer", "teacher"].includes(registration.role)) {
    errors.push(`${registration.id}: invalid role ${registration.role}`);
  }
  if (registration.provider !== "openai") {
    errors.push(`${registration.id}: provider must be openai until the provider policy changes`);
  }
  if (registration.failurePolicy !== "visible-pause") {
    errors.push(`${registration.id}: failurePolicy must be visible-pause`);
  }
  errors.push(...validateOutputTokenBound(registration));
  errors.push(...validateTimeoutBound(registration));
  errors.push(...validateInferenceSettings(registration));

  const expectedModel = registration.role === "observer"
    ? "gpt-5.6-luna"
    : registration.role === "teacher"
      ? "gpt-5.6-terra"
      : undefined;
  if (expectedModel && registration.requestedModel !== expectedModel) {
    errors.push(`${registration.id}: ${registration.role} must request ${expectedModel} until the profile policy changes`);
  }

  for (const [kind, fileField, hashField] of [
    ["prompt", "promptPath", "promptSha256"],
    ["schema", "schemaPath", "schemaSha256"],
    ["renderer manifest", "rendererManifestPath", "rendererManifestSha256"],
    ["proof policy", "proofPolicyPath", "proofPolicySha256"],
    ["evaluation-suite manifest", "evalSuiteManifestPath", "evalSuiteManifestSha256"],
    ["comparison report", "comparisonReportPath", "comparisonReportSha256"],
  ]) {
    const relativePath = registration[fileField];
    for (const violation of validateArtifactPath(kind, relativePath)) {
      errors.push(`${registration.id}: ${violation}`);
    }
    const repositoryRoot = fromRoot();
    const resolvedPath = typeof relativePath === "string"
      ? path.resolve(repositoryRoot, relativePath)
      : "";
    const contained = typeof relativePath === "string" &&
      resolvedPath.startsWith(`${repositoryRoot}${path.sep}`) &&
      !path.isAbsolute(relativePath) &&
      !relativePath.includes("\\") &&
      path.normalize(relativePath).replaceAll("\\", "/") === relativePath;
    if (!contained) {
      errors.push(`${registration.id}: ${kind} path must be a normalized repository-relative path`);
      continue;
    }
    const artifactStatus = contained
      ? inspectRepositoryPath(repositoryRoot, repositoryRoot, relativePath, { requireFile: true })
      : { ok: false, reason: "outside" };
    if (artifactStatus.reason === "symlink") {
      errors.push(`${registration.id}: ${kind} file must not traverse symbolic links ${relativePath}`);
      continue;
    }
    if (!relativePath || !artifactStatus.ok) {
      errors.push(`${registration.id}: missing ${kind} file ${relativePath ?? "(missing)"}`);
      continue;
    }
    const actual = crypto.createHash("sha256").update(readText(relativePath)).digest("hex");
    if (!/^[0-9a-f]{64}$/.test(registration[hashField] ?? "")) {
      errors.push(`${registration.id}: ${hashField} must be a lowercase SHA-256 digest`);
    }
    if (actual !== registration[hashField]) {
      errors.push(`${registration.id}: ${kind} hash does not match ${relativePath}`);
    }
    if (kind === "prompt") {
      registeredPrompts.add(relativePath);
    }
  }
}

for (const promptFile of walkFiles("ai/prompts", { extension: ".md" })) {
  if (!promptFile.endsWith("/README.md") && !registeredPrompts.has(promptFile)) {
    errors.push(`${promptFile}: runtime prompt is not registered`);
  }
}

const baseRef = process.env.WORK_PACKAGE_BASE_REF;
if (baseRef && /^0{40}$/.test(baseRef)) {
  errors.push("WORK_PACKAGE_BASE_REF must not be an all-zero revision");
} else if (baseRef) {
  try {
    const previousManifest = JSON.parse(execFileSync(
      "git",
      ["show", `${baseRef}:ai/runtime-manifest.json`],
      { cwd: fromRoot(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ));
    errors.push(...validateRuntimeManifestTransition(manifest, previousManifest));
  } catch {
    if (registrations.length > 0) {
      errors.push(
        `ai/runtime-manifest.json: cannot validate behavior changes against ${baseRef}`,
      );
    }
  }
}

reportErrors("Runtime-AI manifest verification", errors);
