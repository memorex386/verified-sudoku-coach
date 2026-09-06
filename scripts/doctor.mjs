#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fromRoot, isEntrypoint, readJson, reportErrors } from "./lib/project.mjs";

const requiredPaths = [
  ".nvmrc",
  ".npmrc",
  ".github/CODEOWNERS",
  ".github/dependabot.yml",
  ".github/pull_request_template.md",
  ".github/workflows/codeql.yml",
  ".github/workflows/dependency-review.yml",
  ".github/workflows/foundation.yml",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
  "config/architecture.json",
  "config/automation-policy.json",
  "docs/README.md",
  "docs/work-packages/README.md",
  "package-lock.json",
  "package.json",
  "scripts/lib/automation-policy.mjs",
  "scripts/lib/automation-controller.mjs",
  "scripts/lib/dependency-pr-normalizer.mjs",
  "scripts/fixtures/automation/dependabot-typescript-7-pr-2.json",
  "scripts/run-automation-fixture.mjs",
  "scripts/verify-automation-policy.mjs",
  "scripts/verify-ci.mjs",
  "tsconfig.base.json",
  "tsconfig.json",
];

const expectedFoundationScripts = {
  "architecture:check": "node scripts/verify-architecture.mjs",
  "automation:check": "node scripts/verify-automation-policy.mjs",
  "automation:fixture": "node scripts/run-automation-fixture.mjs",
  "ci:check": "node scripts/verify-ci.mjs",
  "docs:check": "node scripts/verify-docs.mjs",
  doctor: "node scripts/doctor.mjs",
  "eval:replay": "node scripts/eval-replay.mjs",
  "licenses:check": "node scripts/verify-licenses.mjs",
  lint: "eslint . --max-warnings 0",
  "runtime-ai:check": "node scripts/verify-runtime-ai.mjs",
  "security:check": "node scripts/verify-public-boundary.mjs",
  "skills:check": "node scripts/verify-skills.mjs",
  test: "node --test scripts/validation.test.mjs && npm run test:domain && npm run test:contracts && npm run test:fixture-tools && npm run test:proof && npm run test:tutor",
  "test:contracts": "tsc -b packages/boundary-codecs --pretty false && node scripts/verify-contract-artifacts.mjs && node --test packages/boundary-codecs/test/contracts.test.mjs packages/boundary-codecs/test/fixture-contracts.test.mjs",
  "test:tutor": "tsc -b --pretty false && node --test scripts/local-tutor.test.mjs",
  "dev:tutor": "tsc -b --pretty false && node scripts/local-tutor-server.mjs",
  "test:proof": "tsc -b packages/proof-engine --pretty false && node --test packages/proof-engine/test/singles.test.mjs",
  "test:domain": "tsc -b packages/domain --pretty false && node scripts/verify-domain-api.mjs && node --test packages/domain/test/domain.test.mjs",
  "pack:smoke": "tsc -b --pretty false && node --test scripts/package-conformance.test.mjs && node scripts/verify-package-conformance.mjs",
  "test:fixture-tools": "tsc -b packages/testing --pretty false && node --test packages/testing/test/fixtures.test.mjs packages/testing/test/transforms.test.mjs",
  typecheck: "tsc -b --pretty false",
  "work-packages:check": "node scripts/generate-work-package-registry.mjs --check",
  "work-packages:generate": "node scripts/generate-work-package-registry.mjs",
};

const expectedVerifyCommand = [
  "npm run doctor",
  "npm run ci:check",
  "npm run automation:check",
  "npm run automation:fixture",
  "npm run lint",
  "npm run docs:check",
  "npm run architecture:check",
  "npm run work-packages:check",
  "npm run runtime-ai:check",
  "npm run eval:replay",
  "npm run security:check",
  "npm run licenses:check",
  "npm run skills:check",
  "npm test",
  "npm run typecheck",
  "npm run pack:smoke",
].join(" && ");

export function validateFoundationVerificationScripts(manifest) {
  const errors = [];
  for (const [name, expected] of Object.entries(expectedFoundationScripts)) {
    if (manifest.scripts?.[name] !== expected) {
      errors.push(`package.json: scripts.${name} must be ${expected}`);
    }
  }
  if (manifest.scripts?.verify !== expectedVerifyCommand) {
    errors.push("package.json: scripts.verify must run every accepted foundation gate in order");
  }
  const invokedScripts = new Set([...Object.keys(expectedFoundationScripts), "verify"]);
  const forbiddenLifecycleScripts = new Set([
    "dependencies",
    "install",
    "postinstall",
    "postpack",
    "postpublish",
    "preinstall",
    "prepack",
    "prepare",
    "prepublish",
    "prepublishOnly",
    "publish",
  ]);
  for (const name of invokedScripts) {
    forbiddenLifecycleScripts.add(`pre${name}`);
    forbiddenLifecycleScripts.add(`post${name}`);
  }
  for (const name of Object.keys(manifest.scripts ?? {})) {
    if (forbiddenLifecycleScripts.has(name)) {
      errors.push(`package.json: lifecycle script ${name} is forbidden by the credential-free foundation`);
    }
  }
  return errors;
}

export function runtimeCompatibility({ nodeVersion, npmVersion, packageManager }) {
  const errors = [];
  const nodeMajor = Number.parseInt(nodeVersion.split(".")[0] ?? "0", 10);
  if (nodeMajor !== 22) {
    errors.push(`Node 22 is required; found ${nodeVersion}`);
  }
  const expectedNpm = /^npm@(\d+\.\d+\.\d+)$/.exec(packageManager ?? "")?.[1];
  if (!expectedNpm) {
    errors.push(`packageManager must pin an exact npm version; found ${packageManager ?? "(missing)"}`);
  } else if (npmVersion !== expectedNpm) {
    errors.push(`npm ${expectedNpm} is required; found ${npmVersion}`);
  }
  return errors;
}

export function runDoctor() {
  const errors = [];
  for (const relativePath of requiredPaths) {
    if (!fs.existsSync(fromRoot(relativePath))) {
      errors.push(`missing required path ${relativePath}`);
    }
  }

  let npmVersion = "unavailable";
  let branch = "unavailable";
  try {
    const npmCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
    npmVersion = fs.existsSync(npmCli)
      ? execFileSync(process.execPath, [npmCli, "--version"], { encoding: "utf8" }).trim()
      : execFileSync("npm", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    errors.push("npm is not available on PATH");
  }
  try {
    branch = execFileSync("git", ["branch", "--show-current"], {
      cwd: fromRoot(),
      encoding: "utf8",
    }).trim() || "detached";
  } catch {
    errors.push("Git repository state is unavailable");
  }

  const manifest = fs.existsSync(fromRoot("package.json")) ? readJson("package.json") : {};
  const packageManager = manifest.packageManager;
  errors.push(...runtimeCompatibility({
    nodeVersion: process.versions.node,
    npmVersion,
    packageManager,
  }));
  errors.push(...validateFoundationVerificationScripts(manifest));

  console.log(`Node: ${process.versions.node}`);
  console.log(`npm: ${npmVersion}`);
  console.log(`branch: ${branch}`);
  console.log("Live provider credentials: not required");
  return errors;
}

if (isEntrypoint(import.meta.url)) {
  reportErrors("Foundation doctor", runDoctor());
}
