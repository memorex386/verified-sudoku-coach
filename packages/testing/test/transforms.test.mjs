import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { classicTransformSuite, normalizeDigits, normalizeDigitD4, fixtureCollisionKeys,
  generateCandidate, transformGrid } from "../dist/index.js";
import { exactCoverCount } from "./exact-cover.mjs";

const grid = generateCandidate("vsc-fixture/v1:0").grid;
const nativeFingerprint = (name, value) => `sha256:${createHash("sha256")
  .update(`vsc/${name}/v1\0${JSON.stringify(value)}`).digest("hex")}`;
const rows = (value) => value.match(/.{9}/g);
const cycle = (value) => value.replace(/[1-9]/g, (d) => d === "9" ? "1" : String(Number(d) + 1));
const bands = (value) => { const r = rows(value); return [...r.slice(3, 6), ...r.slice(0, 3), ...r.slice(6)].join(""); };
const stacks = (value) => rows(value).map((r) => r.slice(3, 6) + r.slice(0, 3) + r.slice(6)).join("");
const firstRows = (value) => { const r = rows(value); return [r[1], r[0], ...r.slice(2)].join(""); };
const firstColumns = (value) => rows(value).map((r) => r[1] + r[0] + r.slice(2)).join("");
const transforms = [cycle, bands, stacks, firstRows, firstColumns];
const normalized = (value) => {
  const symbols = [...new Set(value.replaceAll("0", ""))];
  return [...value].map((d) => d === "0" ? "0" : String(symbols.indexOf(d) + 1)).join("");
};
const matrixOrbit = (value) => {
  const original = rows(value).map((r) => [...r]);
  const results = [];
  for (let matrix of [original, original.map((r) => [...r].reverse())]) {
    for (let i = 0; i < 4; i++) {
      results.push(matrix.flat().join(""));
      matrix = matrix[0].map((_, c) => matrix.map((r) => r[c]).reverse());
    }
  }
  return results;
};

test("14-record suite has exact order and agrees with independent slice/matrix transforms", () => {
  const suite = classicTransformSuite(grid);
  assert.deepEqual(suite.map((entry) => entry.id), ["d4-0", "d4-1", "d4-2", "d4-3", "d4-4", "d4-5", "d4-6", "d4-7",
    "digit-cycle", "band-swap", "stack-swap", "row-swap", "column-swap", "composition"]);
  const expected = [...matrixOrbit(grid), ...transforms.map((fn) => fn(grid)), transforms.reduce((value, fn) => fn(value), grid)];
  assert.deepEqual(suite.map((entry) => entry.grid), expected);
  assert.notEqual(expected.at(-1), firstColumns(stacks(bands(firstRows(cycle(grid))))));
  assert.throws(() => { suite.push(suite[0]); });
  assert.throws(() => { suite[0].grid = "0".repeat(81); });
});

test("every grid transform preserves uniqueness/clue counts and has a correct domain fingerprint", () => {
  for (const attempt of [0, 42]) {
    const source = generateCandidate(`vsc-fixture/v1:${attempt}`).grid;
    for (const entry of classicTransformSuite(source)) {
      assert.equal(exactCoverCount(entry.grid), 1);
      assert.equal(entry.grid.replaceAll("0", "").length, source.replaceAll("0", "").length);
      const givens = [...entry.grid].flatMap((d, i) => d === "0" ? [] : [{ cellId: `r${Math.floor(i / 9) + 1}c${i % 9 + 1}`, digit: Number(d) }]);
      assert.equal(entry.puzzleFingerprint, nativeFingerprint("puzzle", { givens,
        topology: { boxColumns: 3, boxRows: 3, size: 9, type: "classic" } }));
    }
  }
});

test("normalization uses first occurrence, retains zero positions, and is idempotent", () => {
  const sparse = "909030550" + "0".repeat(72);
  assert.equal(normalizeDigits(sparse), "101020330" + "0".repeat(72));
  for (const source of [grid, sparse, "0".repeat(81)]) {
    assert.equal(normalizeDigits(source), normalized(source));
    assert.equal(normalizeDigits(normalizeDigits(source)), normalizeDigits(source));
    assert.equal(normalizeDigitD4(source), matrixOrbit(source).map(normalized).sort()[0]);
    assert.equal(normalizeDigitD4(normalizeDigitD4(source)), normalizeDigitD4(source));
  }
});

test("collision equivalence covers D4 and arbitrary digit relabeling without changing exact identity", () => {
  const keys = fixtureCollisionKeys(grid);
  const permutations = ["123456789", "987654321", "381957264", "234567891"];
  for (const permutation of permutations) for (let d4 = 0; d4 < 8; d4++) {
    const source = transformGrid(grid, d4).replace(/[1-9]/g, (d) => permutation[Number(d) - 1]);
    const result = fixtureCollisionKeys(source);
    assert.equal(result.publicNormalizedKeyHash, keys.publicNormalizedKeyHash);
    assert.equal(result.publicExactKeyHash === keys.publicExactKeyHash, source === grid);
  }
  const changed = "0" + grid.slice(1);
  assert.notEqual(fixtureCollisionKeys(changed).publicNormalizedKeyHash, keys.publicNormalizedKeyHash);
  // Band/stack/row/column swaps are test transforms, not added collision equivalences.
  assert.notEqual(normalizeDigitD4(bands(grid)), normalizeDigitD4(grid));
});

test("collision hashes bind exact canonical string bytes and typed projection names", () => {
  const keys = fixtureCollisionKeys(grid);
  assert.equal(keys.publicExactKeyHash, nativeFingerprint("fixture-exact", grid));
  assert.equal(keys.publicNormalizedKeyHash, nativeFingerprint("fixture-digit-d4", matrixOrbit(grid).map(normalized).sort()[0]));
  // Independently reproduced with Python hashlib and matrix rotations from the public seed-zero grid.
  assert.equal(normalizeDigitD4(grid), "001000023450300010000016000107058000090000070000470809000840000080005061520000700");
  assert.deepEqual(keys, {
    publicExactKeyHash: "sha256:045a27cc36ba4a748a3791c45c076032cd0365c2134c9eacb468a53bf7221463",
    publicNormalizedKeyHash: "sha256:41e659177a02a440e2399109690d27e044d04fa7dcc0f947b3e3efe698628e43",
  });
  assert.notEqual(keys.publicExactKeyHash, nativeFingerprint("fixture-digit-d4", grid));
  assert.throws(() => { keys.publicExactKeyHash = "changed"; });
});

test("empty grids retain all transform records; key normalization does not claim puzzle validity", () => {
  const empty = "0".repeat(81), suite = classicTransformSuite(empty);
  assert.equal(suite.length, 14);
  assert.equal(new Set(suite.map((entry) => entry.grid)).size, 1);
  assert.equal(new Set(suite.map((entry) => entry.puzzleFingerprint)).size, 1);
  assert.equal(normalizeDigitD4(empty), empty);
  const conflicting = "11" + "0".repeat(79);
  assert.throws(() => classicTransformSuite(conflicting), /conflicting-givens/);
  assert.equal(normalizeDigits(conflicting), conflicting);
  assert.equal(fixtureCollisionKeys(conflicting).publicExactKeyHash, nativeFingerprint("fixture-exact", conflicting));
});

test("transform and collision helpers reject malformed grid strings", () => {
  for (const input of [null, {}, [], 0, "", "0".repeat(36), "0".repeat(80), "0".repeat(82),
    `${grid}\n`, `${grid} `, "０".repeat(81)]) {
    for (const fn of [classicTransformSuite, normalizeDigits, normalizeDigitD4, fixtureCollisionKeys]) {
      assert.throws(() => fn(input), /invalid-grid/);
    }
  }
});
