import assert from "node:assert/strict";
import test from "node:test";
import { inspectEntry, consumerLock } from "./lib/package-conformance.mjs";

test("packed entry inspection rejects escape paths, links, source artifacts and platform leakage", () => {
  inspectEntry("package/dist/index.js", "File", "export {};");
  for (const name of ["package/../secret", "package/src/index.ts", "package/dist/index.js.map", "package/dist/build.tsbuildinfo"]) {
    assert.throws(() => inspectEntry(name, "File", ""));
  }
  assert.throws(() => inspectEntry("package/dist/index.js", "SymbolicLink", ""));
  for (const value of ["import 'node:fs';", "import 'fs';", "Date.now();", "Math.random();",
    "fetch('x')", "import '@angular/core';", "//# sourceMappingURL=x"]) {
    assert.throws(() => inspectEntry("package/dist/index.js", "File", value));
  }
});

test("consumer locks remove workspace links and bind local tarball integrity", () => {
  const external = { version: "1.0.0", integrity: "registry-integrity" };
  const manifest = { name: "test", version: "0.0.0", dependencies: { "@verified-sudoku/domain": "file:../tarballs/domain.tgz" } };
  const lock = consumerLock({ packages: { "": {}, "packages/domain": {},
    "node_modules/@verified-sudoku/domain": { link: true }, "node_modules/external": external } }, manifest,
  [{ manifest: { name: "@verified-sudoku/domain", version: "0.0.0", license: "Apache-2.0" }, integrity: "actual-integrity" }]);
  assert.equal(lock.packages["packages/domain"], undefined);
  assert.equal(lock.packages["node_modules/external"], external);
  assert.equal(lock.packages["node_modules/@verified-sudoku/domain"].integrity, "actual-integrity");
  assert.equal(lock.packages["node_modules/@verified-sudoku/domain"].link, undefined);
});
