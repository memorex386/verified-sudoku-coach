import assert from "node:assert/strict";
import test from "node:test";
import { createTopology, createPuzzle, createBoard, applyPlayerAction } from "@verified-sudoku/domain";
import { proposeSingle, verifySingle, readVerifiedSingle } from "../dist/index.js";

function formula(size, keep) {
  const width = 3, height = size === 9 ? 3 : 2;
  return Array.from({ length: size * size }, (_, i) => ({ cellId: `r${Math.floor(i / size) + 1}c${i % size + 1}`,
    digit: 1 + (width * (Math.floor(i / size) % height) + Math.floor(Math.floor(i / size) / height) + i % size) % size }))
    .filter((_, i) => keep(i));
}
const board = (size, givens, entries = [], notes = [], revision = 0) => createBoard(createPuzzle(createTopology(size), givens), revision, entries, notes);

// Independent coordinate-array candidates, without domain candidate/peer helpers.
function oracle(state) {
  const { size, boxRows, boxColumns } = state.puzzle.topology;
  const fixed = Array(size * size).fill(0);
  for (const value of [...state.puzzle.givens, ...state.entries]) fixed[(Number(value.cellId[1]) - 1) * size + Number(value.cellId[3]) - 1] = value.digit;
  const candidates = fixed.map((value, i) => value ? [] : Array.from({ length: size }, (_, d) => d + 1).filter(d =>
    !fixed.some((v, j) => v === d && (Math.floor(i / size) === Math.floor(j / size) || i % size === j % size ||
      (Math.floor(Math.floor(i / size) / boxRows) === Math.floor(Math.floor(j / size) / boxRows) &&
       Math.floor((i % size) / boxColumns) === Math.floor((j % size) / boxColumns))))));
  const id = i => `r${Math.floor(i / size) + 1}c${i % size + 1}`;
  const proposals = [];
  for (let i = 0; i < fixed.length; i++) if (candidates[i].length === 1) proposals.push({ cellId: id(i), digit: candidates[i][0], unit: null });
  for (const kind of ["row", "column", "box"]) for (let index = 0; index < size; index++) for (let digit = 1; digit <= size; digit++) {
    const matches = candidates.flatMap((values, i) => {
      const group = kind === "row" ? Math.floor(i / size) : kind === "column" ? i % size :
        Math.floor(Math.floor(i / size) / boxRows) * (size / boxColumns) + Math.floor((i % size) / boxColumns);
      return group === index && values.includes(digit) ? [i] : [];
    });
    if (matches.length === 1) proposals.push({ cellId: id(matches[0]), digit, unit: { kind, index: index + 1 } });
  }
  return proposals.map(p => ({ profile: "local-singles/v1", stateFingerprint: state.stateFingerprint,
    technique: p.unit ? "hidden-single" : "naked-single", ...p }));
}

function partial(seed) {
  let x = seed;
  return formula(9, () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x % 100 < 40; });
}

test("singles match independent coordinate reasoning and canonical ordering on 6x6 and 9x9", () => {
  let hidden = 0;
  for (const state of [board(6, formula(6, i => i > 1)), board(9, formula(9, i => i > 1)),
    ...Array.from({ length: 20 }, (_, i) => board(9, partial(i + 1)))]) {
    const expected = oracle(state), result = proposeSingle(state);
    assert.deepEqual(result, expected.length ? { type: "proposal", proposal: expected[0] } : { type: "unsupported" });
    if (expected[0]?.technique === "hidden-single") hidden++;
    for (const proposal of expected) {
      const capability = verifySingle(state, proposal); // Includes valid non-first hints, independent of detection.
      assert.ok(capability);
      assert.deepEqual(readVerifiedSingle(state, capability), proposal);
      assert.ok(Object.isFrozen(capability) && Object.isFrozen(readVerifiedSingle(state, capability)));
    }
  }
  assert.ok(hidden > 0);
});

test("verifier rejects tampering, unsupported techniques, false premises and hostile object shapes", () => {
  const state = board(9, formula(9, i => i !== 0));
  const good = proposeSingle(state).proposal;
  const changes = { profile: "classic-six/v1", stateFingerprint: `sha256:${"0".repeat(64)}`,
    technique: "naked-pair", cellId: "r1c2", digit: 2, unit: { kind: "row", index: 1 } };
  for (const [key, value] of Object.entries(changes)) {
    assert.equal(verifySingle(state, { ...good, [key]: value }), null);
    const missing = { ...good }; delete missing[key]; assert.equal(verifySingle(state, missing), null);
  }
  for (const input of [null, [], {}, { ...good, extra: true }, { ...good, digit: "1" }, { ...good, digit: 1.5 }]) {
    assert.equal(verifySingle(state, input), null);
  }
  let invoked = false;
  const hostile = { ...good }; Object.defineProperty(hostile, "digit", { enumerable: true, get() { invoked = true; return 1; } });
  assert.equal(verifySingle(state, hostile), null); assert.equal(invoked, false);
  const hidden = { ...good, technique: "hidden-single", unit: { kind: "row", index: 1 } };
  assert.ok(verifySingle(state, hidden));
  for (const unit of [{ kind: "row", index: 2 }, { kind: "row", index: 1, extra: true }, { kind: "other", index: 1 }, []]) {
    assert.equal(verifySingle(state, { ...hidden, unit }), null);
  }
  const empty = board(9, []);
  assert.equal(verifySingle(empty, { ...good, stateFingerprint: empty.stateFingerprint }), null);
  assert.equal(verifySingle(empty, { ...hidden, stateFingerprint: empty.stateFingerprint }), null);
});

test("notes never define candidates and stale or forged capabilities cannot supply facts", () => {
  const puzzle = createPuzzle(createTopology(9), formula(9, i => i !== 0));
  const state = createBoard(puzzle, 0, [], []), noted = createBoard(puzzle, 1, [], [{ cellId: "r1c1", digits: [9] }]);
  const proposal = proposeSingle(state).proposal, capability = verifySingle(state, proposal);
  assert.equal(proposeSingle(noted).proposal.digit, 1);
  assert.equal(verifySingle(noted, proposal), null);
  assert.equal(readVerifiedSingle(noted, capability), null);
  assert.equal(readVerifiedSingle(state, {}), null);
  assert.equal(readVerifiedSingle(state, JSON.parse(JSON.stringify(capability))), null);
  assert.equal(readVerifiedSingle(state, { ...capability }), null);
  assert.throws(() => proposeSingle({ ...state }), /untrusted-board/);
  assert.throws(() => verifySingle({ ...state }, proposal), /untrusted-board/);
});

test("contradictions cannot authorize a single; solved and unsupported are distinct", () => {
  const duplicate = board(9, [{ cellId: "r1c1", digit: 1 }], [{ cellId: "r1c2", digit: 1 }]);
  const impossible = board(9, [...Array.from({ length: 8 }, (_, i) => ({ cellId: `r1c${i + 1}`, digit: i + 1 })), { cellId: "r4c9", digit: 9 }]);
  for (const state of [duplicate, impossible]) {
    assert.deepEqual(proposeSingle(state), { type: "contradiction" });
    assert.equal(verifySingle(state, { ...proposeSingle(board(9, formula(9, i => i !== 0))).proposal,
      stateFingerprint: state.stateFingerprint }), null);
  }
  assert.deepEqual(proposeSingle(board(9, formula(9, () => true))), { type: "solved" });
  assert.deepEqual(proposeSingle(board(9, [])), { type: "unsupported" });
});

test("verified singles drive reproducible player placement sequences without applying proofs", () => {
  for (const size of [6, 9]) {
    let state = board(size, formula(size, i => Math.floor(i / size) !== 0));
    const original = state, expected = formula(size, () => true);
    for (let step = 0; step < size; step++) {
      const found = proposeSingle(state); assert.equal(found.type, "proposal");
      const fact = readVerifiedSingle(state, verifySingle(state, found.proposal));
      assert.equal(fact.digit, expected.find(value => value.cellId === fact.cellId).digit);
      const applied = applyPlayerAction(state, state.revision, state.stateFingerprint,
        { type: "place-value", cellId: fact.cellId, digit: fact.digit });
      assert.equal(applied.type, "accepted"); state = applied.board;
    }
    assert.deepEqual(proposeSingle(state), { type: "solved" });
    assert.equal(state.revision, size); assert.equal(original.entries.length, 0);
  }
});
