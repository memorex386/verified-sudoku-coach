import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

export function fromRoot(...segments) {
  return path.join(projectRoot, ...segments);
}

function isContainedPath(rootDirectory, candidate) {
  const relative = path.relative(rootDirectory, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." &&
    !path.isAbsolute(relative));
}

export function inspectRepositoryPath(
  repositoryRoot,
  baseDirectory,
  target,
  { requireFile = false, rejectSymlinks = true } = {},
) {
  const root = path.resolve(repositoryRoot);
  if (typeof target !== "string" || path.isAbsolute(target)) {
    return { ok: false, reason: "outside" };
  }
  const resolved = path.resolve(baseDirectory, target);
  if (!isContainedPath(root, resolved)) {
    return { ok: false, reason: "outside", resolved };
  }
  if (!fs.existsSync(resolved)) {
    return { ok: false, reason: "missing", resolved };
  }

  try {
    const relative = path.relative(root, resolved);
    let current = root;
    for (const segment of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      if (fs.lstatSync(current).isSymbolicLink()) {
        if (rejectSymlinks) {
          return { ok: false, reason: "symlink", resolved };
        }
        break;
      }
    }
    const realRoot = fs.realpathSync.native(root);
    const realResolved = fs.realpathSync.native(resolved);
    if (!isContainedPath(realRoot, realResolved)) {
      return { ok: false, reason: "outside", resolved, realResolved };
    }
    if (requireFile && !fs.statSync(realResolved).isFile()) {
      return { ok: false, reason: "not-file", resolved, realResolved };
    }
    return { ok: true, resolved, realResolved };
  } catch (error) {
    return {
      ok: false,
      reason: "unreadable",
      resolved,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function toPosix(value) {
  return value.split(path.sep).join("/");
}

export function missingRequiredIds(actualIds, requiredIds) {
  const actual = new Set(actualIds);
  return [...requiredIds].filter((id) => !actual.has(id)).sort();
}

export function normalizeText(value) {
  return value.replace(/\r\n/g, "\n");
}

export function readText(relativePath) {
  return normalizeText(fs.readFileSync(fromRoot(relativePath), "utf8"));
}

export function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

export function walkFiles(relativeDirectory, options = {}) {
  const start = fromRoot(relativeDirectory);
  if (!fs.existsSync(start)) {
    return [];
  }

  const excluded = new Set(options.excludedDirectories ?? []);
  const result = [];
  const visit = (absoluteDirectory) => {
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      if (entry.isDirectory() && excluded.has(entry.name)) {
        continue;
      }
      const absolutePath = path.join(absoluteDirectory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (!options.extension || entry.name.endsWith(options.extension)) {
        result.push(toPosix(path.relative(projectRoot, absolutePath)));
      }
    }
  };
  visit(start);
  return result.sort();
}

export function parseFrontMatter(content, relativePath = "document") {
  const normalized = normalizeText(content);
  if (!normalized.startsWith("---\n")) {
    throw new Error(`${relativePath}: missing opening front matter delimiter`);
  }
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) {
    throw new Error(`${relativePath}: missing closing front matter delimiter`);
  }

  const metadata = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new Error(`${relativePath}: invalid front matter line ${JSON.stringify(line)}`);
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (Object.hasOwn(metadata, key)) {
      throw new Error(`${relativePath}: duplicate front matter field ${key}`);
    }
    metadata[key] = value;
  }

  return {
    metadata,
    body: normalized.slice(end + 5),
  };
}

export function markdownLinkTargets(content) {
  const targets = [];
  const inlinePattern = /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+(?:["'][^"']*["']|\([^)]*\)))?\s*\)/g;
  for (const match of content.matchAll(inlinePattern)) {
    targets.push(match[1] ?? match[2]);
  }
  const definitionPattern = /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))(?:\s+(?:["'][^"']*["']|\([^)]*\)))?\s*$/gm;
  for (const match of content.matchAll(definitionPattern)) {
    targets.push(match[1] ?? match[2]);
  }
  return targets.filter(Boolean);
}

function normalizeReferenceLabel(value) {
  return value.trim().replaceAll(/\s+/g, " ").toLowerCase();
}

export function undefinedMarkdownReferences(content) {
  const definitions = new Set(
    [...content.matchAll(/^\s{0,3}\[([^\]]+)\]:\s*(?:<[^>]+>|\S+)/gm)]
      .map((match) => normalizeReferenceLabel(match[1])),
  );
  const missing = new Set();
  for (const match of content.matchAll(/!?\[([^\]]+)\]\[([^\]]*)\]/g)) {
    const label = normalizeReferenceLabel(match[2] || match[1]);
    if (!definitions.has(label)) {
      missing.add(label);
    }
  }
  return [...missing].sort();
}

export function reportErrors(title, errors) {
  if (errors.length === 0) {
    console.log(`${title} passed.`);
    return;
  }
  console.error(`${title} failed with ${errors.length} error(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
}

export function isEntrypoint(metaUrl) {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(metaUrl);
}
