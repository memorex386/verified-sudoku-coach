import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { fromRoot } from "./lib/project.mjs";

const files = fs.readdirSync(fromRoot("packages/domain/dist")).filter((file) => file.endsWith(".d.ts")).sort();
const declarations = Object.fromEntries(files.map((file) => [file,
  fs.readFileSync(fromRoot(`packages/domain/dist/${file}`), "utf8").replaceAll("\r\n", "\n"),
]));
const snapshot = { schemaId: "vsc.domain-api", version: 1, declarations,
  sha256: createHash("sha256").update(JSON.stringify(declarations)).digest("hex") };
const destination = fromRoot("docs/contracts/domain-api-v1.json");
if (process.argv.includes("--write")) {
  fs.writeFileSync(destination, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log("Generated domain API snapshot.");
} else {
  assert.deepEqual(snapshot, JSON.parse(fs.readFileSync(destination, "utf8")), "Domain API drift; review and regenerate the snapshot.");
  console.log("Domain API snapshot passed.");
}
