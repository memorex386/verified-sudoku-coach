import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { fixtureAttempt, fixtureRandom, boundedDraw, countSolutions, generationPlan, generateCandidate, transformGrid } from "../dist/index.js";
import { exactCoverCount } from "./exact-cover.mjs";

const seed = "vsc-fixture/v1:0";
// Independently reproduced with Python hashlib/struct and matrix rotation from the public protocol.
const complete = "951273846273684195846195273327468519684519327195327684519732468468951732732846951";
const firstOrbitCells = [22, 40, 6, 17, 14, 37, 19, 12, 15, 3, 8, 11, 32, 4, 21, 31, 35, 23, 24, 18,
  5, 36, 1, 33, 28, 16, 2, 25, 9, 39, 27, 10, 20, 13, 38, 30, 26, 29, 7, 0, 34];
const candidateZero = "900003040270080090000005003007400010004509300090007600500700000060050032030800001";

test("seed grammar rejects noncanonical and out-of-range attempts", () => {
  assert.equal(fixtureAttempt(seed), 0);
  assert.equal(fixtureAttempt("vsc-fixture/v1:4294967295"), 4294967295);
  for (const bad of [null, 0, {}, "", "vsc-fixture/v1:00", "vsc-fixture/v1:-0", "vsc-fixture/v1:+1",
    "vsc-fixture/v1:1e2", "vsc-fixture/v1:1.0", "vsc-fixture/v1:4294967296", "vsc-fixture/v1:99999999999",
    "vsc-fixture/v1:１", `${seed}\n`, `${seed}\r\n`, `${seed} `, ` ${seed}`, `\ufeff${seed}`]) {
    assert.throws(() => fixtureRandom(bad), /invalid-fixture-seed/);
  }
});

test("SHA-derived xoshiro stream matches the fixed protocol vector and independent instances", () => {
  assert.equal(createHash("sha256").update(seed).digest("hex"), "240a7c14c6d86aee2075bcf99ab876588d60e3c2d5be0aa761969f281f80681f");
  const expected = [0x640d69f4, 0x7fbe8d51, 0xf503b300, 0xf58915c2, 0xa824d2e8,
    0x2b3b00c7, 0x9eb423ff, 0x67751345, 0x2ded0ebb, 0x44ea1457];
  const a = fixtureRandom(seed), b = fixtureRandom(seed);
  assert.deepEqual(expected.map(() => a.next()), expected);
  assert.deepEqual(expected.map(() => b.next()), expected);
  assert.notEqual(fixtureRandom("vsc-fixture/v1:1").next(), expected[0]);
});

test("bounded draws reject the biased tail and validate words and bounds", () => {
  const words = [0xffffffff, 0xffffffff, 5];
  assert.equal(boundedDraw(() => words.shift(), 3), 2);
  assert.equal(words.length, 0);
  assert.equal(boundedDraw(() => 0xffffffff, 2 ** 32), 0xffffffff);
  assert.equal(boundedDraw(() => 0xffffffff, 1), 0);
  for (const bound of [0, -0, -1, 1.5, 2 ** 32 + 1, NaN, Infinity, "2"]) {
    assert.throws(() => boundedDraw(() => { throw new Error("must-not-draw"); }, bound), /invalid-draw-bound/);
  }
  for (const word of [-1, -0, 0x100000000, 1.5, NaN, "1"]) {
    assert.throws(() => boundedDraw(() => word, 3), /invalid-random-word/);
  }
});

test("shuffle copies its input and complete-grid/orbit order matches the independent vector", () => {
  const input = Object.freeze([1, 2, 3, 4, 5]);
  const shuffled = fixtureRandom(seed).shuffle(input);
  assert.deepEqual([...shuffled].sort(), input);
  assert.notEqual(shuffled, input);
  const plan = generationPlan(seed);
  assert.equal(plan.completeGrid, complete);
  assert.deepEqual(plan.orbits, firstOrbitCells.map((i) => i === 40 ? [40] : [i, 80 - i]));
  assert.deepEqual([...plan.orbits.flat()].sort((a, b) => a - b), Array.from({ length: 81 }, (_, i) => i));
  assert.throws(() => { plan.orbits[0][0] = 0; });
  assert.throws(() => { plan.orbits.pop(); });
});

test("exact solver rejects malformed and conflicting givens", () => {
  for (const grid of [null, [], "", "0".repeat(80), "0".repeat(82), "０".repeat(81), `${complete}\n`]) {
    assert.throws(() => countSolutions(grid), /invalid-grid/);
  }
  for (const second of [1, 9, 10]) {
    const grid = new Array(81).fill("0"); grid[0] = "1"; grid[second] = "1";
    assert.throws(() => countSolutions(grid.join("")), /conflicting-givens/);
  }
});

test("zero, one and capped multiple solutions agree with independent exact cover", () => {
  const unsatisfiable = new Array(81).fill("0");
  for (let i = 0; i < 8; i++) unsatisfiable[i] = String(i + 1);
  unsatisfiable[35] = "9"; // No duplicate givens, but r1c9 has no possible value.
  for (const [grid, expected] of [[unsatisfiable.join(""), 0], [complete, 1],
    [`0${complete.slice(1)}`, 1], ["0".repeat(81), 2], [candidateZero, 1]]) {
    assert.equal(exactCoverCount(grid), expected);
    assert.equal(countSolutions(grid), expected);
    assert.equal(countSolutions(grid), expected); // No shared search state survives a call.
  }
});

test("clue removal independently replays every orbit with the exact-cover oracle", () => {
  const plan = generationPlan(seed), clues = [...complete];
  let count = 81;
  for (const orbit of plan.orbits) {
    if (count - orbit.length < 27) continue;
    for (const i of orbit) clues[i] = "0";
    if (exactCoverCount(clues.join("")) === 1) count -= orbit.length;
    else for (const i of orbit) clues[i] = complete[i];
  }
  assert.equal(clues.join(""), candidateZero);
  assert.deepEqual(generateCandidate(seed), { seed, attempt: 0, grid: candidateZero,
    givensCount: count, clueCountAccepted: true, selection: "unfiltered" });
  assert.equal(count, 28);
});

test("generated candidates preserve unique solutions, clue symmetry and original complete grids", () => {
  for (const attempt of [0, 1, 2, 3, 42, 999999, 4294967295]) {
    const source = `vsc-fixture/v1:${attempt}`;
    const plan = generationPlan(source), candidate = generateCandidate(source);
    for (const indices of [
      ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
      ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
      ...Array.from({ length: 9 }, (_, b) => Array.from({ length: 9 }, (_, i) =>
        27 * Math.floor(b / 3) + 3 * (b % 3) + 9 * Math.floor(i / 3) + i % 3)),
    ]) assert.equal(indices.map((i) => plan.completeGrid[i]).sort().join(""), "123456789");
    assert.equal(exactCoverCount(candidate.grid), 1);
    assert.equal(candidate.givensCount, [...candidate.grid].filter((d) => d !== "0").length);
    assert.ok(candidate.givensCount >= 27);
    assert.equal(candidate.clueCountAccepted, candidate.givensCount <= 30);
    assert.equal(candidate.selection, "unfiltered");
    for (let i = 0; i < 81; i++) {
      assert.equal(candidate.grid[i] === "0", candidate.grid[80 - i] === "0");
      assert.ok(candidate.grid[i] === "0" || candidate.grid[i] === plan.completeGrid[i]);
    }
    assert.throws(() => { candidate.selection = "accepted"; });
  }
});

test("all D4 coordinate maps, inverses and uniqueness agree independently", () => {
  const maps = [(r, c) => [r, c], (r, c) => [c, 8 - r], (r, c) => [8 - r, 8 - c],
    (r, c) => [8 - c, r], (r, c) => [r, 8 - c], (r, c) => [8 - c, 8 - r],
    (r, c) => [8 - r, c], (r, c) => [c, r]];
  for (let t = 0; t < 8; t++) {
    const expected = new Array(81);
    for (let i = 0; i < 81; i++) {
      const [r, c] = maps[t](Math.floor(i / 9), i % 9); expected[9 * r + c] = candidateZero[i];
    }
    const transformed = transformGrid(candidateZero, t);
    assert.equal(transformed, expected.join(""));
    assert.equal(exactCoverCount(transformed), 1);
    assert.equal(transformGrid(transformed, [0, 3, 2, 1, 4, 5, 6, 7][t]), candidateZero);
  }
  for (const t of [-1, -0, 8, 0.5, NaN, "0"]) assert.throws(() => transformGrid(complete, t));
});
