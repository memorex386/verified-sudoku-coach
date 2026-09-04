import assert from "node:assert/strict";
import { classifyText } from "../verify-public-boundary.mjs";
import { classifyBrowserSource, classifyPureSource } from "../verify-architecture.mjs";
import { browserBoundaryFromProviderPolicy } from "./provider-policy.mjs";
import { readJson } from "./project.mjs";

const browserBoundary = browserBoundaryFromProviderPolicy(readJson("config/provider-policy.json"));

export function inspectEntry(name, type, text) {
  assert.deepEqual(classifyText(text), [], "private material in packed content");
  assert.equal(type, "File", "tar entries must be regular files");
  assert.match(name, /^package\/(?:package\.json|LICENSE|README\.md|dist\/[a-z][a-z0-9-]*\.(?:js|d\.ts))$/, "unexpected packed path");
  if (name.endsWith(".js") || name.endsWith(".d.ts")) {
    assert.deepEqual(classifyBrowserSource(text, browserBoundary), [], "browser boundary violation");
    assert.deepEqual(classifyPureSource(text, ["zod"]), [], "nonportable code or dependency");
    assert.doesNotMatch(text, /sourceMappingURL|[A-Za-z]:[\\/]|\/(?:Users|home)\/|\bnode:|\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(|\b(?:openai|anthropic|firebase|angular)\b/i, "nonportable packed content");
  }
}

// Reuse the reviewed registry lock, replacing only workspace links with exact packed artifacts.
export function consumerLock(rootLock, manifest, packages) {
  const records = { "": manifest };
  for (const [name, value] of Object.entries(rootLock.packages)) {
    if (name.startsWith("node_modules/") && !value.link) records[name] = value;
  }
  for (const packed of packages) {
    records[`node_modules/${packed.manifest.name}`] = {
      version: packed.manifest.version, resolved: manifest.dependencies[packed.manifest.name],
      integrity: packed.integrity, license: packed.manifest.license,
      ...(packed.manifest.dependencies ? { dependencies: packed.manifest.dependencies } : {}),
    };
  }
  return { name: manifest.name, version: manifest.version, lockfileVersion: 3, requires: true, packages: records };
}
