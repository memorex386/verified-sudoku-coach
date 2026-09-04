#!/usr/bin/env node

import fs from "node:fs";
import { fromRoot, inspectRepositoryPath, isEntrypoint, reportErrors } from "./lib/project.mjs";
import { validateAutomationPolicy } from "./lib/automation-policy.mjs";

export function verifyAutomationPolicyAtRoot(repositoryRoot = fromRoot()) {
  const relativePath = "config/automation-policy.json";
  const status = inspectRepositoryPath(
    repositoryRoot,
    repositoryRoot,
    relativePath,
    { requireFile: true },
  );
  if (!status.ok) {
    return [`${relativePath}: policy must be a regular repository file`];
  }

  try {
    const policy = JSON.parse(fs.readFileSync(status.realResolved, "utf8"));
    return validateAutomationPolicy(policy);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${relativePath}: invalid JSON: ${message}`];
  }
}

if (isEntrypoint(import.meta.url)) {
  reportErrors("Automation policy verification", verifyAutomationPolicyAtRoot());
}
