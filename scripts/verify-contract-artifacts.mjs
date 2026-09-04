import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import * as schemas from "@verified-sudoku/contracts";
import * as codecs from "@verified-sudoku/boundary-codecs";
import { canonicalJson } from "@verified-sudoku/domain";
import { examples } from "../packages/boundary-codecs/test/examples.mjs";
import { fromRoot } from "./lib/project.mjs";

const write = process.argv.includes("--write");
const require = createRequire(import.meta.url);
for (const name of ["domain", "contracts", "boundary-codecs"]) {
  const esm = await import(`@verified-sudoku/${name}`);
  const commonjs = require(`@verified-sudoku/${name}`);
  assert.equal(commonjs[Object.keys(esm)[0]], esm[Object.keys(esm)[0]]);
  await assert.rejects(import(`@verified-sudoku/${name}/src/index.ts`), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
}
const artifact = (relative, content) => {
  const destination = fromRoot(relative);
  if (write) {
    fs.mkdirSync(fromRoot(relative.slice(0, relative.lastIndexOf("/"))), { recursive: true });
    fs.writeFileSync(destination, content);
  } else assert.equal(fs.readFileSync(destination, "utf8").replaceAll("\r\n", "\n"), content, `Artifact drift: ${relative}`);
};
for (const [name, schema] of Object.entries(schemas)) {
  artifact(`docs/contracts/schemas/${name}.json`, `${JSON.stringify(schema.toJSONSchema({ target: "draft-2020-12", reused: "ref" }), null, 2)}\n`);
}
assert.deepEqual(fs.readdirSync(fromRoot("docs/contracts/schemas")).sort(),
  Object.keys(schemas).map((name) => `${name}.json`).sort(), "Unexpected or stale schema artifact");
artifact("docs/contracts/examples/board-proof-v1.json", `${canonicalJson(examples)}\n`);
const api = {};
for (const name of ["contracts", "boundary-codecs"]) {
  api[name] = Object.fromEntries(fs.readdirSync(fromRoot(`packages/${name}/dist`)).filter((file) => file.endsWith(".d.ts")).sort().map((file) =>
    [file, createHash("sha256").update(fs.readFileSync(fromRoot(`packages/${name}/dist/${file}`), "utf8").replaceAll("\r\n", "\n")).digest("hex")]));
}
artifact("docs/contracts/board-proof-api-v1.json", `${JSON.stringify({ schemaId: "vsc.board-proof-api", version: 1,
  declarations: api, schemaExports: Object.keys(schemas).sort(), codecExports: Object.keys(codecs).sort() }, null, 2)}\n`);
console.log(write ? "Generated contract schemas, API hashes and synthetic examples." : "Contract schemas, API hashes and synthetic examples passed.");
