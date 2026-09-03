#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fromRoot, isEntrypoint, reportErrors } from "./lib/project.mjs";

const allowedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MPL-2.0",
]);
const canonicalApacheLicenseSha256 = "c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4";

function licenseChoices(expression) {
  return expression
    .replaceAll(/[()]/g, "")
    .split(/\s+(?:OR|AND)\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function readJsonAt(absolutePath) {
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function normalizedText(absolutePath) {
  return `${fs.readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n").trimEnd()}\n`;
}

function workspaceManifestPaths(repositoryRoot, rootManifest) {
  const manifests = [];
  for (const pattern of rootManifest.workspaces ?? []) {
    if (typeof pattern !== "string" || !pattern.endsWith("/*")) {
      continue;
    }
    const parent = path.join(repositoryRoot, pattern.slice(0, -2));
    if (!fs.existsSync(parent)) {
      continue;
    }
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const manifest = path.join(parent, entry.name, "package.json");
        if (fs.existsSync(manifest)) {
          manifests.push(manifest);
        }
      }
    }
  }
  return manifests.sort();
}

function validateRepositoryLicenses(repositoryRoot, errors) {
  const rootManifestPath = path.join(repositoryRoot, "package.json");
  const rootManifest = readJsonAt(rootManifestPath);
  if (rootManifest.license !== "Apache-2.0") {
    errors.push("package.json: repository license must be Apache-2.0");
  }
  for (const manifestPath of workspaceManifestPaths(repositoryRoot, rootManifest)) {
    const manifest = readJsonAt(manifestPath);
    if (manifest.license !== "Apache-2.0") {
      const relativePath = path.relative(repositoryRoot, manifestPath).replaceAll("\\", "/");
      errors.push(`${relativePath}: workspace license must be Apache-2.0`);
    }
  }

  const licensePath = path.join(repositoryRoot, "LICENSE");
  if (!fs.existsSync(licensePath)) {
    errors.push("LICENSE: canonical Apache-2.0 text is missing");
    return;
  }
  const digest = crypto.createHash("sha256").update(normalizedText(licensePath)).digest("hex");
  if (digest !== canonicalApacheLicenseSha256) {
    errors.push("LICENSE: content must match canonical Apache-2.0 text");
  }
}

export function verifyLicensesAtRoot(repositoryRoot = fromRoot()) {
  const errors = [];
  validateRepositoryLicenses(repositoryRoot, errors);
  const lockfile = readJsonAt(path.join(repositoryRoot, "package-lock.json"));
  for (const [packagePath, record] of Object.entries(lockfile.packages ?? {})) {
    const normalizedPackagePath = packagePath.replaceAll("\\", "/");
    if (record.link === true || !normalizedPackagePath.split("/").includes("node_modules")) {
      continue;
    }
    const absoluteManifest = path.resolve(repositoryRoot, packagePath, "package.json");
    if (absoluteManifest !== path.join(repositoryRoot, "package.json") &&
        !absoluteManifest.startsWith(`${path.resolve(repositoryRoot)}${path.sep}`)) {
      errors.push(`${packagePath}: package path escapes the repository`);
      continue;
    }
    if (!fs.existsSync(absoluteManifest)) {
      if (record.optional === true) {
        continue;
      }
      errors.push(`${packagePath || "."}: installed manifest missing; run npm ci`);
      continue;
    }
    const manifest = readJsonAt(absoluteManifest);
    const license = typeof manifest.license === "string" ? manifest.license : "";
    const choices = licenseChoices(license);
    if (choices.length === 0 || !choices.every((choice) => allowedLicenses.has(choice))) {
      errors.push(`${manifest.name ?? packagePath}@${manifest.version ?? "unknown"}: unreviewed license ${license || "(missing)"}`);
    }
  }
  return errors;
}

if (isEntrypoint(import.meta.url)) {
  reportErrors("Dependency license verification", verifyLicensesAtRoot());
}
