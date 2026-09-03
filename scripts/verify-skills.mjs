#!/usr/bin/env node

import path from "node:path";
import {
  fromRoot,
  inspectRepositoryPath,
  markdownLinkTargets,
  parseFrontMatter,
  readText,
  reportErrors,
  walkFiles,
} from "./lib/project.mjs";

const expectedSkills = new Set([
  "change-coach-model",
  "change-proof-technique",
  "release-coach",
  "run-coach-evals",
  "work-on-coach",
]);
const errors = [];
const skillFiles = walkFiles(".agents/skills", { extension: "SKILL.md" });
const discovered = new Set();

for (const relativePath of skillFiles) {
  try {
    const content = readText(relativePath);
    const { metadata, body } = parseFrontMatter(content, relativePath);
    const folder = path.basename(path.dirname(relativePath));
    discovered.add(folder);
    if (metadata.name !== folder) {
      errors.push(`${relativePath}: skill name must match folder ${folder}`);
    }
    if (!metadata.description || metadata.description.length > 280) {
      errors.push(`${relativePath}: description must be present and at most 280 characters`);
    }
    if (!/^[a-z0-9-]+$/.test(folder) || folder.length > 64) {
      errors.push(`${relativePath}: invalid skill folder name`);
    }
    if (content.length > 4_000) {
      errors.push(`${relativePath}: skill entrypoint exceeds 4,000 characters; move detail to a runbook`);
    }
    if (/\b(?:TBD|TODO|PLACEHOLDER)\b/.test(content)) {
      errors.push(`${relativePath}: unfinished placeholder`);
    }
    if (!body.includes("docs/runbooks/") && !body.includes("docs/playbooks/")) {
      errors.push(`${relativePath}: skill must route to a canonical runbook or playbook`);
    }
    for (const rawTarget of markdownLinkTargets(content)) {
      if (/^(?:https?:|mailto:|#)/i.test(rawTarget)) {
        continue;
      }
      const target = rawTarget.split("#")[0] ?? "";
      let decoded;
      try {
        decoded = decodeURIComponent(target);
      } catch {
        errors.push(`${relativePath}: invalid encoded relative link ${rawTarget}`);
        continue;
      }
      const status = inspectRepositoryPath(
        fromRoot(),
        path.dirname(fromRoot(relativePath)),
        decoded,
      );
      if (status.reason === "outside") {
        errors.push(`${relativePath}: relative link escapes the repository ${rawTarget}`);
      } else if (status.reason === "symlink") {
        errors.push(`${relativePath}: relative link traverses a symbolic link ${rawTarget}`);
      } else if (!status.ok) {
        errors.push(`${relativePath}: broken relative link ${rawTarget}`);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
}

for (const expected of expectedSkills) {
  if (!discovered.has(expected)) {
    errors.push(`missing canonical skill ${expected}`);
  }
}
for (const actual of discovered) {
  if (!expectedSkills.has(actual)) {
    errors.push(`unexpected canonical skill ${actual}; update verifier intentionally`);
  }
}

reportErrors("Skill verification", errors);
