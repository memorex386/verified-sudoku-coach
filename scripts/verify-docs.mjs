#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  fromRoot,
  inspectRepositoryPath,
  markdownLinkTargets,
  missingRequiredIds,
  parseFrontMatter,
  readText,
  reportErrors,
  walkFiles,
  undefinedMarkdownReferences,
} from "./lib/project.mjs";

const requiredDocuments = [
  "docs/README.md",
  "docs/change-matrix.md",
  "docs/product/charter.md",
  "docs/product/plans/VSC-PLAN-2026-09-03.1.md",
  "docs/architecture/principles.md",
  "docs/architecture/system.md",
  "docs/architecture/trust-boundaries.md",
  "docs/architecture/model-profiles.md",
  "docs/architecture/proof-policy.md",
  "docs/security/threat-model.md",
  "docs/privacy.md",
  "docs/contracts/versioning.md",
  "docs/contracts/catalog.md",
  "docs/contracts/runtime-manifest.md",
  "docs/evaluation/policy.md",
  "docs/evaluation/data-card.md",
  "docs/acceptance/catalog.md",
  "docs/decisions/template.md",
  "docs/work-packages/template.md",
  "docs/provenance/ai-assisted-development.md",
  "docs/provenance/source-and-data.md",
  "docs/runbooks/agent-workflow.md",
  "docs/runbooks/build-and-test.md",
  "docs/runbooks/change-proof-technique.md",
  "docs/runbooks/change-contract.md",
  "docs/runbooks/change-runtime-ai.md",
  "docs/runbooks/run-evaluations.md",
  "docs/runbooks/release.md",
  "docs/runbooks/incident-response.md",
  "docs/runbooks/upgrade-sudoku-world.md",
  "docs/runbooks/retention-and-deletion.md",
  "docs/runbooks/agent-handoff.md",
  "docs/playbooks/eval-failure.md",
  "docs/playbooks/public-boundary-review.md",
];

const errors = [];
for (const relativePath of requiredDocuments) {
  if (!fs.existsSync(fromRoot(relativePath))) {
    errors.push(`missing required document ${relativePath}`);
  }
}

const markdownFiles = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "README.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
  ...walkFiles(".github", { extension: ".md" }),
  ...walkFiles("docs", { extension: ".md" }),
  ...walkFiles("evidence", { extension: ".md" }),
  ...walkFiles(".agents", { extension: ".md" }),
  ...walkFiles("apps", { extension: ".md" }),
  ...walkFiles("packages", { extension: ".md" }),
  ...walkFiles("tools", { extension: ".md" }),
].filter((value, index, values) => values.indexOf(value) === index);

for (const relativePath of markdownFiles) {
  const content = readText(relativePath);
  if (!content.match(/^(?:---\n[\s\S]*?\n---\n\n)?#\s+\S/m)) {
    errors.push(`${relativePath}: missing top-level title`);
  }
  if (/\b(?:TBD|TODO|PLACEHOLDER|YYYY-MM-DD)\b/.test(content)) {
    errors.push(`${relativePath}: contains an unfinished placeholder`);
  }

  for (const rawTarget of markdownLinkTargets(content)) {
    if (/^(?:https?:|mailto:|#)/i.test(rawTarget)) {
      continue;
    }
    let decoded;
    try {
      decoded = decodeURIComponent(rawTarget.split("#")[0] ?? "");
    } catch {
      errors.push(`${relativePath}: invalid encoded relative link ${rawTarget}`);
      continue;
    }
    if (!decoded) {
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
  for (const label of undefinedMarkdownReferences(content)) {
    errors.push(`${relativePath}: undefined Markdown reference [${label}]`);
  }
}

const readme = fs.existsSync(fromRoot("README.md")) ? readText("README.md") : "";
if (!readme.includes("Planned / unmeasured")) {
  errors.push("README.md: feature claims must be labeled Planned / unmeasured");
}

const adrFiles = walkFiles("docs/decisions", { extension: ".md" }).filter(
  (file) => /\/\d{4}-[^/]+\.md$/.test(file),
);
if (adrFiles.length < 6) {
  errors.push(`docs/decisions: expected at least six foundation ADRs; found ${adrFiles.length}`);
}
const adrIndex = readText("docs/decisions/README.md");
const adrIds = new Set();
const allowedAdrStatuses = new Set(["Proposed", "Accepted", "Superseded", "Rejected"]);
const foundationAdrIds = new Set(
  Array.from({ length: 6 }, (_, index) => `ADR-${String(index + 1).padStart(4, "0")}`),
);
for (const relativePath of adrFiles) {
  try {
    const { metadata } = parseFrontMatter(readText(relativePath), relativePath);
    if (!allowedAdrStatuses.has(metadata.status)) {
      errors.push(`${relativePath}: invalid ADR status ${metadata.status ?? "(missing)"}`);
    }
    if (foundationAdrIds.has(metadata.id) && metadata.status !== "Accepted") {
      errors.push(`${relativePath}: foundation ADR ${metadata.id} must remain Accepted`);
    }
    if (!/^ADR-\d{4}$/.test(metadata.id ?? "")) {
      errors.push(`${relativePath}: invalid ADR id ${metadata.id ?? "(missing)"}`);
    } else if (adrIds.has(metadata.id)) {
      errors.push(`${relativePath}: duplicate ADR id ${metadata.id}`);
    } else {
      adrIds.add(metadata.id);
      const basename = path.basename(relativePath);
      if (!adrIndex.includes(`[${metadata.id}:`) || !adrIndex.includes(`](${basename})`)) {
        errors.push(`docs/decisions/README.md: missing exact index entry for ${metadata.id}`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date ?? "")) {
      errors.push(`${relativePath}: date must be ISO-8601`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
}

for (const missingId of missingRequiredIds(adrIds, foundationAdrIds)) {
  errors.push(`docs/decisions: missing required foundation ADR ${missingId}`);
}

for (const match of adrIndex.matchAll(/\]\((\d{4}-[^)]+\.md)\)/g)) {
  if (!fs.existsSync(fromRoot("docs/decisions", match[1]))) {
    errors.push(`docs/decisions/README.md: indexed ADR does not exist ${match[1]}`);
  }
}

reportErrors("Documentation verification", errors);
