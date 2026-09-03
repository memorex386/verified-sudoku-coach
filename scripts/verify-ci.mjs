#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  fromRoot,
  inspectRepositoryPath,
  isEntrypoint,
  reportErrors,
} from "./lib/project.mjs";

const requiredFoundationArtifacts = [
  ".npmrc",
  ".github/CODEOWNERS",
  ".github/dependabot.yml",
  ".github/pull_request_template.md",
  ".github/workflows/README.md",
  ".github/workflows/codeql.yml",
  ".github/workflows/dependency-review.yml",
  ".github/workflows/foundation.yml",
];

const approvedPolicyDigests = {
  ".npmrc": "b962362ebe7560b534e834c2ede51186c2e3fceb94e12cc434a11180f22391f2",
  ".github/CODEOWNERS": "ccb85342b37b2b56220c01e1e78ee59e4391fb319fbc3e3954a8d95ca5769d8e",
  ".github/dependabot.yml": "70d834d5d0f8bbd16f9f97b065e5baa61836128450837a51981f1b81df71a3d0",
  ".github/pull_request_template.md": "52ad31c0a770ca3e659853794db0cb7ad8855aac51826069241f90efc0675e63",
  ".github/workflows/README.md": "0f30df3e9a969b750b6129d3caa36b0c8467dc08ef0f0ffb9c8f20ef28cc399f",
  ".github/workflows/codeql.yml": "a76d3b03e28332fe09b73861e8dbeeff55fbe68b2599b82862ea41cb8747c2da",
  ".github/workflows/dependency-review.yml": "8926d8c05d5ddde1971420d1c42b45bc027e9f3742377fd6996c73f4f13691ad",
  ".github/workflows/foundation.yml": "f5380de8f3db7b3a11a3a976686fb57da13a370971d8caddff45299570cf4de9",
};

function policyDigest(content) {
  return crypto.createHash("sha256").update(content.replace(/\r\n/g, "\n")).digest("hex");
}

function actionReferences(content) {
  return [...content.matchAll(/^\s*(?:-\s+)?uses:\s+([^#\s]+)/gm)].map((match) => match[1]);
}

function runSteps(content) {
  return [...content.matchAll(/^\s*-\s+run:\s+(.+?)\s*$/gm)].map((match) => match[1]);
}

export function validateCiPolicy(files) {
  const errors = [];
  for (const relativePath of requiredFoundationArtifacts) {
    if (!Object.hasOwn(files, relativePath)) {
      errors.push(`missing required foundation automation artifact ${relativePath}`);
    }
  }

  for (const [relativePath, expectedDigest] of Object.entries(approvedPolicyDigests)) {
    const content = files[relativePath];
    if (typeof content === "string" && policyDigest(content) !== expectedDigest) {
      errors.push(
        `${relativePath}: policy differs from the accepted foundation automation; update the verifier and review evidence together`,
      );
    }
  }

  const workflowPaths = Object.keys(files).filter((relativePath) =>
    /^\.github\/workflows\/[^/]+\.ya?ml$/.test(relativePath));
  for (const relativePath of workflowPaths) {
    const content = files[relativePath];
    if (typeof content !== "string") {
      continue;
    }
    if (!Object.hasOwn(approvedPolicyDigests, relativePath)) {
      errors.push(`${relativePath}: unexpected workflow is forbidden by the foundation policy`);
    }
    if (/\bpull_request_target\s*:/i.test(content)) {
      errors.push(`${relativePath}: pull_request_target is forbidden`);
    }
    if (/\$\{\{\s*secrets\.|\bgithub\.token\b|\bGITHUB_TOKEN\b|\bOPENAI_(?:API_|SECRET_|PRIVATE_)?KEY\b/i.test(content)) {
      errors.push(`${relativePath}: credential wiring is forbidden in public foundation workflows`);
    }
    for (const reference of actionReferences(content)) {
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*@[0-9a-f]{40}$/.test(reference)) {
        errors.push(`${relativePath}: action must be pinned to a full commit SHA: ${reference}`);
      }
    }
  }

  const foundation = files[".github/workflows/foundation.yml"];
  if (typeof foundation === "string") {
    if (!foundation.includes("os: [ubuntu-latest, windows-latest]")) {
      errors.push(".github/workflows/foundation.yml: must run on Ubuntu and Windows");
    }
    if (!foundation.includes("fetch-depth: 0")) {
      errors.push(".github/workflows/foundation.yml: checkout must fetch complete history");
    }
    if (!foundation.includes("persist-credentials: false")) {
      errors.push(".github/workflows/foundation.yml: checkout credentials must not persist");
    }
    if (JSON.stringify(runSteps(foundation)) !==
        JSON.stringify(["npm ci --ignore-scripts", "npm run --ignore-scripts verify"])) {
      errors.push(
        ".github/workflows/foundation.yml: run steps must install and verify with lifecycle hooks disabled",
      );
    }
    for (const trigger of ["pull_request:", "push:", "workflow_dispatch:"]) {
      if (!foundation.includes(trigger)) {
        errors.push(`.github/workflows/foundation.yml: missing required trigger ${trigger}`);
      }
    }
  }

  return errors;
}

export function verifyCiPolicyAtRoot(repositoryRoot = fromRoot()) {
  const files = {};
  const loadErrors = [];
  const paths = new Set(requiredFoundationArtifacts);
  const workflowDirectory = path.join(repositoryRoot, ".github", "workflows");
  if (fs.existsSync(workflowDirectory)) {
    for (const entry of fs.readdirSync(workflowDirectory, { withFileTypes: true })) {
      if (/\.ya?ml$/i.test(entry.name)) {
        paths.add(`.github/workflows/${entry.name}`);
      }
    }
  }
  for (const relativePath of paths) {
    const status = inspectRepositoryPath(
      repositoryRoot,
      repositoryRoot,
      relativePath,
      { requireFile: true },
    );
    if (status.ok) {
      files[relativePath] = fs.readFileSync(status.realResolved, "utf8");
    } else if (fs.existsSync(path.join(repositoryRoot, relativePath))) {
      loadErrors.push(`${relativePath}: automation artifact must be a regular repository file`);
    }
  }
  return [...loadErrors, ...validateCiPolicy(files)];
}

if (isEntrypoint(import.meta.url)) {
  reportErrors("CI policy verification", verifyCiPolicyAtRoot());
}
