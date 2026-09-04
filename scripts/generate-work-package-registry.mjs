#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  fromRoot,
  isEntrypoint,
  parseFrontMatter,
  readText,
  reportErrors,
  walkFiles,
} from "./lib/project.mjs";

const allowedStatuses = new Set([
  "Draft",
  "Ready",
  "In progress",
  "Blocked",
  "Done",
]);
const requiredMetadata = [
  "id",
  "title",
  "status",
  "depends_on",
  "owner",
  "base_branch",
  "accepted_plan",
  "data_classification",
  "acceptance",
  "updated",
];
const requiredPlanMetadata = ["id", "title", "status", "accepted", "owner"];
const allowedClassifications = new Set(["Public", "Public metadata only"]);
const evidenceRepositoryUrl = "https://github.com/memorex386/verified-sudoku-coach";
const evidenceRepositorySlug = "memorex386/verified-sudoku-coach";
const remoteEvidenceCache = new Map();
const requiredSections = [
  "Goal",
  "User value",
  "Non-goals",
  "Governing ADRs",
  "Allowed edit surface",
  "Affected interfaces",
  "Architecture and privacy invariants",
  "Acceptance criteria",
  "Validation",
  "Delivery evidence",
  "Known limitations and blockers",
  "Next action",
  "Checkpoints",
];
const acceptedSeedDependencies = new Map([
  ["WP-2026-001", []],
  ["WP-2026-002", ["WP-2026-001"]],
  ["WP-2026-003", ["WP-2026-002"]],
  ["WP-2026-004", ["WP-2026-003"]],
  ["WP-2026-005", ["WP-2026-004"]],
  ["WP-2026-006", ["WP-2026-005"]],
  ["WP-2026-007", ["WP-2026-006"]],
  ["WP-2026-008", ["WP-2026-007"]],
  ["WP-2026-009", ["WP-2026-008"]],
  ["WP-2026-010", ["WP-2026-009"]],
]);

function sectionBody(body, heading) {
  const match = body.match(new RegExp(`^## ${heading}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"));
  return match?.[1]?.trim() ?? "";
}

function sectionCount(body, heading) {
  return [...body.matchAll(new RegExp(`^## ${heading}$`, "gm"))].length;
}

function listItems(content) {
  return [...content.matchAll(/^-\s+(.+)$/gm)].map((match) => match[1].trim());
}

function hasUnambiguousPassingResult(content, command) {
  const prefix = `- \`${command}\`: PASS`;
  return content.split("\n").some((line) => {
    const normalized = line.trim();
    return normalized === prefix || normalized.startsWith(`${prefix} — `);
  });
}

function hasContradictoryResult(content, command) {
  const token = `\`${command}\``;
  return content.split("\n").some((line) =>
    line.includes(token) &&
    /(?::\s*(?:FAIL(?:ED|URE)?|ERROR|CANCEL(?:LED|ED)?)\b|\b(?:did not pass|never passed)\b)/i.test(line));
}

function fencedCommandLines(content) {
  const commands = [];
  for (const match of content.matchAll(/```(?:powershell|bash|sh|shell)?\n([\s\S]*?)```/g)) {
    for (const line of (match[1] ?? "").split("\n")) {
      const command = line.trim();
      if (/^(?:npm|npx|node|git)\b/.test(command)) {
        commands.push(command);
      }
    }
  }
  return commands;
}

function commaList(value) {
  if (!value || value.toLowerCase() === "none") {
    return [];
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function workPackageOrder(id) {
  const match = /^WP-(\d{4})-(\d{3})$/.exec(id ?? "");
  return match ? [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10)] : null;
}

function compareWorkPackageIds(left, right) {
  const leftOrder = workPackageOrder(left);
  const rightOrder = workPackageOrder(right);
  if (!leftOrder || !rightOrder) {
    return Number.NaN;
  }
  return leftOrder[0] - rightOrder[0] || leftOrder[1] - rightOrder[1];
}

function acceptanceCatalog(content) {
  const errors = [];
  const owners = new Map();
  const headings = [...content.matchAll(/^## (VSC-[A-Z]+-\d{3})\b.*$/gm)];
  for (const [index, heading] of headings.entries()) {
    const id = heading[1];
    if (owners.has(id)) {
      errors.push(`acceptance catalog: duplicate gate ${id}`);
      continue;
    }
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? content.length;
    const section = content.slice(start, end);
    const owner = /^Owner: `(WP-\d{4}-\d{3})`$/m.exec(section)?.[1];
    if (!owner) {
      errors.push(`acceptance catalog: ${id} requires one owning work package`);
    }
    owners.set(id, owner);
  }
  return { errors, owners };
}

function commitExists(revision, repositoryRoot = fromRoot()) {
  try {
    execFileSync("git", ["cat-file", "-e", `${revision}^{commit}`], {
      cwd: repositoryRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function commitIsIntegrated(revision, repositoryRoot = fromRoot()) {
  const candidateRefs = [
    process.env.WORK_PACKAGE_BASE_REF,
    "origin/main",
    "main",
  ].filter((value, index, values) => value && !/^0{40}$/.test(value) && values.indexOf(value) === index);
  return candidateRefs.some((reference) => {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", revision, reference], {
        cwd: repositoryRoot,
        stdio: "ignore",
      });
      return true;
    } catch {
      return false;
    }
  });
}

function commitTouchesWorkPackage(revision, workPackageId, repositoryRoot = fromRoot()) {
  try {
    const output = execFileSync(
      "git",
      ["show", "--pretty=format:", "--name-only", revision],
      { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return output.split(/\r?\n/).some((file) =>
      new RegExp(`^docs/work-packages/${workPackageId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-[^/]+\\.md$`).test(file));
  } catch {
    return false;
  }
}

function parseReviewEvidence(evidence) {
  const escapedRepositoryUrl = evidenceRepositoryUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = evidence.match(new RegExp(
    `\\]\\(${escapedRepositoryUrl}/(?:(pull)/([1-9]\\d*)|(releases)/tag/([^\\s)]+))\\)`,
  ));
  if (!match) {
    return null;
  }
  return match[1] === "pull"
    ? { kind: "pull", value: match[2] }
    : { kind: "release", value: decodeURIComponent(match[4]) };
}

export function verifyRemoteReviewEvidence(review, revisions, workPackageId) {
  const cacheKey = JSON.stringify([review, [...revisions].sort(), workPackageId]);
  if (!remoteEvidenceCache.has(cacheKey)) {
    remoteEvidenceCache.set(
      cacheKey,
      verifyRemoteReviewEvidenceWith(review, revisions, workPackageId),
    );
  }
  return remoteEvidenceCache.get(cacheKey);
}

async function fetchGitHubJson(apiPath) {
  try {
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "verified-sudoku-coach-work-package-verifier",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const response = await fetch(`https://api.github.com${apiPath}`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return null;
    }
    const contentLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
    if (contentLength > 1_000_000) {
      return null;
    }
    if (!response.body) {
      return null;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > 1_000_000) {
        await reader.cancel();
        return null;
      }
      chunks.push(Buffer.from(value));
    }
    const content = Buffer.concat(chunks, total).toString("utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function listRemoteReviewShas(review) {
  if (!review) {
    return null;
  }
  const refs = review.kind === "pull"
    ? [`refs/pull/${review.value}/head`]
    : [`refs/tags/${review.value}`, `refs/tags/${review.value}^{}`];
  let remoteShas;
  try {
    const output = execFileSync(
      "git",
      ["ls-remote", `${evidenceRepositoryUrl}.git`, ...refs],
      {
        cwd: fromRoot(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 10_000,
      },
    );
    remoteShas = new Set(
      output.split(/\r?\n/).map((line) => line.split(/\s+/)[0]).filter(Boolean),
    );
  } catch {
    return null;
  }
  return remoteShas;
}

export async function verifyRemoteReviewEvidenceWith(
  review,
  revisions,
  workPackageId,
  {
    repositoryRoot = fromRoot(),
    getGitHubJson = fetchGitHubJson,
    getRemoteShas = listRemoteReviewShas,
  } = {},
) {
  if (!review) {
    return false;
  }
  const remoteShas = getRemoteShas(review);
  if (!remoteShas || remoteShas.size === 0) {
    return false;
  }

  if (review.kind === "pull") {
    const pull = await getGitHubJson(`/repos/${evidenceRepositorySlug}/pulls/${review.value}`);
    if (!pull || pull.state !== "closed" || pull.merged !== true || pull.draft === true ||
        pull.base?.ref !== "main" || typeof pull.head?.sha !== "string" ||
        !remoteShas.has(pull.head.sha) || typeof pull.merged_at !== "string") {
      return false;
    }
  } else {
    const release = await getGitHubJson(
      `/repos/${evidenceRepositorySlug}/releases/tags/${encodeURIComponent(review.value)}`,
    );
    if (!release || release.draft === true || release.tag_name !== review.value ||
        typeof release.published_at !== "string") {
      return false;
    }
  }

  return revisions.some((revision) =>
    remoteShas.has(revision) &&
    commitExists(revision, repositoryRoot) &&
    commitIsIntegrated(revision, repositoryRoot) &&
    commitTouchesWorkPackage(revision, workPackageId, repositoryRoot));
}

function baseWorkPackages(baseRef, errors) {
  let files;
  try {
    const output = execFileSync(
      "git",
      ["ls-tree", "-r", "--name-only", baseRef, "docs/work-packages"],
      { cwd: fromRoot(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    files = output.split(/\r?\n/).filter((file) =>
      /docs\/work-packages\/WP-\d{4}-\d{3}-[^/]+\.md$/.test(file));
  } catch {
    errors.push(`work-package base ref does not resolve: ${baseRef}`);
    return [];
  }

  const result = [];
  for (const file of files) {
    try {
      const content = execFileSync("git", ["show", `${baseRef}:${file}`], {
        cwd: fromRoot(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const { metadata, body } = parseFrontMatter(content, `${baseRef}:${file}`);
      result.push({
        file,
        id: metadata.id,
        status: metadata.status,
        checkpointContent: sectionBody(body, "Checkpoints"),
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return result;
}

export function validateCheckpointHistory(packages, basePackages) {
  const errors = [];
  const currentById = new Map(packages.map((item) => [item.id, item]));
  const allowedTransitions = new Map([
    ["Draft", new Set(["Draft", "Ready", "In progress"])],
    ["Ready", new Set(["Draft", "Ready", "In progress"])],
    ["In progress", new Set(["In progress", "Blocked", "Done"])],
    ["Blocked", new Set(["In progress", "Blocked", "Done"])],
    ["Done", new Set(["Done"])],
  ]);
  for (const basePackage of basePackages) {
    const item = currentById.get(basePackage.id);
    if (!item) {
      errors.push(`${basePackage.file}: work-package ID ${basePackage.id} was removed`);
      continue;
    }
    if (!allowedTransitions.get(basePackage.status)?.has(item.status)) {
      errors.push(
        `${item.file}: invalid work-package status transition ${basePackage.status} -> ${item.status}`,
      );
    }
    if (["In progress", "Blocked", "Done"].includes(basePackage.status)) {
      const baseCheckpoints = basePackage.checkpointContent ?? "";
      const currentCheckpoints = item.checkpointContent ?? "";
      if (currentCheckpoints !== baseCheckpoints &&
          !currentCheckpoints.startsWith(`${baseCheckpoints}\n- `)) {
        errors.push(`${item.file}: checkpoints must preserve the exact base history and append only`);
      }
    }
  }
  return errors;
}

export function loadAcceptedPlans() {
  return walkFiles("docs/product/plans", { extension: ".md" })
    .filter((file) => /\/VSC-PLAN-\d{4}-\d{2}-\d{2}\.\d+\.md$/.test(file))
    .map((file) => {
      const { metadata, body } = parseFrontMatter(readText(file), file);
      return { file, metadata, body };
    })
    .sort((left, right) => (left.metadata.id ?? "").localeCompare(right.metadata.id ?? ""));
}

export function validateAcceptedPlans(plans) {
  const errors = [];
  const ids = new Set();
  for (const plan of plans) {
    for (const field of requiredPlanMetadata) {
      if (!plan.metadata[field]) {
        errors.push(`${plan.file}: missing accepted-plan front matter ${field}`);
      }
    }
    for (const field of Object.keys(plan.metadata)) {
      if (!requiredPlanMetadata.includes(field)) {
        errors.push(`${plan.file}: unknown accepted-plan front matter field ${field}`);
      }
    }
    const id = plan.metadata.id ?? "";
    if (!/^VSC-PLAN-\d{4}-\d{2}-\d{2}\.\d+$/.test(id)) {
      errors.push(`${plan.file}: invalid accepted-plan id ${id || "(missing)"}`);
    } else if (ids.has(id)) {
      errors.push(`${plan.file}: duplicate accepted-plan id ${id}`);
    } else {
      ids.add(id);
      if (path.basename(plan.file) !== `${id}.md`) {
        errors.push(`${plan.file}: filename must match accepted-plan id ${id}`);
      }
    }
    if (plan.metadata.status !== "Accepted") {
      errors.push(`${plan.file}: accepted-plan status must be Accepted`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.metadata.accepted ?? "")) {
      errors.push(`${plan.file}: accepted date must be ISO-8601`);
    }
    if (!plan.body.match(/^#\s+\S/m)) {
      errors.push(`${plan.file}: accepted plan requires a top-level title`);
    }
  }
  if (plans.length === 0) {
    errors.push("docs/product/plans: at least one accepted plan record is required");
  }
  return errors;
}

export function loadWorkPackages() {
  return walkFiles("docs/work-packages", { extension: ".md" })
    .filter((file) => /\/WP-\d{4}-\d{3}-[^/]+\.md$/.test(file))
    .map((file) => {
      const { metadata, body } = parseFrontMatter(readText(file), file);
      return {
        file,
        body,
        metadata,
        id: metadata.id,
        title: metadata.title,
        status: metadata.status,
        dependsOn: commaList(metadata.depends_on),
        owner: metadata.owner,
        baseBranch: metadata.base_branch,
        acceptedPlan: metadata.accepted_plan,
        dataClassification: metadata.data_classification,
        acceptance: commaList(metadata.acceptance),
        updated: metadata.updated,
        nextAction: listItems(sectionBody(body, "Next action"))[0] ?? "",
        checkpoints: listItems(sectionBody(body, "Checkpoints")),
        checkpointContent: sectionBody(body, "Checkpoints"),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function validateWorkPackages(
  packages,
  acceptanceContent,
  acceptedPlans = loadAcceptedPlans(),
  reviewEvidenceVerifier = verifyRemoteReviewEvidence,
) {
  const errors = [...validateAcceptedPlans(acceptedPlans)];
  const requiredSeedIds = Array.from(
    { length: 10 },
    (_, index) => `WP-2026-${String(index + 1).padStart(3, "0")}`,
  );
  const ids = new Set(packages.map((item) => item.id));
  const catalog = acceptanceCatalog(acceptanceContent);
  errors.push(...catalog.errors);
  const acceptanceIds = new Set(catalog.owners.keys());
  const acceptedPlanIds = new Set(acceptedPlans.map((plan) => plan.metadata.id));

  if (ids.size !== packages.length) {
    errors.push("work-package registry contains duplicate IDs");
  }
  for (const requiredId of requiredSeedIds) {
    if (!ids.has(requiredId)) {
      errors.push(`missing accepted-plan seed work package ${requiredId}`);
    }
  }

  const graph = new Map();
  for (const item of packages) {
    for (const field of requiredMetadata) {
      if (!item.metadata[field]) {
        errors.push(`${item.file}: missing front matter ${field}`);
      }
    }
    for (const field of Object.keys(item.metadata)) {
      if (!requiredMetadata.includes(field)) {
        errors.push(`${item.file}: unknown front matter field ${field}`);
      }
    }
    if (!item.file.includes(`${item.id}-`)) {
      errors.push(`${item.file}: filename does not match ${item.id}`);
    }
    if (!workPackageOrder(item.id)) {
      errors.push(`${item.file}: invalid work-package id ${item.id ?? "(missing)"}`);
    }
    if (!allowedStatuses.has(item.status)) {
      errors.push(`${item.file}: invalid status ${item.status}`);
    }
    if (!allowedClassifications.has(item.dataClassification)) {
      errors.push(`${item.file}: invalid data classification ${item.dataClassification}`);
    }
    if (item.baseBranch !== "main") {
      errors.push(`${item.file}: base_branch must be main`);
    }
    if (!/^VSC-PLAN-\d{4}-\d{2}-\d{2}\.\d+$/.test(item.acceptedPlan ?? "")) {
      errors.push(`${item.file}: accepted_plan must be a versioned VSC plan`);
    } else if (!acceptedPlanIds.has(item.acceptedPlan)) {
      errors.push(`${item.file}: accepted_plan does not resolve to an Accepted plan record: ${item.acceptedPlan}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.updated)) {
      errors.push(`${item.file}: updated must be an ISO date`);
    }
    if (item.acceptance.length === 0) {
      errors.push(`${item.file}: at least one acceptance gate is required`);
    }
    for (const acceptanceId of item.acceptance) {
      if (!acceptanceIds.has(acceptanceId)) {
        errors.push(`${item.file}: unknown acceptance gate ${acceptanceId}`);
      } else if (catalog.owners.get(acceptanceId) !== item.id) {
        errors.push(`${item.file}: acceptance gate ${acceptanceId} is owned by ${catalog.owners.get(acceptanceId)}`);
      }
    }
    for (const section of requiredSections) {
      const count = sectionCount(item.body, section);
      if (count === 0) {
        errors.push(`${item.file}: missing ${section} section`);
      } else if (count > 1) {
        errors.push(`${item.file}: duplicate ${section} section`);
      } else if (!sectionBody(item.body, section)) {
        errors.push(`${item.file}: empty ${section} section`);
      }
    }
    const validation = sectionBody(item.body, "Validation");
    if (fencedCommandLines(validation).length === 0) {
      errors.push(`${item.file}: Validation must contain at least one exact executable command in a code block`);
    }
    const nextActions = listItems(sectionBody(item.body, "Next action"));
    if (nextActions.length !== 1) {
      errors.push(`${item.file}: Next action must contain exactly one list item`);
    }
    if (item.status === "In progress" && item.checkpoints.length === 0) {
      errors.push(`${item.file}: In progress work requires an append-only checkpoint`);
    }
    for (const checkpoint of item.checkpoints) {
      if (!/^\d{4}-\d{2}-\d{2}\s+—\s+/.test(checkpoint)) {
        errors.push(`${item.file}: checkpoint must start with an ISO date and em dash`);
      }
    }
    if ((item.status === "Ready" || item.status === "In progress") &&
        /\b(?:TBD|TODO|PLACEHOLDER|UNRESOLVED)\b/i.test(item.body)) {
      errors.push(`${item.file}: ${item.status} work may not contain unfinished decisions or commands`);
    }
    if (item.status === "Done") {
      const evidence = sectionBody(item.body, "Delivery evidence");
      const validationCommands = [...new Set(fencedCommandLines(validation))];
      const missingResults = validationCommands.filter((command) =>
        !hasUnambiguousPassingResult(validation, command) ||
        hasContradictoryResult(validation, command));
      if (/\b(?:pending|not run|planned)\b/i.test(validation) ||
          !validationCommands.includes("npm run verify") || missingResults.length > 0) {
        const suffix = missingResults.length > 0
          ? `; missing unambiguous PASS rows for ${missingResults.join(", ")}`
          : "";
        errors.push(`${item.file}: Done work requires exact completed validation commands/results${suffix}`);
      }
      const review = parseReviewEvidence(evidence);
      const revisions = [...evidence.matchAll(/`([0-9a-f]{40})`/gi)].map((match) => match[1]);
      const verifiedReview = await reviewEvidenceVerifier(review, revisions, item.id);
      if (/\b(?:pending|none yet|planned)\b/i.test(evidence) || !verifiedReview) {
        errors.push(`${item.file}: Done work requires a linked merged ${evidenceRepositoryUrl} PR or published release whose remote head/tag is the cited full SHA, touches this work package, and is integrated into main`);
      }
    }
    if (item.status === "Blocked" && !/\bblocked\b|\bblocker\b/i.test(sectionBody(item.body, "Known limitations and blockers"))) {
      errors.push(`${item.file}: Blocked work must state its blocking condition`);
    }
    for (const dependency of item.dependsOn) {
      if (!ids.has(dependency)) {
        errors.push(`${item.file}: unknown dependency ${dependency}`);
      }
      if (compareWorkPackageIds(dependency, item.id) >= 0) {
        errors.push(`${item.file}: dependency ${dependency} must precede ${item.id}`);
      }
    }
    const acceptedDependencies = acceptedSeedDependencies.get(item.id);
    if (acceptedDependencies &&
        (item.dependsOn.length !== acceptedDependencies.length ||
          acceptedDependencies.some((dependency) => !item.dependsOn.includes(dependency)))) {
      errors.push(
        `${item.file}: accepted seed dependency must be ${acceptedDependencies.join(", ") || "none"}`,
      );
    }
    if (new Set(item.dependsOn).size !== item.dependsOn.length) {
      errors.push(`${item.file}: duplicate dependencies are not allowed`);
    }
    graph.set(item.id, item.dependsOn);
  }

  const referencedAcceptance = new Set(packages.flatMap((item) => item.acceptance));
  for (const acceptanceId of acceptanceIds) {
    if (!referencedAcceptance.has(acceptanceId)) {
      errors.push(`acceptance catalog: orphan gate ${acceptanceId}`);
    }
  }
  for (const [acceptanceId, owner] of catalog.owners) {
    if (owner && !ids.has(owner)) {
      errors.push(`acceptance catalog: ${acceptanceId} has unknown owner ${owner}`);
    }
  }

  const referencedPlans = new Set(packages.map((item) => item.acceptedPlan));
  for (const planId of acceptedPlanIds) {
    if (!referencedPlans.has(planId)) {
      errors.push(`accepted-plan registry: orphan plan ${planId}`);
    }
  }

  const active = packages.filter((item) => item.status === "In progress");
  if (active.length > 1) {
    errors.push(`only one work package may be active; found ${active.map((item) => item.id).join(", ")}`);
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) {
      return true;
    }
    if (visited.has(id)) {
      return false;
    }
    visiting.add(id);
    for (const dependency of graph.get(id) ?? []) {
      if (visit(dependency)) {
        return true;
      }
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const id of graph.keys()) {
    if (visit(id)) {
      errors.push(`work package dependency graph contains a cycle at ${id}`);
      break;
    }
  }

  for (const item of packages) {
    if (item.status === "Ready" || item.status === "In progress" || item.status === "Done") {
      for (const dependency of item.dependsOn) {
        const dependencyPackage = packages.find((candidate) => candidate.id === dependency);
        if (dependencyPackage && dependencyPackage.status !== "Done") {
          errors.push(`${item.file}: ${item.status} work requires dependency ${dependency} to be Done`);
        }
      }
    }
  }

  const baseRef = process.env.WORK_PACKAGE_BASE_REF;
  if (baseRef && /^0{40}$/.test(baseRef)) {
    errors.push("WORK_PACKAGE_BASE_REF must not be an all-zero revision");
  } else if (baseRef) {
    errors.push(...validateCheckpointHistory(packages, baseWorkPackages(baseRef, errors)));
  }

  return errors;
}

export function renderRegistry(packages) {
  const rows = packages.map((item) => {
    const filename = path.basename(item.file);
    const dependencies = item.dependsOn.length > 0 ? item.dependsOn.join(", ") : "None";
    const plan = `[${item.acceptedPlan}](../product/plans/${item.acceptedPlan}.md)`;
    return `| [${item.id}](${filename}) | ${item.title} | ${item.status} | ${dependencies} | ${item.owner} | ${plan} | ${item.dataClassification} | ${item.nextAction} | ${item.updated} |`;
  });
  return [
    "# Work package registry",
    "",
    "> Generated by `npm run work-packages:generate`. Edit work-package source files, not the table.",
    "",
    "Work packages are the durable implementation handoff. Their accepted scope and acceptance gates",
    "replace chat history as project authority. `In progress` is the active state.",
    "",
    "The enforced lifecycle is `Draft -> Ready -> In progress -> Done`, with `Ready -> Draft` for",
    "refinement, `In progress -> Blocked`, and `Blocked -> In progress` or `Done` as the only side paths.",
    "A decision-complete Draft may move directly to `In progress` only when one reviewed change also",
    "records its accepted plan and first checkpoint; the same readiness and dependency gates apply.",
    "Active work cannot be demoted to a planning state, `Done` is terminal, and checkpoints become exact",
    "append-only history once implementation starts.",
    "",
    "| ID | Title | Status | Depends on | Owner | Accepted plan | Data | Next action | Updated |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "See the [agent workflow](../runbooks/agent-workflow.md) for lifecycle and handoff rules.",
    "",
  ].join("\n");
}

export async function verifyOrGenerateRegistry({ check }) {
  const errors = [];
  let packages = [];
  try {
    packages = loadWorkPackages();
    errors.push(...await validateWorkPackages(
      packages,
      readText("docs/acceptance/catalog.md"),
      loadAcceptedPlans(),
    ));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  if (errors.length > 0) {
    return errors;
  }

  const expected = renderRegistry(packages);
  const registryPath = fromRoot("docs/work-packages/README.md");
  if (check) {
    const current = fs.existsSync(registryPath) ? readText("docs/work-packages/README.md") : "";
    if (current !== expected) {
      errors.push("docs/work-packages/README.md is stale; run npm run work-packages:generate");
    }
  } else {
    fs.writeFileSync(registryPath, expected, "utf8");
    console.log("Generated docs/work-packages/README.md.");
  }
  return errors;
}

if (isEntrypoint(import.meta.url)) {
  const check = process.argv.includes("--check");
  const errors = await verifyOrGenerateRegistry({ check });
  if (check || errors.length > 0) {
    reportErrors("Work package verification", errors);
  }
}
