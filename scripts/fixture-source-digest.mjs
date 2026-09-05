import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fingerprint } from "@verified-sudoku/domain";

const roots = ["packages/domain/src", "packages/proof-engine/src", "packages/testing/src/fixtures"];
const sourceFile = (name) => roots.some((root) => name.startsWith(`${root}/`)) && /\.(ts|mjs)$/.test(name);
const fail = () => { throw new Error("invalid-generator-source"); };

/** Hash current tracked source bytes, not Git blob IDs; never follows source symlinks. */
export function generatorSourceDigest(directory) {
  try {
    const root = fs.realpathSync(directory);
    const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (fs.realpathSync(git("rev-parse", "--show-toplevel").trim()) !== root) fail();
    const files = [];
    for (const entry of git("ls-files", "--stage", "-z", "--", ...roots).split("\0").filter(Boolean)) {
      const match = /^(\d{6}) [0-9a-f]+ (\d)\t([\s\S]+)$/.exec(entry);
      if (!match) fail();
      const [, mode, stage, name] = match;
      if (!sourceFile(name)) continue;
      if (!["100644", "100755"].includes(mode) || stage !== "0") fail();
      let target = root;
      const parts = name.split("/");
      for (const [i, part] of parts.entries()) {
        target = path.join(target, part);
        const stat = fs.lstatSync(target);
        if (stat.isSymbolicLink() || (i === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) fail();
      }
      const hash = `sha256:${createHash("sha256").update(fs.readFileSync(target)).digest("hex")}`;
      files.push({ path: name, hash });
    }
    files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    return fingerprint("generator-source", files);
  } catch {
    fail();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2) fail();
    console.log(generatorSourceDigest(fileURLToPath(new URL("..", import.meta.url))));
  } catch {
    console.error("invalid-generator-source");
    process.exitCode = 1;
  }
}
