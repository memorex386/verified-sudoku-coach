#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fromRoot, isEntrypoint, reportErrors } from "./lib/project.mjs";

const secretPatterns = [
  ["private key material", new RegExp([
    "-----BEGIN ",
    "(?:(?:ENCRYPTED|RSA|EC|DSA|OPENSSH|PGP) )?PRIVATE KEY(?: BLOCK)?-----",
  ].join(""))],
  ["OpenAI-style secret", new RegExp(["s", "k-", "[A-Za-z0-9_-]{20,}"].join(""))],
  ["GitHub token", new RegExp(["gh", "[pousr]_[A-Za-z0-9]{20,}"].join(""))],
  ["fine-grained GitHub token", new RegExp(["github", "_pat_[A-Za-z0-9_]{20,}"].join(""))],
  ["Google API key", new RegExp(["AI", "za[0-9A-Za-z_-]{30,}"].join(""))],
  ["AWS access key", new RegExp(["AK", "IA[0-9A-Z]{16}"].join(""))],
  ["local home path", /(?:[A-Z]:[\\/]Users[\\/]|\/Users\/|\/home\/)[^\s/\\]+/i],
];

const forbiddenPathPatterns = [
  ["environment file", /(?:^|\/)\.env(?:[./]|$)/i],
  ["private key file", /\.(?:jks|keystore|p12|pfx|pem|key)$/i],
  ["Firebase client configuration", /(?:google-services\.json|GoogleService-Info\.plist)$/i],
  ["raw trace directory", /(?:^|\/)(?:raw-traces|production-traces|transcripts|user-exports|artifacts\/live-evals)(?:\/|$)/i],
];

export function classifyText(content) {
  return secretPatterns.filter(([, pattern]) => pattern.test(content)).map(([label]) => label);
}

export function classifyPublicFile(
  relativePath,
  content,
  size = Buffer.byteLength(content, "utf8"),
  scanContent = true,
) {
  const errors = [];
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const allowedEnvironmentExample = normalizedPath === ".env.example";
  for (const label of classifyText(normalizedPath)) {
    errors.push(`repository path: possible ${label}`);
  }
  for (const [label, pattern] of forbiddenPathPatterns) {
    if (allowedEnvironmentExample && label === "environment file") {
      continue;
    }
    if (pattern.test(normalizedPath)) {
      errors.push(`${relativePath}: forbidden ${label}`);
    }
  }

  if (size > 1_000_000) {
    errors.push(`${relativePath}: file exceeds the 1 MB automatic scan limit and needs explicit provenance review`);
    return errors;
  }
  if (scanContent) {
    for (const label of classifyText(content)) {
      errors.push(`${relativePath}: possible ${label}`);
    }
  }
  return errors;
}

function projectFiles(repositoryRoot = fromRoot()) {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  return output.split(/\r?\n/).filter(Boolean).sort();
}

function decodeUtf8(bytes) {
  if (bytes.includes(0)) {
    return null;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function addBlobFindings(errors, relativePath, bytes, size, origin = "") {
  const content = size <= 1_000_000 ? decodeUtf8(bytes) : null;
  for (const finding of classifyPublicFile(relativePath, content ?? "", size, content !== null)) {
    if (!origin) {
      errors.push(finding);
    } else if (finding.startsWith("repository path:")) {
      errors.push(finding.replace("repository path:", `repository path [${origin}]:`));
    } else {
      errors.push(finding.replace(`${relativePath}:`, `${relativePath} [${origin}]:`));
    }
  }
  if (size <= 1_000_000 && content === null) {
    errors.push(`${relativePath}${origin ? ` [${origin}]` : ""}: binary or non-UTF-8 content needs explicit provenance review`);
  }
}

export function scanGitIndex(repositoryRoot = fromRoot()) {
  const errors = [];
  let entries;
  try {
    const output = execFileSync("git", ["ls-files", "--stage", "-z"], {
      cwd: repositoryRoot,
      encoding: "buffer",
    });
    entries = nulSeparatedBuffers(output);
  } catch (error) {
    return [`unable to scan Git index: ${error instanceof Error ? error.message : String(error)}`];
  }
  for (const entry of entries) {
    const tab = entry.indexOf(9);
    const header = tab < 0 ? "" : entry.subarray(0, tab).toString("ascii");
    const match = /^(\d+) ([0-9a-f]{40,64}) ([0-3])$/.exec(header);
    if (!match) {
      errors.push("Git index: malformed entry needs explicit provenance review");
      continue;
    }
    const [, mode, objectId, stage] = match;
    const pathBytes = entry.subarray(tab + 1);
    const relativePath = decodeUtf8(pathBytes);
    if (relativePath === null) {
      errors.push("Git index: non-UTF-8 path needs explicit provenance review");
      continue;
    }
    if (stage !== "0") {
      errors.push(`${relativePath} [index]: unmerged entry is forbidden`);
    }
    if (mode === "160000") {
      errors.push(`${relativePath} [index]: gitlinks/submodules are forbidden`);
      continue;
    }
    if (mode === "120000") {
      errors.push(`${relativePath} [index]: symbolic links are forbidden`);
    } else if (!["100644", "100755"].includes(mode)) {
      errors.push(`${relativePath} [index]: unsupported Git mode ${mode}`);
      continue;
    }
    try {
      const size = Number.parseInt(execFileSync("git", ["cat-file", "-s", objectId], {
        cwd: repositoryRoot,
        encoding: "utf8",
      }).trim(), 10);
      const bytes = size <= 1_000_000
        ? execFileSync("git", ["cat-file", "blob", objectId], {
          cwd: repositoryRoot,
          encoding: "buffer",
          maxBuffer: 1_100_000,
        })
        : Buffer.alloc(0);
      addBlobFindings(errors, relativePath, bytes, size, "index");
    } catch (error) {
      errors.push(`${relativePath} [index]: unable to inspect staged blob: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

function scanFiles(files, errors, repositoryRoot = fromRoot()) {
  for (const relativePath of files) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    let status;
    try {
      status = fs.lstatSync(absolutePath);
    } catch (error) {
      errors.push(`${relativePath}: unable to inspect working-tree entry: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (status.isSymbolicLink()) {
      errors.push(`${relativePath}: symbolic links are forbidden`);
      continue;
    }
    if (!status.isFile()) {
      errors.push(`${relativePath}: non-regular files are forbidden`);
      continue;
    }
    const size = status.size;
    const bytes = size <= 1_000_000 ? fs.readFileSync(absolutePath) : Buffer.alloc(0);
    addBlobFindings(errors, relativePath, bytes, size);
  }
}

export function scanWorkingTreePaths(files, repositoryRoot = fromRoot()) {
  const errors = [];
  scanFiles(files, errors, repositoryRoot);
  return errors;
}

export function scanGitHistory(repositoryRoot = fromRoot()) {
  return [
    ...scanReachableGitCommitObjects(repositoryRoot),
    ...scanAnnotatedGitTags(repositoryRoot),
  ];
}

export function scanReachableGitCommitObjects(repositoryRoot = fromRoot()) {
  const findings = new Set();
  let commits;
  try {
    commits = execFileSync("git", ["rev-list", "--all"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }).split(/\r?\n/).filter(Boolean);
  } catch (error) {
    return [`unable to enumerate reachable Git commits: ${error instanceof Error ? error.message : String(error)}`];
  }
  for (const commit of commits) {
    try {
      const sizeText = execFileSync("git", ["cat-file", "-s", commit], {
        cwd: repositoryRoot,
        encoding: "utf8",
      }).trim();
      const size = Number.parseInt(sizeText, 10);
      if (!/^\d+$/.test(sizeText) || !Number.isSafeInteger(size)) {
        throw new Error(`invalid object size ${JSON.stringify(sizeText)}`);
      }
      const bytes = size <= 1_000_000
        ? execFileSync("git", ["cat-file", "commit", commit], {
          cwd: repositoryRoot,
          encoding: "buffer",
          maxBuffer: 1_100_000,
        })
        : Buffer.alloc(0);
      const objectFindings = [];
      addBlobFindings(objectFindings, `Git commit object ${commit}`, bytes, size, "commit");
      for (const finding of objectFindings) {
        findings.add(finding);
      }
    } catch (error) {
      findings.add(`Git commit object ${commit}: unable to inspect: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return [...findings].sort();
}

function nulSeparatedBuffers(bytes) {
  const entries = [];
  let start = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 0) {
      entries.push(bytes.subarray(start, index));
      start = index + 1;
    }
  }
  if (start < bytes.length) {
    entries.push(bytes.subarray(start));
  }
  return entries.filter((entry) => entry.length > 0);
}

function newlineSeparatedBuffers(bytes) {
  const entries = [];
  let start = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 10) {
      const end = index > start && bytes[index - 1] === 13 ? index - 1 : index;
      entries.push(bytes.subarray(start, end));
      start = index + 1;
    }
  }
  if (start < bytes.length) {
    entries.push(bytes.subarray(start));
  }
  return entries.filter((entry) => entry.length > 0);
}

export function scanAnnotatedGitTags(repositoryRoot = fromRoot()) {
  const findings = new Set();
  let references;
  try {
    references = execFileSync(
      "git",
      ["for-each-ref", "--format=%(objectname) %(objecttype) %(refname)", "refs/tags"],
      {
        cwd: repositoryRoot,
        encoding: "buffer",
        maxBuffer: 16 * 1024 * 1024,
      },
    );
  } catch (error) {
    return [`unable to enumerate Git tags: ${error instanceof Error ? error.message : String(error)}`];
  }

  const pending = [];
  for (const entry of newlineSeparatedBuffers(references)) {
    const firstSpace = entry.indexOf(32);
    const secondSpace = firstSpace < 0 ? -1 : entry.indexOf(32, firstSpace + 1);
    if (firstSpace < 1 || secondSpace <= firstSpace + 1 || secondSpace === entry.length - 1) {
      findings.add("Git tags: malformed reference listing needs explicit provenance review");
      continue;
    }
    const objectId = entry.subarray(0, firstSpace).toString("ascii");
    const objectType = entry.subarray(firstSpace + 1, secondSpace).toString("ascii");
    const referenceBytes = entry.subarray(secondSpace + 1);
    const decodedReference = decodeUtf8(referenceBytes);
    const referenceName = decodedReference ?? `<non-UTF-8-tag-ref-${objectId}>`;
    if (decodedReference === null) {
      findings.add("Git tag reference: non-UTF-8 name needs explicit provenance review");
    } else {
      for (const label of classifyText(decodedReference)) {
        findings.add(`Git tag reference: possible ${label}`);
      }
    }
    if (!/^[0-9a-f]{40,64}$/.test(objectId) || !/^[a-z]+$/.test(objectType)) {
      findings.add(`${referenceName}: malformed tag target needs explicit provenance review`);
      continue;
    }
    if (objectType === "tag") {
      pending.push({ objectId, referenceName });
    } else if (objectType !== "commit") {
      findings.add(`${referenceName}: tag must resolve to a commit; found ${objectType}`);
    }
  }

  const visited = new Set();
  while (pending.length > 0) {
    const { objectId, referenceName } = pending.pop();
    if (visited.has(objectId)) {
      continue;
    }
    visited.add(objectId);

    let size;
    let bytes;
    try {
      const sizeText = execFileSync("git", ["cat-file", "-s", objectId], {
        cwd: repositoryRoot,
        encoding: "utf8",
      }).trim();
      size = Number.parseInt(sizeText, 10);
      if (!/^\d+$/.test(sizeText) || !Number.isSafeInteger(size)) {
        throw new Error(`invalid object size ${JSON.stringify(sizeText)}`);
      }
      bytes = size <= 1_000_000
        ? execFileSync("git", ["cat-file", "tag", objectId], {
          cwd: repositoryRoot,
          encoding: "buffer",
          maxBuffer: 1_100_000,
        })
        : Buffer.alloc(0);
    } catch (error) {
      findings.add(`${referenceName} [annotated tag]: unable to inspect object: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const objectFindings = [];
    addBlobFindings(objectFindings, referenceName, bytes, size, "annotated tag");
    for (const finding of objectFindings) {
      findings.add(finding);
    }

    const content = size <= 1_000_000 ? decodeUtf8(bytes) : null;
    if (content === null) {
      continue;
    }
    const target = /^object ([0-9a-f]{40,64})\ntype ([a-z]+)\n/.exec(content);
    if (!target) {
      findings.add(`${referenceName} [annotated tag]: malformed object header needs explicit provenance review`);
      continue;
    }
    let actualTargetType;
    try {
      actualTargetType = execFileSync("git", ["cat-file", "-t", target[1]], {
        cwd: repositoryRoot,
        encoding: "utf8",
      }).trim();
    } catch (error) {
      findings.add(`${referenceName} [annotated tag]: unable to inspect target: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (actualTargetType !== target[2]) {
      findings.add(
        `${referenceName} [annotated tag]: declared target type ${target[2]} does not match ${actualTargetType}`,
      );
      continue;
    }
    if (actualTargetType === "tag") {
      pending.push({
        objectId: target[1],
        referenceName: `${referenceName} -> nested tag ${target[1]}`,
      });
    } else if (actualTargetType !== "commit") {
      findings.add(
        `${referenceName} [annotated tag]: tag must resolve to a commit; found ${actualTargetType}`,
      );
    }
  }
  return [...findings].sort();
}

export function scanReachableGitBlobs(repositoryRoot = fromRoot()) {
  const findings = new Set();
  let commits;
  try {
    commits = execFileSync("git", ["rev-list", "--all"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    }).split(/\r?\n/).filter(Boolean);
  } catch (error) {
    return [`unable to enumerate reachable Git commits: ${error instanceof Error ? error.message : String(error)}`];
  }

  const visited = new Set();
  const blobCache = new Map();
  for (const commit of commits) {
    let tree;
    try {
      tree = execFileSync("git", ["ls-tree", "-r", "-z", "--full-tree", commit], {
        cwd: repositoryRoot,
        encoding: "buffer",
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (error) {
      findings.add(`Git history: unable to enumerate tree ${commit}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    for (const entry of nulSeparatedBuffers(tree)) {
      const tab = entry.indexOf(9);
      if (tab < 0) {
        findings.add(`Git history: malformed tree entry in ${commit}`);
        continue;
      }
      const header = entry.subarray(0, tab).toString("ascii");
      const match = /^(\d+) (blob|commit) ([0-9a-f]+)$/.exec(header);
      if (!match) {
        continue;
      }
      const [, mode, objectType, objectId] = match;
      let relativePath;
      try {
        relativePath = new TextDecoder("utf-8", { fatal: true }).decode(entry.subarray(tab + 1));
      } catch {
        findings.add(`Git history: non-UTF-8 path in ${commit} needs explicit provenance review`);
        relativePath = `<non-UTF-8-path-${objectId}>`;
      }
      if (mode === "160000" || objectType === "commit") {
        findings.add(`${relativePath} [history]: gitlinks/submodules are forbidden`);
        continue;
      }
      if (mode === "120000") {
        findings.add(`${relativePath} [history]: symbolic links are forbidden`);
      } else if (!["100644", "100755"].includes(mode)) {
        findings.add(`${relativePath} [history]: unsupported Git mode ${mode}`);
        continue;
      }
      const visitKey = `${objectId}\0${relativePath}`;
      if (visited.has(visitKey)) {
        continue;
      }
      visited.add(visitKey);

      let blob = blobCache.get(objectId);
      if (!blob) {
        try {
          const size = Number.parseInt(execFileSync("git", ["cat-file", "-s", objectId], {
            cwd: repositoryRoot,
            encoding: "utf8",
          }).trim(), 10);
          const bytes = size <= 1_000_000
            ? execFileSync("git", ["cat-file", "blob", objectId], {
              cwd: repositoryRoot,
              encoding: "buffer",
              maxBuffer: 1_100_000,
            })
            : Buffer.alloc(0);
          blob = { bytes, size };
          blobCache.set(objectId, blob);
        } catch (error) {
          findings.add(`${relativePath} [history]: unable to inspect blob ${objectId}: ${error instanceof Error ? error.message : String(error)}`);
          continue;
        }
      }
      const blobFindings = [];
      addBlobFindings(blobFindings, relativePath, blob.bytes, blob.size, "history");
      for (const finding of blobFindings) {
        findings.add(finding);
      }
    }
  }
  return [...findings].sort();
}

export function verifyPublicBoundary() {
  const errors = [];
  try {
    errors.push(...scanGitIndex());
    scanFiles(projectFiles(), errors);
    errors.push(...scanGitHistory());
    errors.push(...scanReachableGitBlobs());
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors;
}

if (isEntrypoint(import.meta.url)) {
  reportErrors("Public-boundary verification", verifyPublicBoundary());
}
