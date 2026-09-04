#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { list } from "tar";
import { chromium } from "playwright";
import { fromRoot, readJson } from "./lib/project.mjs";
import { inspectEntry, consumerLock } from "./lib/package-conformance.mjs";

const require = createRequire(import.meta.url);
const names = ["domain", "contracts", "proof-engine", "coach-core", "boundary-codecs"];
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const npmCli = process.env.npm_execpath ?? path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
assert.ok(fs.existsSync(npmCli), "run via npm with the pinned toolchain");
assert.equal(process.versions.node.split(".")[0], "22");
const run = (args, cwd, { inherit = false } = {}) => {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8", timeout: 240000,
    maxBuffer: 8 * 1024 * 1024, stdio: inherit ? "inherit" : "pipe" });
  if (result.status !== 0) throw new Error(`consumer command failed: ${args[0].split(/[\\/]/).at(-1)}\n${result.stderr ?? ""}\n${result.stdout ?? ""}`);
  return result.stdout;
};

async function inspectTar(file) {
  const contents = new Map();
  const pending = [];
  await list({ file, strict: true, onReadEntry(entry) {
    const chunks = [];
    pending.push(new Promise((resolve, reject) => {
      entry.on("data", (chunk) => chunks.push(chunk));
      entry.on("error", reject);
      entry.on("end", () => {
        try {
          const bytes = Buffer.concat(chunks);
          inspectEntry(entry.path, entry.type, bytes.toString("utf8"));
          assert.ok(!contents.has(entry.path), "duplicate tar entry");
          contents.set(entry.path, bytes);
          resolve();
        } catch (error) { reject(error); }
      });
    }));
  } });
  await Promise.all(pending);
  assert.ok(contents.has("package/dist/index.js") && contents.has("package/dist/index.d.ts"));
  return contents;
}

fs.mkdirSync(fromRoot(".tmp"), { recursive: true });
const temp = fs.mkdtempSync(fromRoot(".tmp", "pack-"));
let server, browser;
try {
  const tarballs = path.join(temp, "tarballs");
  const repeat = path.join(temp, "repeat");
  fs.mkdirSync(tarballs); fs.mkdirSync(repeat);
  const packages = [];
  const pack = (destination) => JSON.parse(run([npmCli, "pack", "--ignore-scripts", "--offline", "--json",
    "--pack-destination", destination, ...names.flatMap((name) => ["--workspace", `@verified-sudoku/${name}`])], fromRoot()));
  const firstPass = pack(tarballs), secondPass = pack(repeat);
  for (const name of names) {
    const first = firstPass.find((p) => p.name === `@verified-sudoku/${name}`);
    const second = secondPass.find((p) => p.name === `@verified-sudoku/${name}`);
    const bytes = fs.readFileSync(path.join(tarballs, first.filename));
    assert.deepEqual(bytes, fs.readFileSync(path.join(repeat, second.filename)), "repeat pack bytes differ");
    assert.equal(first.integrity, `sha512-${createHash("sha512").update(bytes).digest("base64")}`);
    const contents = await inspectTar(path.join(tarballs, first.filename));
    const manifest = JSON.parse(contents.get("package/package.json"));
    assert.deepEqual(Object.keys(manifest.exports), ["."]);
    assert.deepEqual(manifest.exports["."], { types: "./dist/index.d.ts", import: "./dist/index.js", require: "./dist/index.js", default: "./dist/index.js" });
    packages.push({ name, manifest, filename: first.filename, integrity: first.integrity, sha256: digest(bytes), contents });
  }
  console.log("Five packages: repeat tarball bytes, sealed exports and content inspection passed.");
  const rootManifest = readJson("package.json"), rootLock = readJson("package-lock.json");
  let nodeResult;
  for (const kind of ["commonjs", "angular"]) {
    const consumer = path.join(temp, kind);
    fs.mkdirSync(consumer);
    const manifest = { name: `conformance-${kind}`, version: "0.0.0", private: true,
      type: kind === "commonjs" ? "commonjs" : "module",
      dependencies: Object.fromEntries(packages.map((p) => [p.manifest.name, `file:../tarballs/${p.filename}`])),
      devDependencies: rootManifest.devDependencies };
    writeJson(path.join(consumer, "package.json"), manifest);
    writeJson(path.join(consumer, "package-lock.json"), consumerLock(rootLock, manifest, packages));
    run([npmCli, "ci", "--ignore-scripts", "--offline", "--no-audit", "--no-fund"], consumer);
    for (const packed of packages) {
      const installed = path.join(consumer, "node_modules", packed.manifest.name);
      assert.equal(fs.lstatSync(installed).isSymbolicLink(), false);
      assert.ok(fs.realpathSync(installed).startsWith(`${fs.realpathSync(consumer)}${path.sep}`));
      for (const [entry, bytes] of packed.contents) {
        assert.deepEqual(fs.readFileSync(path.join(installed, entry.slice("package/".length))), bytes);
      }
    }
    const fixture = fromRoot("scripts/fixtures/package-consumers");
    fs.copyFileSync(path.join(fixture, "probe.mjs"), path.join(consumer, "probe.mjs"));
    fs.writeFileSync(path.join(consumer, "examples.mjs"), `export const examples = ${JSON.stringify(readJson("docs/contracts/examples/board-proof-v1.json"))};\n`);
    // Both require() and import() must reject deep package paths in the installed consumer.
    fs.writeFileSync(path.join(consumer, "exports.cjs"), `const assert = require('node:assert/strict');
      (async () => { for (const name of ${JSON.stringify(packages.map((p) => p.manifest.name))}) {
        require(name); await import(name);
        for (const sub of ['/dist/index.js', '/src/index.ts', '/package.json']) {
          assert.throws(() => require(name + sub), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
          await assert.rejects(import(name + sub), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
        }
      } })().catch(() => { process.exitCode = 1; });`);
    run(["exports.cjs"], consumer);
    if (kind === "commonjs") {
      // Use actual require namespaces, avoiding a bundler's synthetic ESM default wrapper.
      const cjsProbe = fs.readFileSync(path.join(consumer, "probe.mjs"), "utf8")
        .replace(/^import \* as (\w+) from "(@verified-sudoku\/[a-z-]+)";$/gm, 'const $1 = require("$2");');
      fs.writeFileSync(path.join(consumer, "commonjs-input.mjs"), cjsProbe);
      run([require.resolve("esbuild/bin/esbuild"), "commonjs-input.mjs", "--bundle", "--packages=external", "--platform=node", "--format=cjs", "--outfile=probe.cjs"], consumer);
      fs.writeFileSync(path.join(consumer, "run.cjs"), "process.stdout.write(JSON.stringify(require('./probe.cjs').probe()));\n");
      nodeResult = JSON.parse(run(["run.cjs"], consumer));
      for (const vector of nodeResult.hashes) {
        assert.equal(vector.hash, digest(Uint8Array.from({ length: vector.length }, (_, i) => (i * 131 + 17) % 256)));
      }
      console.log("Clean Node 22 CommonJS consumer and independent native SHA-256 comparison passed.");
    } else {
      fs.copyFileSync(path.join(fixture, "angular.ts"), path.join(consumer, "angular.ts"));
      writeJson(path.join(consumer, "tsconfig.json"), { compilerOptions: {
        target: "ES2022", module: "ES2022", moduleResolution: "bundler", lib: ["ES2022", "DOM"],
        strict: true, experimentalDecorators: true, skipLibCheck: false, allowJs: true, outDir: "compiled",
      }, angularCompilerOptions: { strictTemplates: true, strictInjectionParameters: true }, files: ["angular.ts", "probe.mjs"] });
      const consumerRequire = createRequire(path.join(consumer, "package.json"));
      const compilerManifest = consumerRequire.resolve("@angular/compiler-cli/package.json");
      const compiler = JSON.parse(fs.readFileSync(compilerManifest, "utf8"));
      run([path.resolve(path.dirname(compilerManifest), compiler.bin.ngc), "-p", "tsconfig.json"], consumer);
      fs.copyFileSync(path.join(fixture, "bundle.mjs"), path.join(consumer, "bundle.mjs"));
      run(["bundle.mjs"], consumer);
      const cli = path.join(path.dirname(require.resolve("playwright/package.json")), "cli.js");
      if (!fs.existsSync(chromium.executablePath())) {
        console.log("Installing the lockfile-pinned Chromium test runtime.");
        run([cli, "install", ...(process.platform === "linux" ? ["--with-deps"] : []), "--no-shell", "chromium"], fromRoot(), { inherit: true });
      }
      const bundle = fs.readFileSync(path.join(consumer, "bundle.js"));
      server = createServer((request, response) => {
        if (request.url === "/bundle.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle); }
        else if (request.url === "/") { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><conformance-app></conformance-app><script type="module" src="/bundle.js"></script>'); }
        else { response.writeHead(404); response.end(); }
      });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const origin = `http://127.0.0.1:${server.address().port}`;
      browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
      const browserPin = JSON.parse(fs.readFileSync(path.join(path.dirname(require.resolve("playwright-core/package.json")), "browsers.json"), "utf8"))
        .browsers.find((entry) => entry.name === "chromium");
      assert.equal(browser.version(), browserPin.browserVersion);
      const page = await browser.newPage();
      const failures = [];
      page.on("pageerror", (error) => failures.push(error.message));
      await page.route("**/*", (route) => {
        if ([`${origin}/`, `${origin}/bundle.js`].includes(route.request().url())) return route.continue();
        failures.push("unexpected browser request"); return route.abort();
      });
      await page.goto(origin);
      try { await page.locator("conformance-app pre").waitFor(); }
      catch { throw new Error(`Angular browser did not render: ${failures.join("; ")}`); }
      const browserResult = JSON.parse(await page.locator("conformance-app pre").textContent());
      assert.deepEqual(failures, []);
      assert.deepEqual(browserResult, nodeResult, "Node/Chromium results diverged");
      console.log(`Strict Angular AOT and Chromium ${browser.version()} match the Node consumer.`);
      const evidence = { formatVersion: 1, scope: "Initial domain and wire-boundary compatibility; no technique or private conformance claim",
        toolchain: { nodeMajor: 22, npm: rootManifest.packageManager, typescript: rootManifest.devDependencies.typescript,
          angular: rootManifest.devDependencies["@angular/core"], playwright: rootManifest.devDependencies.playwright,
          chromium: browserPin.browserVersion, chromiumRevision: browserPin.revision },
        packages: packages.map((p) => ({ name: p.manifest.name, version: p.manifest.version, sha256: p.sha256, integrity: p.integrity,
          files: [...p.contents].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, bytes]) => ({ name, sha256: digest(bytes) })) })),
        result: nodeResult };
      const snapshot = fromRoot("docs/contracts/package-conformance-v1.json");
      if (process.argv.includes("--write")) writeJson(snapshot, evidence);
      else assert.deepEqual(JSON.parse(fs.readFileSync(snapshot, "utf8")), evidence, "package conformance snapshot drift; review before --write");
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  throw error;
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  // Verify the resolved deletion target stays a direct child of this workspace's scratch directory.
  const realTemp = fs.realpathSync(temp), scratch = fs.realpathSync(fromRoot(".tmp"));
  assert.equal(path.dirname(realTemp), scratch);
  assert.ok(path.basename(realTemp).startsWith("pack-"));
  fs.rmSync(realTemp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
console.log("Packed-package conformance passed.");
