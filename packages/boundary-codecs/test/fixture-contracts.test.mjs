import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { canonicalJson, createPuzzle, createTopology } from "@verified-sudoku/domain";
import * as schemas from "@verified-sudoku/contracts";
import * as codecs from "../dist/index.js";
import { fixturePuzzle, fixtureExamples } from "./fixture-examples.mjs";

const success = (value) => { assert.equal(value.ok, true, JSON.stringify(value)); return value.value; };
const reject = (value, code) => { assert.deepEqual(value, { ok: false, code }); };
const puzzle = success(codecs.decodePuzzle(canonicalJson(fixturePuzzle)));
const decoders = { receipt: (input) => codecs.decodeUnverifiedUniquenessReceipt(input, puzzle),
  manifest: codecs.decodeUnverifiedFixtureManifest, registry: codecs.decodeUnverifiedFixtureRegistry };
const shapes = { receipt: schemas.uniquenessReceiptV1Schema, manifest: schemas.fixtureManifestV1Schema,
  registry: schemas.fixtureRegistryV1Schema };

for (const [kind, example] of Object.entries(fixtureExamples)) {
  test(`${kind} artifact: exact required shape, canonical round trip and unverified result`, () => {
    assert.equal(shapes[kind].safeParse(example).success, true);
    const result = success(decoders[kind](canonicalJson(example)));
    assert.equal(result.verification, "unverified");
    assert.equal(canonicalJson(result.dto), canonicalJson(example));
    assert.deepEqual(Object.keys(result).sort(), ["dto", "verification"]);
    assert.ok(Object.isFrozen(result) && Object.isFrozen(result.dto));
    for (const key of Object.keys(example)) {
      const missing = structuredClone(example); delete missing[key];
      reject(decoders[kind](canonicalJson(missing)), "shape");
      reject(decoders[kind](canonicalJson({ ...example, [key]: null })), "shape");
    }
    for (const version of [0, 2, "1"]) reject(decoders[kind](canonicalJson({ ...example, version })), "shape");
    reject(decoders[kind](example), "syntax");
  });
}

test("artifact readers reject unknown nested fields and noncanonical bytes", () => {
  for (const [kind, example] of Object.entries(fixtureExamples)) {
    function visit(value, path) {
      if (!value || typeof value !== "object") return;
      if (!Array.isArray(value)) {
        const copy = structuredClone(example); let target = copy;
        for (const key of path) target = target[key];
        target.extra = true;
        reject(decoders[kind](canonicalJson(copy)), "shape");
      }
      for (const [key, child] of Object.entries(value)) visit(child, [...path, key]);
    }
    visit(example, []);
    const canonical = canonicalJson(example);
    for (const malformed of [canonical + "\n", " " + canonical, `\ufeff${canonical}`, JSON.stringify(example, null, 2),
      canonical.replace('"version":1', '"version":1,"version":1'), canonical.replace('"version":1', '"version":1.0')]) {
      reject(decoders[kind](malformed), "syntax");
    }
  }
});

test("artifact readers enforce their independent byte and depth ceilings", () => {
  for (const [kind, [bytes, depth]] of Object.entries({ receipt: [1024, 2], manifest: [32768, 5], registry: [1024, 3] })) {
    const text = canonicalJson(fixtureExamples[kind]);
    reject(decoders[kind](text + " ".repeat(bytes - text.length + 1)), "size");
    // Same-size text remains transport-valid, but noncanonical file bytes are rejected.
    reject(decoders[kind](text + " ".repeat(bytes - text.length)), "syntax");
    reject(decoders[kind]("[".repeat(depth + 1) + "0" + "]".repeat(depth + 1)), "size");
  }
});

test("receipt binds a trusted 9x9 puzzle but never proves the claimed uniqueness", () => {
  // Fixing the first three formula rows leaves many solutions (including swaps of blank lower bands).
  assert.equal(success(decoders.receipt(canonicalJson(fixtureExamples.receipt))).verification, "unverified");
  reject(codecs.decodeUnverifiedUniquenessReceipt(canonicalJson(fixtureExamples.receipt), { ...puzzle }), "reference");
  const six = createPuzzle(createTopology(6), []);
  const sixContext = success(codecs.decodePuzzle(canonicalJson({ ...fixturePuzzle, topology: six.topology,
    givens: [], puzzleFingerprint: six.puzzleFingerprint })));
  reject(codecs.decodeUnverifiedUniquenessReceipt(canonicalJson({ ...fixtureExamples.receipt,
    puzzleFingerprint: six.puzzleFingerprint }), sixContext), "reference");
  reject(decoders.receipt(canonicalJson({ ...fixtureExamples.receipt, puzzleFingerprint: `sha256:${"0".repeat(64)}` })), "reference");
  reject(decoders.receipt(canonicalJson({ ...fixtureExamples.receipt, solutionCount: 2 })), "shape");
});

test("manifest rejects mismatched seeds, counts, early indices and transform order", () => {
  const example = fixtureExamples.manifest;
  const malformed = [{ ...example, attempt: 1 }, { ...example, stepCount: 4 },
    { ...example, firstLockedStep: 4 }, { ...example, firstLockedStep: 2 },
    { ...example, techniqueCounts: { ...example.techniqueCounts, "naked-pair": 0, "naked-single": 2 } },
    { ...example, techniqueCounts: { ...example.techniqueCounts, "locked-pointing": 0, "hidden-single": 1 } },
    { ...example, transforms: [...example.transforms].reverse() },
    { ...example, transforms: example.transforms.map((entry) => ({ ...entry, id: "d4-0" })) }];
  for (const dto of malformed) reject(decoders.manifest(canonicalJson(dto)), "semantic");
  for (const dto of [{ ...example, attempt: 1000000 }, { ...example, seed: "vsc-fixture/v1:01" },
    { ...example, givensCount: 26 }, { ...example, firstLockedStep: 21 },
    { ...example, transforms: example.transforms.slice(1) }, { ...example, limitations: ["nonuniform"] }]) {
    reject(decoders.manifest(canonicalJson(dto)), "shape");
  }
  const boundary = { ...example, attempt: 999999, seed: "vsc-fixture/v1:999999", givensCount: 30,
    stepCount: 810, firstLockedStep: 20, firstNakedPairStep: 19,
    techniqueCounts: { ...example.techniqueCounts, "naked-single": 808 } };
  assert.equal(success(decoders.manifest(canonicalJson(boundary))).verification, "unverified");
});

test("artifact paths are exact per role and hashes remain unverified claims", () => {
  for (const key of ["puzzle", "proofPath", "uniquenessReceipt"]) {
    for (const path of ["../puzzle.json", "https://example.invalid/puzzle.json", "fixtures/manifest.json",
      fixtureExamples.manifest[key].path + "/extra"]) {
      reject(decoders.manifest(canonicalJson({ ...fixtureExamples.manifest,
        [key]: { ...fixtureExamples.manifest[key], path } })), "shape");
    }
  }
  const registry = fixtureExamples.registry;
  reject(decoders.registry(canonicalJson({ ...registry, fixtures: [] })), "shape");
  reject(decoders.registry(canonicalJson({ ...registry, fixtures: [...registry.fixtures, ...registry.fixtures] })), "shape");
  const changedHash = { ...registry, fixtures: [{ ...registry.fixtures[0], hash: `sha256:${"0".repeat(64)}` }] };
  assert.equal(success(decoders.registry(canonicalJson(changedHash))).verification, "unverified");
});

test("committed fixture compatibility claims match their original synthetic construction", () => {
  assert.equal(fs.readFileSync(new URL("../../../docs/contracts/examples/fixture-artifacts-v1.json", import.meta.url), "utf8").trimEnd(),
    canonicalJson({ puzzle: fixturePuzzle, ...fixtureExamples }));
});
