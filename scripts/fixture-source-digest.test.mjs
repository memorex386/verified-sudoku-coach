import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { generatorSourceDigest } from "./fixture-source-digest.mjs";

function repository(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vsc-source-"));
  const git = (...args) => execFileSync("git", ["-C", directory, "-c", "core.autocrlf=false", ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const write = (name, contents) => {
    fs.mkdirSync(path.dirname(path.join(directory, name)), { recursive: true });
    fs.writeFileSync(path.join(directory, name), contents);
  };
  try {
    git("init", "--quiet");
    write("packages/testing/src/fixtures/z.mjs", "export {};\r\n");
    write("packages/domain/src/a.ts", "export {};\n");
    write("packages/proof-engine/src/index.ts", "export {};\n");
    git("add", "--all");
    run({ directory, git, write });
  } finally {
    const target = fs.realpathSync(directory);
    assert.equal(path.dirname(target), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(target).startsWith("vsc-source-"));
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5 });
  }
}

test("source digest matches independent raw-byte and canonical projection hashes", () => repository(({ directory }) => {
  const files = ["packages/domain/src/a.ts", "packages/proof-engine/src/index.ts", "packages/testing/src/fixtures/z.mjs"]
    .map(name => ({ hash: `sha256:${createHash("sha256").update(fs.readFileSync(path.join(directory, name))).digest("hex")}`, path: name }));
  const expected = `sha256:${createHash("sha256").update("vsc/generator-source/v1\0" + JSON.stringify(files)).digest("hex")}`;
  assert.equal(generatorSourceDigest(directory), expected);
  assert.equal(generatorSourceDigest(directory), expected);
}));

test("source digest binds edits, line endings and names; excludes untracked and unrelated files", () => repository(({ directory, git, write }) => {
  const original = generatorSourceDigest(directory);
  write("packages/domain/src/new.ts", "export {};\n");
  write("docs/outside.ts", "outside");
  write("packages/domain/src/readme.md", "outside extension");
  assert.equal(generatorSourceDigest(directory), original);
  git("add", "--all");
  const added = generatorSourceDigest(directory);
  assert.notEqual(added, original);
  write("packages/domain/src/a.ts", "export {};\r\n");
  const edited = generatorSourceDigest(directory);
  assert.notEqual(edited, added);
  git("add", "--all");
  assert.equal(generatorSourceDigest(directory), edited);
  git("mv", "packages/domain/src/a.ts", "packages/domain/src/b.ts");
  assert.notEqual(generatorSourceDigest(directory), edited);
}));

test("source digest fails on missing files, merge stages and source links", () => repository(({ directory, git, write }) => {
  const name = "packages/domain/src/a.ts", oid = git("hash-object", name);
  fs.unlinkSync(path.join(directory, name));
  assert.throws(() => generatorSourceDigest(directory), /invalid-generator-source/);
  write(name, "export {};\n");
  git("update-index", "--cacheinfo", `120000,${oid},${name}`);
  assert.throws(() => generatorSourceDigest(directory), /invalid-generator-source/);
  execFileSync("git", ["-C", directory, "update-index", "--index-info"], {
    input: `0 ${"0".repeat(40)}\t${name}\n100644 ${oid} 1\t${name}\n`, stdio: ["pipe", "pipe", "pipe"] });
  assert.throws(() => generatorSourceDigest(directory), /invalid-generator-source/);
  git("add", name);
  const source = path.join(directory, "packages/domain/src"), moved = path.join(directory, "moved");
  fs.renameSync(source, moved);
  fs.symlinkSync(moved, source, process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => generatorSourceDigest(directory), /invalid-generator-source/);
}));
