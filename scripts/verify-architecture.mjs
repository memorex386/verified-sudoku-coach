#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";
import crypto from "node:crypto";
import ts from "typescript";
import {
  fromRoot,
  isEntrypoint,
  reportErrors,
} from "./lib/project.mjs";

function projectReader(rootDirectory) {
  const resolve = (...segments) => path.join(rootDirectory, ...segments);
  const readText = (relativePath) => fs.readFileSync(resolve(relativePath), "utf8").replace(/\r\n/g, "\n");
  const readJson = (relativePath) => JSON.parse(readText(relativePath));
  const walkFiles = (relativeDirectory, options = {}) => {
    const start = resolve(relativeDirectory);
    if (!fs.existsSync(start)) {
      return [];
    }
    const excluded = new Set(options.excludedDirectories ?? []);
    const result = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && excluded.has(entry.name)) {
          continue;
        }
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(absolutePath);
        } else if (!options.extension || entry.name.endsWith(options.extension)) {
          result.push(path.relative(rootDirectory, absolutePath).replaceAll("\\", "/"));
        }
      }
    };
    visit(start);
    return result.sort();
  };
  return { readJson, readText, resolve, walkFiles };
}

const acceptedArchitecturePolicyVersion = "VSC-ARCH-1";
const acceptedArchitecturePolicySha256 = "9d4607321f7116beecde1ad7f4a177b0766054494a5d388000f7593ef40e1132";

function canonicalPolicyValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => canonicalPolicyValue(item))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalPolicyValue(value[key])]),
    );
  }
  return value;
}

export function architecturePolicyDigest(config) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(canonicalPolicyValue(config)))
    .digest("hex");
}

export function validateAcceptedArchitecturePolicy(config) {
  const errors = [];
  if (config.policyVersion !== acceptedArchitecturePolicyVersion) {
    errors.push(
      `config/architecture.json: policyVersion must be ${acceptedArchitecturePolicyVersion}`,
    );
  }
  if (architecturePolicyDigest(config) !== acceptedArchitecturePolicySha256) {
    errors.push(
      "config/architecture.json: policy differs from the accepted VSC-ARCH-1 workspace graph; update the governing ADR and verifier together",
    );
  }
  return errors;
}

export function findDependencyCycle(graph) {
  const visiting = new Set();
  const visited = new Set();
  const trail = [];

  const visit = (name) => {
    if (visiting.has(name)) {
      const start = trail.indexOf(name);
      return [...trail.slice(start), name];
    }
    if (visited.has(name)) {
      return null;
    }
    visiting.add(name);
    trail.push(name);
    for (const dependency of graph.get(name) ?? []) {
      const cycle = visit(dependency);
      if (cycle) {
        return cycle;
      }
    }
    trail.pop();
    visiting.delete(name);
    visited.add(name);
    return null;
  };

  for (const name of graph.keys()) {
    const cycle = visit(name);
    if (cycle) {
      return cycle;
    }
  }
  return null;
}

const forbiddenCoreEffectOrder = [
  "environment access",
  "Node ambient access",
  "host UI access",
  "network access",
  "browser storage",
  "wall-clock access",
  "timer access",
  "random access",
  "dynamic code access",
  "console side effect",
];
const forbiddenIdentifierEffects = new Map([
  ["process", "environment access"],
  ["globalThis", "environment access"],
  ["Deno", "environment access"],
  ["Bun", "environment access"],
  ["Buffer", "Node ambient access"],
  ["module", "Node ambient access"],
  ["require", "Node ambient access"],
  ["__dirname", "Node ambient access"],
  ["__filename", "Node ambient access"],
  ["window", "host UI access"],
  ["document", "host UI access"],
  ["navigator", "host UI access"],
  ["location", "host UI access"],
  ["history", "host UI access"],
  ["screen", "host UI access"],
  ["speechSynthesis", "host UI access"],
  ["fetch", "network access"],
  ["XMLHttpRequest", "network access"],
  ["WebSocket", "network access"],
  ["EventSource", "network access"],
  ["BroadcastChannel", "network access"],
  ["Worker", "network access"],
  ["SharedWorker", "network access"],
  ["postMessage", "host UI access"],
  ["localStorage", "browser storage"],
  ["sessionStorage", "browser storage"],
  ["indexedDB", "browser storage"],
  ["caches", "browser storage"],
  ["Date", "wall-clock access"],
  ["Intl", "wall-clock access"],
  ["performance", "wall-clock access"],
  ["setTimeout", "timer access"],
  ["setInterval", "timer access"],
  ["setImmediate", "timer access"],
  ["queueMicrotask", "timer access"],
  ["crypto", "random access"],
  ["eval", "dynamic code access"],
  ["Function", "dynamic code access"],
  ["Reflect", "dynamic code access"],
  ["console", "console side effect"],
]);
const sensitiveOwnerProperties = new Map([
  ["Math", new Map([["random", "random access"]])],
  ["crypto", new Map([
    ["randomUUID", "random access"],
    ["getRandomValues", "random access"],
    ["randomBytes", "random access"],
    ["randomInt", "random access"],
  ])],
  ["crypto.subtle", new Map([["generateKey", "random access"]])],
  ["performance", new Map([
    ["now", "wall-clock access"],
    ["timeOrigin", "wall-clock access"],
  ])],
]);
const forbiddenBrowserIdentifiers = new Set([
  "Buffer",
  "__dirname",
  "__filename",
  "exports",
  "global",
  "module",
  "process",
  "require",
]);
const forbiddenDynamicCodeIdentifiers = new Set(["eval", "Function", "Reflect"]);
const nodeBuiltinSpecifiers = new Set(
  builtinModules.map((specifier) => specifier.replace(/^node:/, "")),
);

function moduleReferences(content) {
  const source = ts.createSourceFile(
    "architecture-source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const specifiers = [];
  let hasOpaqueSpecifier = false;

  const record = (expression) => {
    if (ts.isStringLiteralLike(expression)) {
      specifiers.push(expression.text);
    } else {
      hasOpaqueSpecifier = true;
    }
  };

  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      record(node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) &&
        ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression) {
      record(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      const isRequireResolve = ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "require" &&
        node.expression.name.text === "resolve";
      const isModuleRequire = (ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "module" &&
        node.expression.name.text === "require") ||
        (ts.isElementAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) && node.expression.expression.text === "module" &&
          node.expression.argumentExpression &&
          ts.isStringLiteralLike(node.expression.argumentExpression) &&
          node.expression.argumentExpression.text === "require");
      if (isDynamicImport || isRequire || isRequireResolve || isModuleRequire) {
        if (node.arguments.length === 1 && node.arguments[0]) {
          record(node.arguments[0]);
        } else {
          hasOpaqueSpecifier = true;
        }
      }
    } else if (ts.isImportTypeNode(node)) {
      if (ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
        record(node.argument.literal);
      } else {
        hasOpaqueSpecifier = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return { specifiers: [...new Set(specifiers)], hasOpaqueSpecifier };
}

function unwrapExpression(node) {
  let current = node;
  while (current && (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) || ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current))) {
    current = current.expression;
  }
  return current;
}

function staticPropertyName(node, stringAliases = new Map()) {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  if (ts.isComputedPropertyName(node)) {
    return staticStringValue(node.expression, stringAliases);
  }
  return null;
}

function staticMember(node, stringAliases = new Map()) {
  const expression = unwrapExpression(node);
  if (expression && ts.isPropertyAccessExpression(expression)) {
    return [expression.expression, expression.name.text];
  }
  if (expression && ts.isElementAccessExpression(expression) && expression.argumentExpression) {
    const property = staticStringValue(expression.argumentExpression, stringAliases);
    return [expression.expression, property ?? "*"];
  }
  return null;
}

function staticBindingProperty(element, stringAliases = new Map()) {
  if (element.dotDotDotToken) {
    return "*";
  }
  return staticPropertyName(element.propertyName ?? element.name, stringAliases);
}

function recordSensitiveOwnerProperty(found, owner, property) {
  const properties = sensitiveOwnerProperties.get(owner);
  if (!properties) {
    return;
  }
  if (property === "*") {
    for (const label of properties.values()) {
      found.add(label);
    }
    return;
  }
  const label = properties.get(property);
  if (label) {
    found.add(label);
  }
}

function resolveSensitiveOwners(node, aliases, stringAliases = new Map()) {
  const expression = unwrapExpression(node);
  if (!expression) {
    return new Set();
  }
  if (ts.isIdentifier(expression)) {
    return aliases.get(expression.text) ?? new Set();
  }
  const member = staticMember(expression, stringAliases);
  if (!member) {
    return new Set();
  }
  const [ownerExpression, property] = member;
  return new Set(
    [...resolveSensitiveOwners(ownerExpression, aliases, stringAliases)]
      .map((owner) => `${owner}.${property}`),
  );
}

function collectSensitiveOwnerAliases(source, stringAliases = new Map()) {
  const aliases = new Map(
    [...sensitiveOwnerProperties.keys()].map((name) => [name, new Set([name])]),
  );
  const candidates = [];
  const visit = (node) => {
    if ((ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
        ts.isIdentifier(node.name) && node.initializer) {
      candidates.push([node.name.text, node.initializer]);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = unwrapExpression(node.left);
      if (left && ts.isIdentifier(left)) {
        candidates.push([left.text, node.right]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  let changed = true;
  while (changed) {
    changed = false;
    for (const [alias, initializer] of candidates) {
      const owners = resolveSensitiveOwners(initializer, aliases, stringAliases);
      const aliasOwners = aliases.get(alias) ?? new Set();
      for (const owner of owners) {
        if (!aliasOwners.has(owner)) {
          aliasOwners.add(owner);
          changed = true;
        }
      }
      if (aliasOwners.size > 0) {
        aliases.set(alias, aliasOwners);
      }
    }
  }
  return aliases;
}

function recordSensitiveBinding(found, name, initializer, aliases, stringAliases = new Map()) {
  const owners = initializer
    ? resolveSensitiveOwners(initializer, aliases, stringAliases)
    : new Set();
  if (!ts.isObjectBindingPattern(name) || owners.size === 0) {
    return;
  }
  for (const element of name.elements) {
    const property = staticBindingProperty(element, stringAliases);
    if (property) {
      for (const owner of owners) {
        recordSensitiveOwnerProperty(found, owner, property);
      }
    }
  }
}

function recordSensitiveAssignment(found, left, right, aliases, stringAliases = new Map()) {
  const owners = resolveSensitiveOwners(right, aliases, stringAliases);
  const assignment = unwrapExpression(left);
  if (owners.size === 0 || !assignment || !ts.isObjectLiteralExpression(assignment)) {
    return;
  }
  for (const property of assignment.properties) {
    if (ts.isSpreadAssignment(property)) {
      for (const owner of owners) {
        recordSensitiveOwnerProperty(found, owner, "*");
      }
      continue;
    }
    if (ts.isShorthandPropertyAssignment(property) || ts.isPropertyAssignment(property)) {
      const propertyName = staticPropertyName(property.name, stringAliases);
      if (propertyName) {
        for (const owner of owners) {
          recordSensitiveOwnerProperty(found, owner, propertyName);
        }
      }
    }
  }
}

function sourceUsesStaticName(content, identifiers) {
  const source = ts.createSourceFile(
    "architecture-source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const stringAliases = collectStaticStringAliases(source);
  let found = false;
  const visit = (node) => {
    const isNamedIdentifier = ts.isIdentifier(node) && identifiers.has(node.text);
    const isNamedElementAccess = ts.isStringLiteralLike(node) &&
      ts.isElementAccessExpression(node.parent) && node.parent.argumentExpression === node &&
      identifiers.has(node.text);
    const member = staticMember(node, stringAliases);
    const isFoldedNamedMember = member !== null && identifiers.has(member[1]);
    if (isNamedIdentifier || isNamedElementAccess || isFoldedNamedMember) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function staticStringValue(node, aliases = new Map()) {
  const expression = unwrapExpression(node);
  if (!expression) {
    return null;
  }
  if (ts.isIdentifier(expression)) {
    return aliases.get(expression.text) ?? null;
  }
  if (ts.isStringLiteralLike(expression)) {
    return expression.text;
  }
  if (ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticStringValue(expression.left, aliases);
    const right = staticStringValue(expression.right, aliases);
    return left === null || right === null ? null : left + right;
  }
  if (ts.isTemplateExpression(expression)) {
    let value = expression.head.text;
    for (const span of expression.templateSpans) {
      const substitution = staticStringValue(span.expression, aliases);
      if (substitution === null) {
        return null;
      }
      value += substitution + span.literal.text;
    }
    return value;
  }
  if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) &&
      expression.expression.name.text === "join" &&
      ts.isArrayLiteralExpression(unwrapExpression(expression.expression.expression))) {
    const values = unwrapExpression(expression.expression.expression).elements
      .map((element) => staticStringValue(element, aliases));
    const separator = expression.arguments.length === 0
      ? ","
      : expression.arguments.length === 1
        ? staticStringValue(expression.arguments[0], aliases)
        : null;
    if (separator !== null && values.every((value) => value !== null)) {
      return values.join(separator);
    }
  }
  return null;
}

function collectStaticStringAliases(source) {
  const aliases = new Map();
  const candidates = [];
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.Const) !== 0) {
      candidates.push([node.name.text, node.initializer]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  const nameCounts = new Map();
  for (const [name] of candidates) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  const conflicts = new Set(
    [...nameCounts].filter(([, count]) => count > 1).map(([name]) => name),
  );

  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, initializer] of candidates) {
      if (conflicts.has(name)) {
        continue;
      }
      const value = staticStringValue(initializer, aliases);
      if (value !== null && aliases.get(name) !== value) {
        aliases.set(name, value);
        changed = true;
      }
    }
  }
  return aliases;
}

function sourceContainsStaticString(content, predicate) {
  const source = ts.createSourceFile(
    "architecture-source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const aliases = collectStaticStringAliases(source);
  let found = false;
  const visit = (node) => {
    const value = staticStringValue(node, aliases);
    if (value !== null && predicate(value)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function sourceHasTypeScriptSuppressionDirective(content) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    content,
  );
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if ((token === ts.SyntaxKind.SingleLineCommentTrivia ||
        token === ts.SyntaxKind.MultiLineCommentTrivia) &&
        /@ts-(?:check|nocheck|ignore|expect-error)\b/i.test(scanner.getTokenText())) {
      return true;
    }
    token = scanner.scan();
  }
  return false;
}

function nodeUsesStaticConstructorAccess(node, stringAliases = new Map()) {
  const member = staticMember(node, stringAliases);
  if (member?.[1] === "constructor") {
    return true;
  }
  if (ts.isObjectBindingPattern(node)) {
    return node.elements.some((element) =>
      staticBindingProperty(element, stringAliases) === "constructor");
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    const left = unwrapExpression(node.left);
    if (left && ts.isObjectLiteralExpression(left)) {
      return left.properties.some((property) =>
        (ts.isShorthandPropertyAssignment(property) || ts.isPropertyAssignment(property)) &&
        staticPropertyName(property.name, stringAliases) === "constructor");
    }
  }
  return false;
}

function sourceUsesStaticConstructorAccess(content) {
  const source = ts.createSourceFile(
    "architecture-source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const stringAliases = collectStaticStringAliases(source);
  let found = false;
  const visit = (node) => {
    if (nodeUsesStaticConstructorAccess(node, stringAliases)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function classifyCoreEffects(content) {
  const source = ts.createSourceFile(
    "pure-source.tsx",
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found = new Set();
  const stringAliases = collectStaticStringAliases(source);
  const sensitiveOwnerAliases = collectSensitiveOwnerAliases(source, stringAliases);
  const visit = (node) => {
    if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
      found.add("environment access");
    }
    if (ts.isIdentifier(node)) {
      const label = forbiddenIdentifierEffects.get(node.text);
      if (label) {
        found.add(label);
      }
    }
    const member = staticMember(node, stringAliases);
    if (member) {
      const [ownerExpression, property] = member;
      const owners = resolveSensitiveOwners(
        ownerExpression,
        sensitiveOwnerAliases,
        stringAliases,
      );
      for (const resolvedOwner of owners) {
        recordSensitiveOwnerProperty(found, resolvedOwner, property);
      }
    }
    if (nodeUsesStaticConstructorAccess(node, stringAliases)) {
      found.add("dynamic code access");
    }
    if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
      recordSensitiveBinding(
        found,
        node.name,
        node.initializer,
        sensitiveOwnerAliases,
        stringAliases,
      );
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      recordSensitiveAssignment(
        found,
        node.left,
        node.right,
        sensitiveOwnerAliases,
        stringAliases,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return forbiddenCoreEffectOrder.filter((label) => found.has(label));
}

function workspaceSourceFiles(relativePath, walkProjectFiles) {
  const normalizedRoot = relativePath.replaceAll("\\", "/").replace(/\/$/, "");
  const sourceRoot = path.posix.basename(normalizedRoot) === "src";
  return walkProjectFiles(relativePath)
    .filter((file) => {
      if (sourceRoot) {
        return true;
      }
      const nestedPath = file.slice(normalizedRoot.length + 1);
      const topLevelDirectory = nestedPath.split("/")[0];
      return !["dist", "node_modules"].includes(topLevelDirectory);
    })
    .filter((file) => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file));
}

export function relativeImportEscapes(sourceFile, packagePath, imported, rootDirectory = fromRoot()) {
  if (!imported.startsWith(".")) {
    return false;
  }
  const packageRoot = path.resolve(rootDirectory, packagePath);
  const resolved = path.resolve(rootDirectory, path.dirname(sourceFile), imported);
  return resolved !== packageRoot && !resolved.startsWith(`${packageRoot}${path.sep}`);
}

export function classifyCoreSource(content) {
  return classifyPureSource(content, []);
}

export function classifyPureSource(content, allowedExternalDependencies = []) {
  const errors = [];
  const { specifiers: imports, hasOpaqueSpecifier } = moduleReferences(content);
  if (hasOpaqueSpecifier) {
    errors.push("non-literal module specifier");
  }
  for (const imported of imports) {
    if (!imported.startsWith("@verified-sudoku/") &&
        !imported.startsWith(".") &&
        !allowedExternalDependencies.some((dependency) =>
          matchesDependencyPattern(imported, dependency))) {
      errors.push(`external import ${imported}`);
    }
  }
  errors.push(...classifyCoreEffects(content));
  return errors;
}

function matchesDependencyPattern(specifier, pattern) {
  return pattern.endsWith("/")
    ? specifier.startsWith(pattern)
    : specifier === pattern || specifier.startsWith(`${pattern}/`);
}

function dependencyNameForSpecifier(specifier) {
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }
  return specifier.split("/")[0];
}

export function dependencySpecViolation(dependency, specifier, isWorkspaceDependency = false) {
  if (typeof specifier !== "string") {
    return `dependency ${dependency} must use a string version specifier`;
  }
  if (isWorkspaceDependency) {
    return specifier === "*"
      ? null
      : `workspace dependency ${dependency} must use the local-only * specifier; found ${specifier}`;
  }
  const exactSemver = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  if (!exactSemver.test(specifier)) {
    return `external dependency ${dependency} must use an exact registry version; found ${specifier}`;
  }
  return null;
}

export function classifyBrowserSource(
  content,
  forbiddenDependencies = ["openai", "@openai/"],
) {
  const errors = [];
  const { specifiers: imports, hasOpaqueSpecifier } = moduleReferences(content);
  if (hasOpaqueSpecifier) {
    errors.push("non-literal module specifier");
  }
  for (const imported of imports) {
    const bareSpecifier = imported.replace(/^node:/, "");
    if (imported.startsWith("node:") || nodeBuiltinSpecifiers.has(bareSpecifier) ||
        forbiddenDependencies.some((dependency) =>
      matchesDependencyPattern(imported, dependency))) {
      errors.push(`Node-only import ${imported}`);
    }
  }
  if (sourceUsesStaticName(content, forbiddenBrowserIdentifiers)) {
    errors.push("Node-only global");
  }
  if (sourceUsesStaticName(content, forbiddenDynamicCodeIdentifiers)) {
    errors.push("dynamic code access");
  }
  if (sourceUsesStaticConstructorAccess(content) && !errors.includes("dynamic code access")) {
    errors.push("dynamic code access");
  }
  if (/OPENAI_(?:API_|SECRET_|PRIVATE_)?KEY/i.test(content) || sourceContainsStaticString(
    content,
    (value) => /OPENAI_(?:API_|SECRET_|PRIVATE_)?KEY/i.test(value),
  )) {
    errors.push("provider credential name");
  }
  if (sourceContainsStaticString(content, (value) => /\bapi\.openai\.com(?=[/:]|$)/i.test(value))) {
    errors.push("direct provider endpoint");
  }
  return errors;
}

export function classifyBrowserHtml(content) {
  const errors = [];
  for (const match of content.matchAll(/<script\b([^>]*)>/gi)) {
    const attributes = match[1] ?? "";
    const source = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1];
    if (!source) {
      errors.push("inline or source-less script");
    } else if (!/^(?:\/|\.\/)?src\/[A-Za-z0-9_./-]+$/.test(source) || source.includes("..")) {
      errors.push(`non-src script ${source}`);
    }
  }
  if (/<script\b[^>]*>[\s\S]*?\S[\s\S]*?<\/script\s*>/i.test(content)) {
    errors.push("inline script content");
  }
  if (/\son[a-z]+\s*=|javascript\s*:/i.test(content)) {
    errors.push("inline executable HTML attribute");
  }
  return [...new Set(errors)];
}

export function verifyArchitectureAtRoot(rootDirectory) {
  const errors = [];
  const project = projectReader(rootDirectory);
  const config = project.readJson("config/architecture.json");
  if (config.schemaVersion !== 1 || typeof config.workspaces !== "object") {
    return ["config/architecture.json: unsupported or invalid schema"];
  }
  errors.push(...validateAcceptedArchitecturePolicy(config));

  const strictCompilerOptions = [
    "strict",
    "noUncheckedIndexedAccess",
    "exactOptionalPropertyTypes",
    "noUncheckedSideEffectImports",
  ];
  const nonWeakenableCompilerOptions = [
    ...strictCompilerOptions,
    "noImplicitAny",
    "strictNullChecks",
    "strictFunctionTypes",
    "strictBindCallApply",
    "strictPropertyInitialization",
    "noImplicitThis",
    "useUnknownInCatchVariables",
    "alwaysStrict",
    "strictBuiltinIteratorReturn",
    "noImplicitOverride",
    "noPropertyAccessFromIndexSignature",
    "forceConsistentCasingInFileNames",
    "isolatedModules",
    "verbatimModuleSyntax",
  ];
  const semanticCheckDisablingOptions = ["noCheck"];
  const rootBaseConfig = project.readJson("tsconfig.base.json");
  const rootCompilerOptions = rootBaseConfig.compilerOptions ?? {};
  if (Object.hasOwn(rootBaseConfig, "extends")) {
    errors.push("tsconfig.base.json: extending another config is forbidden");
  }
  for (const option of strictCompilerOptions) {
    if (rootCompilerOptions[option] !== true) {
      errors.push(`tsconfig.base.json: compilerOptions.${option} must be true`);
    }
  }
  for (const option of nonWeakenableCompilerOptions) {
    if (Object.hasOwn(rootCompilerOptions, option) && rootCompilerOptions[option] !== true) {
      errors.push(`tsconfig.base.json: compilerOptions.${option} cannot weaken strict mode`);
    }
  }
  for (const option of semanticCheckDisablingOptions) {
    if (rootCompilerOptions[option] === true) {
      errors.push(`tsconfig.base.json: compilerOptions.${option} must not be true`);
    }
  }
  if (!Array.isArray(rootCompilerOptions.lib) ||
      JSON.stringify(rootCompilerOptions.lib) !== JSON.stringify(["ES2022"])) {
    errors.push("tsconfig.base.json: compilerOptions.lib must be exactly ES2022");
  }
  for (const [option, expected] of Object.entries({
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
  })) {
    if (rootCompilerOptions[option] !== expected) {
      errors.push(`tsconfig.base.json: compilerOptions.${option} must be exactly ${expected}`);
    }
  }
  for (const option of ["baseUrl", "paths", "rootDirs"]) {
    if (Object.hasOwn(rootCompilerOptions, option)) {
      errors.push(`tsconfig.base.json: compilerOptions.${option} remapping is forbidden`);
    }
  }
  if (!Array.isArray(rootCompilerOptions.types) || rootCompilerOptions.types.length !== 0) {
    errors.push("tsconfig.base.json: compilerOptions.types must be an empty array");
  }

  const graph = new Map();
  const configuredNames = new Set(Object.keys(config.workspaces));
  const discoveredNames = new Set();
  const configuredPaths = new Map();
  for (const [name, rule] of Object.entries(config.workspaces)) {
    const normalizedPath = typeof rule.path === "string"
      ? path.normalize(rule.path).replaceAll("\\", "/")
      : "";
    if (!/^(?:apps|packages|tools)\/[^/]+$/.test(normalizedPath) ||
        path.isAbsolute(rule.path ?? "") || normalizedPath !== rule.path) {
      errors.push(`config/architecture.json: ${name} has invalid or escaping path ${rule.path ?? "(missing)"}`);
    }
    if (configuredPaths.has(normalizedPath)) {
      errors.push(`config/architecture.json: ${name} duplicates path ${normalizedPath}`);
    } else {
      configuredPaths.set(normalizedPath, name);
    }
  }
  const pathByName = new Map(
    Object.entries(config.workspaces).map(([name, rule]) => [name, rule.path]),
  );
  const purePackages = new Set([
    ...(config.corePackages ?? []),
    ...(config.boundaryPackages ?? []),
  ]);
  const browserPackageNames = new Set(config.browserPackages ?? []);
  const pureRuntimeExternalDependencies = config.pureRuntimeExternalDependencies ?? {};
  for (const name of purePackages) {
    if (!Object.hasOwn(pureRuntimeExternalDependencies, name)) {
      errors.push(`config/architecture.json: missing pure runtime dependency policy for ${name}`);
    }
  }
  for (const name of Object.keys(pureRuntimeExternalDependencies)) {
    if (!purePackages.has(name)) {
      errors.push(`config/architecture.json: runtime dependency policy targets non-pure workspace ${name}`);
    }
  }
  for (const category of [
    "browserPackages",
    "providerPackages",
    "nodeOnlyPackages",
    "corePackages",
    "boundaryPackages",
  ]) {
    for (const name of config[category] ?? []) {
      if (!configuredNames.has(name)) {
        errors.push(`config/architecture.json: ${category} contains unknown workspace ${name}`);
      }
    }
  }

  for (const [name, rule] of Object.entries(config.workspaces)) {
    const packagePath = `${rule.path}/package.json`;
    if (!fs.existsSync(project.resolve(packagePath))) {
      errors.push(`${name}: missing ${packagePath}`);
      continue;
    }
    const manifest = project.readJson(packagePath);
    discoveredNames.add(manifest.name);
    if (manifest.name !== name) {
      errors.push(`${packagePath}: expected package name ${name}, found ${manifest.name}`);
    }
    if (Object.hasOwn(manifest, "imports")) {
      errors.push(`${packagePath}: package imports aliases are forbidden`);
    }
    for (const field of ["browser", "main", "module", "typesVersions"]) {
      if (Object.hasOwn(manifest, field)) {
        errors.push(`${packagePath}: package ${field} remapping/entrypoint field is forbidden`);
      }
    }

    const allowed = new Set(rule.mayDependOn);
    for (const dependency of allowed) {
      if (!configuredNames.has(dependency)) {
        errors.push(`config/architecture.json: ${name} allows unknown dependency ${dependency}`);
      }
    }
    const actualWorkspaceDependencies = [];
    const declaredDependencies = new Set();
    const runtimeDeclaredDependencies = new Set();
    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const [dependency, specifier] of Object.entries(manifest[field] ?? {})) {
        declaredDependencies.add(dependency);
        if (field !== "devDependencies") {
          runtimeDeclaredDependencies.add(dependency);
        }
        const specViolation = dependencySpecViolation(
          dependency,
          specifier,
          configuredNames.has(dependency),
        );
        if (specViolation) {
          errors.push(`${packagePath}: ${specViolation}`);
        }
        if (configuredNames.has(dependency)) {
          actualWorkspaceDependencies.push(dependency);
          if (!allowed.has(dependency)) {
            errors.push(`${packagePath}: architecture forbids dependency on ${dependency}`);
          }
        } else if (dependency.startsWith("@verified-sudoku/")) {
          errors.push(`${packagePath}: unknown workspace dependency ${dependency}`);
        }
      }
    }
    graph.set(name, actualWorkspaceDependencies);

    const tsconfigPath = `${rule.path}/tsconfig.json`;
    if (!fs.existsSync(project.resolve(tsconfigPath))) {
      errors.push(`${name}: missing ${tsconfigPath} project reference config`);
    } else {
      const tsconfig = project.readJson(tsconfigPath);
      const resolvedExtends = typeof tsconfig.extends === "string"
        ? path.normalize(path.join(rule.path, tsconfig.extends)).replaceAll("\\", "/")
        : "";
      if (resolvedExtends !== "tsconfig.base.json") {
        errors.push(`${tsconfigPath}: must extend the root tsconfig.base.json`);
      }
      for (const option of nonWeakenableCompilerOptions) {
        if (Object.hasOwn(tsconfig.compilerOptions ?? {}, option) &&
            tsconfig.compilerOptions[option] !== true) {
          errors.push(`${tsconfigPath}: compilerOptions.${option} cannot weaken the root setting`);
        }
      }
      for (const option of semanticCheckDisablingOptions) {
        if (tsconfig.compilerOptions?.[option] === true) {
          errors.push(`${tsconfigPath}: compilerOptions.${option} must not be true`);
        }
      }
      for (const option of ["baseUrl", "paths", "rootDirs"]) {
        if (Object.hasOwn(tsconfig.compilerOptions ?? {}, option)) {
          errors.push(`${tsconfigPath}: compilerOptions.${option} remapping is forbidden`);
        }
      }
      for (const option of ["target", "module", "moduleResolution"]) {
        if (Object.hasOwn(tsconfig.compilerOptions ?? {}, option)) {
          errors.push(`${tsconfigPath}: compilerOptions.${option} must inherit the root setting`);
        }
      }
      if ((purePackages.has(name) || (config.browserPackages ?? []).includes(name)) &&
          Object.hasOwn(tsconfig.compilerOptions ?? {}, "types") &&
          (!Array.isArray(tsconfig.compilerOptions.types) || tsconfig.compilerOptions.types.length > 0)) {
        errors.push(`${tsconfigPath}: pure/browser compilerOptions.types cannot add ambient packages`);
      }
      if (purePackages.has(name) && Object.hasOwn(tsconfig.compilerOptions ?? {}, "lib")) {
        errors.push(`${tsconfigPath}: pure compilerOptions.lib must inherit the root ES2022-only set`);
      }
      if (browserPackageNames.has(name)) {
        const browserLib = tsconfig.compilerOptions?.lib;
        if (!Array.isArray(browserLib) ||
            JSON.stringify(browserLib) !== JSON.stringify(["ES2022", "DOM", "DOM.Iterable"])) {
          errors.push(
            `${tsconfigPath}: browser compilerOptions.lib must be exactly ES2022, DOM, DOM.Iterable`,
          );
        }
      }
      if (tsconfig.compilerOptions?.rootDir !== "src") {
        errors.push(`${tsconfigPath}: compilerOptions.rootDir must be src`);
      }
      if (tsconfig.compilerOptions?.outDir !== "dist") {
        errors.push(`${tsconfigPath}: compilerOptions.outDir must be dist`);
      }
      const buildInfo = tsconfig.compilerOptions?.tsBuildInfoFile;
      if (typeof buildInfo !== "string" ||
          !path.normalize(buildInfo).replaceAll("\\", "/").startsWith("dist/") ||
          path.isAbsolute(buildInfo) || buildInfo.includes("..")) {
        errors.push(`${tsconfigPath}: compilerOptions.tsBuildInfoFile must stay within dist`);
      }
      if (Object.hasOwn(tsconfig, "files")) {
        errors.push(`${tsconfigPath}: files is forbidden; use the complete canonical src globs`);
      }
      if (Object.hasOwn(tsconfig, "exclude")) {
        errors.push(`${tsconfigPath}: exclude is forbidden; every production source must be typechecked`);
      }
      const productionFiles = workspaceSourceFiles(`${rule.path}/src`, project.walkFiles);
      const requiredIncludes = new Set(["src/**/*.ts"]);
      if (productionFiles.some((file) => file.endsWith(".tsx"))) {
        requiredIncludes.add("src/**/*.tsx");
      }
      if (productionFiles.some((file) => file.endsWith(".mts"))) {
        requiredIncludes.add("src/**/*.mts");
      }
      if (productionFiles.some((file) => file.endsWith(".cts"))) {
        requiredIncludes.add("src/**/*.cts");
      }
      const actualIncludes = new Set(Array.isArray(tsconfig.include) ? tsconfig.include : []);
      const allowedIncludes = new Set([
        "src/**/*.ts",
        "src/**/*.tsx",
        "src/**/*.mts",
        "src/**/*.cts",
      ]);
      if ([...requiredIncludes].some((pattern) => !actualIncludes.has(pattern)) ||
          [...actualIncludes].some((pattern) => !allowedIncludes.has(pattern))) {
        errors.push(
          `${tsconfigPath}: include must use canonical src globs and cover every production source`,
        );
      }
      const actualReferences = new Set(
        (tsconfig.references ?? []).map((reference) =>
          path.normalize(path.join(rule.path, reference.path)).replaceAll("\\", "/"),
        ),
      );
      for (const dependency of actualWorkspaceDependencies) {
        const dependencyPath = pathByName.get(dependency);
        if (dependencyPath && !actualReferences.has(dependencyPath)) {
          errors.push(`${tsconfigPath}: missing project reference to ${dependencyPath}`);
        }
      }
      const expectedReferencePaths = new Set(
        actualWorkspaceDependencies
          .map((dependency) => pathByName.get(dependency))
          .filter(Boolean),
      );
      for (const referencePath of actualReferences) {
        if (!expectedReferencePaths.has(referencePath)) {
          errors.push(`${tsconfigPath}: undeclared or unnecessary project reference ${referencePath}`);
        }
      }
    }

    if (rule.path.startsWith("packages/")) {
      const exportKeys = typeof manifest.exports === "object" && manifest.exports !== null
        ? Object.keys(manifest.exports)
        : [];
      if (exportKeys.length !== 1 || exportKeys[0] !== ".") {
        errors.push(`${packagePath}: package exports must expose only the root entrypoint`);
      } else {
        const targets = [];
        const collectTargets = (value) => {
          if (typeof value === "string") {
            targets.push(value);
          } else if (value && typeof value === "object") {
            for (const nested of Object.values(value)) {
              collectTargets(nested);
            }
          }
        };
        collectTargets(manifest.exports["."]);
        if (targets.length === 0 || targets.some((target) =>
          (!target.startsWith("./src/") && !target.startsWith("./dist/")) ||
          target.includes("*") || target.split("/").includes(".."))) {
          errors.push(`${packagePath}: export targets must be explicit paths within src or generated dist`);
        }
      }
    }

    for (const sourceFile of workspaceSourceFiles(rule.path, project.walkFiles)) {
      const content = project.readText(sourceFile);
      const isProductionSource = sourceFile.startsWith(`${rule.path}/src/`);
      if (isProductionSource && !/\.(?:[cm]?ts|tsx)$/.test(sourceFile)) {
        errors.push(`${sourceFile}: production source must be strict TypeScript`);
      }
      if (isProductionSource) {
        const productionRelativePath = sourceFile.slice(`${rule.path}/src/`.length);
        if (productionRelativePath.split("/").some((segment) =>
          ["dist", "node_modules"].includes(segment))) {
          errors.push(`${sourceFile}: reserved generated/dependency directory inside src is forbidden`);
        }
        if (sourceHasTypeScriptSuppressionDirective(content)) {
          errors.push(`${sourceFile}: TypeScript suppression directives are forbidden in production source`);
        }
        const preprocessing = ts.preProcessFile(content, true, true);
        if (preprocessing.referencedFiles.length > 0 ||
            preprocessing.typeReferenceDirectives.length > 0 ||
            preprocessing.libReferenceDirectives.length > 0) {
          errors.push(`${sourceFile}: triple-slash reference directives are forbidden in production source`);
        }
      }
      const { specifiers: imports, hasOpaqueSpecifier } = moduleReferences(content);
      if (hasOpaqueSpecifier) {
        errors.push(`${sourceFile}: non-literal module specifiers are forbidden`);
      }
      for (const imported of imports) {
        if (relativeImportEscapes(sourceFile, rule.path, imported, rootDirectory) || path.isAbsolute(imported)) {
          errors.push(`${sourceFile}: relative or absolute import escapes package boundary: ${imported}`);
        }
        if ((purePackages.has(name) || browserPackageNames.has(name)) && isProductionSource &&
            relativeImportEscapes(sourceFile, `${rule.path}/src`, imported, rootDirectory)) {
          errors.push(`${sourceFile}: production import escapes the runtime src boundary: ${imported}`);
        }
        if (!imported.startsWith(".") && !path.isAbsolute(imported) &&
            !imported.startsWith("node:") &&
            !nodeBuiltinSpecifiers.has(imported.replace(/^node:/, ""))) {
          const dependencyName = dependencyNameForSpecifier(imported);
          const dependencyDeclarations = isProductionSource
            ? runtimeDeclaredDependencies
            : declaredDependencies;
          if (!dependencyDeclarations.has(dependencyName)) {
            if (isProductionSource && declaredDependencies.has(dependencyName)) {
              errors.push(
                `${sourceFile}: production import ${imported} must be declared in dependencies, peerDependencies, or optionalDependencies`,
              );
              continue;
            }
            errors.push(`${sourceFile}: external import ${imported} must be declared in ${packagePath}`);
          }
        }
        if (!configuredNames.has(imported) && !imported.startsWith("@verified-sudoku/")) {
          continue;
        }
        if (!allowed.has(imported)) {
          errors.push(`${sourceFile}: architecture forbids import from ${imported}`);
        }
        if (!actualWorkspaceDependencies.includes(imported)) {
          errors.push(`${sourceFile}: ${imported} must be declared in ${packagePath}`);
        }
      }

      if (purePackages.has(name) && isProductionSource) {
        const allowedExternalDependencies = pureRuntimeExternalDependencies[name] ?? [];
        for (const violation of classifyPureSource(content, allowedExternalDependencies)) {
          errors.push(`${sourceFile}: pure production boundary forbids ${violation}`);
        }
      }
    }

    if (purePackages.has(name)) {
      const allowedExternalDependencies = pureRuntimeExternalDependencies[name] ?? [];
      for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
        for (const dependency of Object.keys(manifest[field] ?? {})) {
          if (!dependency.startsWith("@verified-sudoku/") &&
              !allowedExternalDependencies.some((allowed) =>
                matchesDependencyPattern(dependency, allowed))) {
            errors.push(`${packagePath}: pure production boundary forbids external dependency ${dependency}`);
          }
        }
      }
    }
  }

  const discoveredPackageFiles = [
    ...project.walkFiles("packages", { extension: "package.json" }),
    ...project.walkFiles("apps", { extension: "package.json" }),
    ...project.walkFiles("tools", { extension: "package.json" }),
  ];
  for (const packageFile of discoveredPackageFiles) {
    const workspacePath = path.posix.dirname(packageFile);
    const name = project.readJson(packageFile).name;
    const configuredName = configuredPaths.get(workspacePath);
    if (!configuredName) {
      errors.push(`${packageFile}: workspace path ${workspacePath} is absent from config/architecture.json`);
    } else if (configuredName !== name) {
      errors.push(`${packageFile}: configured path ${workspacePath} belongs to ${configuredName}, found ${name}`);
    }
  }

  if (discoveredNames.size !== configuredNames.size) {
    errors.push("config/architecture.json and discovered workspaces differ");
  }

  const rootManifest = project.readJson("package.json");
  const requiredWorkspacePatterns = ["apps/*", "packages/*", "tools/*"];
  const rootWorkspacePatterns = Array.isArray(rootManifest.workspaces)
    ? [...rootManifest.workspaces].sort()
    : [];
  if (JSON.stringify(rootWorkspacePatterns) !== JSON.stringify([...requiredWorkspacePatterns].sort())) {
    errors.push(`package.json: workspaces must be exactly ${requiredWorkspacePatterns.join(", ")}`);
  }
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    for (const [dependency, specifier] of Object.entries(rootManifest[field] ?? {})) {
      const specViolation = dependencySpecViolation(dependency, specifier, false);
      if (specViolation) {
        errors.push(`package.json: ${specViolation}`);
      }
    }
  }

  const rootTsconfig = project.readJson("tsconfig.json");
  for (const option of semanticCheckDisablingOptions) {
    if (rootTsconfig.compilerOptions?.[option] === true) {
      errors.push(`tsconfig.json: compilerOptions.${option} must not be true`);
    }
  }
  const rootReferences = new Set(
    (rootTsconfig.references ?? []).map((reference) =>
      path.normalize(reference.path).replaceAll("\\", "/"),
    ),
  );
  const configuredProjectPaths = new Set(Object.values(config.workspaces).map((rule) => rule.path));
  for (const configuredPath of configuredProjectPaths) {
    if (!rootReferences.has(configuredPath)) {
      errors.push(`tsconfig.json: missing project reference ${configuredPath}`);
    }
  }
  for (const rootReference of rootReferences) {
    if (!configuredProjectPaths.has(rootReference)) {
      errors.push(`tsconfig.json: unknown project reference ${rootReference}`);
    }
  }

  const cycle = findDependencyCycle(graph);
  if (cycle) {
    errors.push(`workspace dependency cycle: ${cycle.join(" -> ")}`);
  }

  const browserPackages = browserPackageNames;
  const nodeOnlyPackages = new Set(config.nodeOnlyPackages ?? config.providerPackages ?? []);
  const browserForbiddenDependencies = config.browserForbiddenDependencies ?? [];
  for (const browserPackage of browserPackages) {
    const reachable = new Set();
    const queue = [browserPackage];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || reachable.has(current)) {
        continue;
      }
      reachable.add(current);
      queue.push(...(graph.get(current) ?? []));
    }
    for (const nodeOnlyPackage of nodeOnlyPackages) {
      if (reachable.has(nodeOnlyPackage)) {
        errors.push(`${browserPackage}: browser dependency graph reaches ${nodeOnlyPackage}`);
      }
    }
    for (const reachablePackage of reachable) {
      const reachablePath = config.workspaces[reachablePackage]?.path;
      if (!reachablePath) {
        continue;
      }
      const manifest = project.readJson(`${reachablePath}/package.json`);
      for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
        for (const dependency of Object.keys(manifest[field] ?? {})) {
          if (browserForbiddenDependencies.some((pattern) =>
            matchesDependencyPattern(dependency, pattern))) {
            errors.push(`${reachablePath}/package.json: browser-safe graph forbids dependency ${dependency}`);
          }
        }
      }
      for (const sourceFile of workspaceSourceFiles(`${reachablePath}/src`, project.walkFiles)) {
        for (const violation of classifyBrowserSource(
          project.readText(sourceFile),
          browserForbiddenDependencies,
        )) {
          errors.push(`${sourceFile}: browser-safe graph forbids ${violation}`);
        }
      }
      for (const htmlFile of project.walkFiles(reachablePath, {
        excludedDirectories: ["dist", "node_modules"],
        extension: ".html",
      })) {
        for (const violation of classifyBrowserHtml(project.readText(htmlFile))) {
          errors.push(`${htmlFile}: browser entry HTML forbids ${violation}`);
        }
      }
    }
  }

  const systemDoc = project.readText("docs/architecture/system.md");
  for (const name of configuredNames) {
    if (!systemDoc.includes(name)) {
      errors.push(`docs/architecture/system.md: missing workspace ${name}`);
    }
  }

  return errors;
}

export function verifyArchitecture() {
  return verifyArchitectureAtRoot(fromRoot());
}

if (isEntrypoint(import.meta.url)) {
  reportErrors("Architecture verification", verifyArchitecture());
}
