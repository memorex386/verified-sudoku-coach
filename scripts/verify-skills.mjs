#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  fromRoot,
  inspectRepositoryPath,
  isEntrypoint,
  markdownLinkTargets,
  parseFrontMatter,
  reportErrors,
} from "./lib/project.mjs";

export const canonicalSkillNames = Object.freeze([
  "change-coach-model",
  "change-proof-technique",
  "release-coach",
  "run-coach-evals",
  "work-on-coach",
]);

export function claudeAdapterBody(skillName) {
  return `\nRead [the canonical skill](../../../.agents/skills/${skillName}/SKILL.md) completely and follow it.\n`;
}

function repositoryReader(repositoryRoot) {
  const root = path.resolve(repositoryRoot);
  const resolve = (...segments) => path.join(root, ...segments);
  const readText = (relativePath) => fs.readFileSync(resolve(relativePath), "utf8")
    .replace(/\r\n/g, "\n");
  const walkFiles = (relativeDirectory) => {
    const start = resolve(relativeDirectory);
    if (!fs.existsSync(start)) {
      return [];
    }
    const result = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(absolutePath);
        } else {
          result.push(path.relative(root, absolutePath).replaceAll("\\", "/"));
        }
      }
    };
    visit(start);
    return result.sort();
  };
  return { readText, resolve, root, walkFiles };
}

function validateRepositoryFile(project, relativePath, errors) {
  const status = inspectRepositoryPath(
    project.root,
    project.root,
    relativePath,
    { requireFile: true },
  );
  if (!status.ok) {
    errors.push(`${relativePath}: must be a regular repository file (${status.reason})`);
    return false;
  }
  return true;
}

function validateRelativeLinks(project, relativePath, content, errors) {
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
      project.root,
      path.dirname(project.resolve(relativePath)),
      decoded,
      { requireFile: true },
    );
    if (status.reason === "outside") {
      errors.push(`${relativePath}: relative link escapes the repository ${rawTarget}`);
    } else if (status.reason === "symlink") {
      errors.push(`${relativePath}: relative link traverses a symbolic link ${rawTarget}`);
    } else if (!status.ok) {
      errors.push(`${relativePath}: broken relative link ${rawTarget}`);
    }
  }
}

function validateCanonicalSkills(project, errors) {
  const metadataByName = new Map();
  const skillFiles = project.walkFiles(".agents/skills")
    .filter((relativePath) => path.basename(relativePath) === "SKILL.md");
  const discovered = new Set();

  for (const relativePath of skillFiles) {
    if (!validateRepositoryFile(project, relativePath, errors)) {
      continue;
    }
    try {
      const content = project.readText(relativePath);
      const { metadata, body } = parseFrontMatter(content, relativePath);
      const folder = path.basename(path.dirname(relativePath));
      discovered.add(folder);
      metadataByName.set(folder, metadata);
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
      validateRelativeLinks(project, relativePath, content, errors);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const expectedSkills = new Set(canonicalSkillNames);
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
  return metadataByName;
}

function validateClaudeInstructions(project, errors) {
  if (!validateRepositoryFile(project, "CLAUDE.md", errors)) {
    return;
  }
  const content = project.readText("CLAUDE.md");
  if (content !== "@AGENTS.md\n") {
    errors.push("CLAUDE.md: must contain only the @AGENTS.md canonical import");
  }
  validateRepositoryFile(project, "AGENTS.md", errors);
}

function validateGeminiSettings(project, errors) {
  const relativePath = ".gemini/settings.json";
  if (!validateRepositoryFile(project, relativePath, errors)) {
    return;
  }
  try {
    const settings = JSON.parse(project.readText(relativePath));
    const rootKeys = settings && typeof settings === "object" && !Array.isArray(settings)
      ? Object.keys(settings).sort()
      : [];
    const context = settings?.context;
    const contextKeys = context && typeof context === "object" && !Array.isArray(context)
      ? Object.keys(context).sort()
      : [];
    if (rootKeys.length !== 1 || rootKeys[0] !== "context" ||
        contextKeys.length !== 1 || contextKeys[0] !== "fileName" ||
        context.fileName !== "AGENTS.md") {
      errors.push(
        `${relativePath}: must contain only context.fileName set to AGENTS.md`,
      );
    }
  } catch (error) {
    errors.push(`${relativePath}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
}

function validateClaudeSkillAdapters(project, canonicalMetadata, errors) {
  const actualFiles = new Set(project.walkFiles(".claude/skills"));
  const expectedFiles = new Set(
    canonicalSkillNames.map((name) => `.claude/skills/${name}/SKILL.md`),
  );

  for (const relativePath of expectedFiles) {
    if (!actualFiles.has(relativePath)) {
      errors.push(`missing Claude skill adapter ${relativePath}`);
    }
  }
  for (const relativePath of actualFiles) {
    if (!expectedFiles.has(relativePath)) {
      errors.push(`unexpected Claude skill adapter file ${relativePath}`);
    }
  }

  for (const skillName of canonicalSkillNames) {
    const relativePath = `.claude/skills/${skillName}/SKILL.md`;
    if (!actualFiles.has(relativePath) || !validateRepositoryFile(project, relativePath, errors)) {
      continue;
    }
    try {
      const content = project.readText(relativePath);
      const { metadata, body } = parseFrontMatter(content, relativePath);
      const metadataKeys = Object.keys(metadata).sort();
      if (metadataKeys.length !== 2 || metadataKeys[0] !== "description" ||
          metadataKeys[1] !== "name") {
        errors.push(`${relativePath}: adapter front matter may contain only name and description`);
      }
      if (metadata.name !== skillName) {
        errors.push(`${relativePath}: adapter name must match ${skillName}`);
      }
      const canonicalDescription = canonicalMetadata.get(skillName)?.description;
      if (!canonicalDescription || metadata.description !== canonicalDescription) {
        errors.push(`${relativePath}: adapter description must match the canonical skill`);
      }
      if (body !== claudeAdapterBody(skillName)) {
        errors.push(`${relativePath}: adapter body must be the exact canonical pointer`);
      }
      validateRelativeLinks(project, relativePath, content, errors);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
}

function validateLocalInstructionIgnore(project, errors) {
  if (!validateRepositoryFile(project, ".gitignore", errors)) {
    return;
  }
  const rules = new Set(project.readText(".gitignore").split("\n").map((line) => line.trim()));
  if (!rules.has("CLAUDE.local.md")) {
    errors.push(".gitignore: must ignore CLAUDE.local.md private per-worktree instructions");
  }
}

export function verifySkillsAtRoot(repositoryRoot = fromRoot()) {
  const project = repositoryReader(repositoryRoot);
  const errors = [];
  const canonicalMetadata = validateCanonicalSkills(project, errors);
  validateClaudeInstructions(project, errors);
  validateGeminiSettings(project, errors);
  validateClaudeSkillAdapters(project, canonicalMetadata, errors);
  validateLocalInstructionIgnore(project, errors);
  return errors;
}

if (isEntrypoint(import.meta.url)) {
  reportErrors("Skill verification", verifySkillsAtRoot());
}
