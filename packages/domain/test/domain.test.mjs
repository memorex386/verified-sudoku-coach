import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  canonicalJson, canonicalBytes, sha256, fingerprint,
  createTopology, cellId, digit, cells, units, peers,
  createPuzzle, createBoard, initialLogicalState, applyPlayerAction,
} from "../dist/index.js";

const ascii = (value) => Uint8Array.from(value, (character) => character.charCodeAt(0));
const nodeHash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const independentFingerprint = (name, json) => `sha256:${nodeHash(Buffer.from(`vsc/${name}/v1\0${json}`))}`;
const apply = (board, action) => applyPlayerAction(board, board.revision, board.stateFingerprint, action);
const accepted = (result) => { assert.equal(result.type, "accepted"); assert.ok(Object.isFrozen(result)); return result.board; };
const rejected = (board, action, code = "invalid-action") => {
  assert.deepEqual(apply(board, action), { type: "rejected", code, stateFingerprint: board.stateFingerprint });
};

for (const size of [6, 9]) {
  test(`${size}x${size} player actions place, replace, clear and preserve immutable ordered state`, () => {
    const puzzle = createPuzzle(createTopology(size), [{ cellId: "r1c1", digit: 1 }]);
    const start = createBoard(puzzle, 0, [{ cellId: "r2c2", digit: 2 }],
      [{ cellId: "r1c2", digits: [2, 3] }, { cellId: "r3c3", digits: [3, 4] }]);
    const before = canonicalJson(start);
    const placed = accepted(apply(start, { type: "place-value", cellId: "r1c2", digit: 3 }));
    assert.deepEqual(placed, createBoard(puzzle, 1, [{ cellId: "r1c2", digit: 3 }, { cellId: "r2c2", digit: 2 }],
      [{ cellId: "r3c3", digits: [3, 4] }]));
    const replaced = accepted(apply(placed, { type: "place-value", cellId: "r1c2", digit: 4 }));
    const cleared = accepted(apply(replaced, { type: "clear-value", cellId: "r1c2" }));
    assert.deepEqual(cleared, createBoard(puzzle, 3, start.entries, [{ cellId: "r3c3", digits: [3, 4] }]));
    assert.equal(canonicalJson(start), before);
    assert.equal(placed.puzzle, puzzle);
    assert.ok(Object.isFrozen(placed.entries[0]));
    // Player input may be contradictory. Accepting input is not authorizing a logical deduction.
    const conflicting = accepted(apply(start, { type: "place-value", cellId: "r1c2", digit: 1 }));
    assert.equal(conflicting.entries[0].digit, 1);
    rejected(start, { type: "place-value", cellId: `r${size + 1}c1`, digit: 1 });
    rejected(start, { type: "place-value", cellId: "r1c2", digit: size + 1 });
  });
}

test("player notes copy inputs, never alter candidates, and empty replacement clears notes", () => {
  const board = createBoard(createPuzzle(createTopology(9), []), 0, [], []);
  const digits = [1, 3, 9];
  const noted = accepted(apply(board, { type: "replace-notes", cellId: "r1c1", digits }));
  digits.push(2);
  assert.deepEqual(noted.notes, [{ cellId: "r1c1", digits: [1, 3, 9] }]);
  assert.deepEqual(initialLogicalState(noted), initialLogicalState(board));
  assert.equal(noted.boardFingerprint, board.boardFingerprint);
  assert.notEqual(noted.stateFingerprint, board.stateFingerprint);
  const cleared = accepted(apply(noted, { type: "replace-notes", cellId: "r1c1", digits: [] }));
  assert.equal(cleared.revision, 2);
  assert.deepEqual(cleared.notes, []);
  assert.deepEqual(initialLogicalState(cleared), initialLogicalState(board));
  assert.ok(Object.isFrozen(noted.notes[0].digits));
});

test("player action no-ops, givens, filled notes, malformed input and revision exhaustion reject", () => {
  const puzzle = createPuzzle(createTopology(6), [{ cellId: "r1c1", digit: 1 }]);
  const board = createBoard(puzzle, 0, [{ cellId: "r1c2", digit: 2 }], [{ cellId: "r1c3", digits: [3] }]);
  for (const action of [null, [], {}, { type: "help", cellId: "r1c4" },
    { type: "place-value", cellId: "r1c2", digit: 2 }, { type: "clear-value", cellId: "r1c4" },
    { type: "replace-notes", cellId: "r1c2", digits: [1] },
    { type: "replace-notes", cellId: "r1c3", digits: [3] },
    { type: "replace-notes", cellId: "r1c4", digits: [] },
    { type: "clear-value", cellId: "r1c2", extra: true },
    ...["place-value", "clear-value", "replace-notes"].map(type => ({ type, cellId: "r1c1", digit: 2, digits: [2] })),
    ...[[2, 1], [1, 1], [7], [0], new Array(1), "1", [-0], [1.5]].map(digits => ({ type: "replace-notes", cellId: "r1c4", digits })),
  ]) rejected(board, action);
  const exhausted = createBoard(puzzle, Number.MAX_SAFE_INTEGER, [], []);
  rejected(exhausted, { type: "place-value", cellId: "r1c2", digit: 2 });
  const last = createBoard(puzzle, Number.MAX_SAFE_INTEGER - 1, [], []);
  assert.equal(accepted(apply(last, { type: "place-value", cellId: "r1c2", digit: 2 })).revision, Number.MAX_SAFE_INTEGER);
  assert.throws(() => apply({ ...board }, { type: "clear-value", cellId: "r1c2" }), /untrusted-board/);
});

test("staleness precedes action semantics and never invokes action accessors", () => {
  const board = createBoard(createPuzzle(createTopology(6), []), 1, [], []);
  let calls = 0;
  const hostile = { type: "place-value", cellId: "r1c1", get digit() { calls++; return 1; } };
  const expect = code => ({ type: "rejected", code, stateFingerprint: board.stateFingerprint });
  assert.deepEqual(applyPlayerAction(board, 0, board.stateFingerprint, hostile), expect("stale"));
  assert.deepEqual(applyPlayerAction(board, 1, `sha256:${"0".repeat(64)}`, hostile), expect("stale"));
  assert.deepEqual(apply(board, hostile), expect("invalid-action"));
  assert.equal(calls, 0);
  for (const revision of [-0, -1, 1.5, "1", Number.MAX_SAFE_INTEGER + 1])
    assert.deepEqual(applyPlayerAction(board, revision, board.stateFingerprint, hostile), expect("invalid-action"));
  assert.deepEqual(applyPlayerAction(board, 1, board.stateFingerprint + "\n", hostile), expect("invalid-action"));
});

test("action sequences agree with a coordinate-array model and reject replay against newer state", () => {
  const puzzle = createPuzzle(createTopology(9), []);
  let board = createBoard(puzzle, 0, [], []);
  const model = Array(81).fill(0);
  for (let step = 0; step < 162; step++) {
    const index = (step * 17) % 81, cell = `r${Math.floor(index / 9) + 1}c${index % 9 + 1}`;
    const action = step < 81 ? { type: "place-value", cellId: cell, digit: 1 + step % 9 } : { type: "clear-value", cellId: cell };
    const prior = board;
    board = accepted(apply(prior, action));
    model[index] = step < 81 ? action.digit : 0;
    const expected = model.flatMap((value, i) => value ? [{ cellId: `r${Math.floor(i / 9) + 1}c${i % 9 + 1}`, digit: value }] : []);
    assert.deepEqual(board, createBoard(puzzle, step + 1, expected, []));
    assert.equal(applyPlayerAction(board, prior.revision, prior.stateFingerprint, action).code, "stale");
  }
  assert.equal(board.entries.length, 0);
});

test("SHA-256 fixed standard vectors and padding/block boundaries", () => {
  for (const [input, expected] of [
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
    ["a".repeat(1000000), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"],
  ]) assert.equal(sha256(ascii(input)), expected);
  for (const length of [1, 55, 56, 63, 64, 65, 119, 120, 127, 128, 129, 1024]) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 131 + 17) % 256);
    const copy = bytes.slice();
    assert.equal(sha256(bytes), nodeHash(bytes));
    assert.deepEqual(bytes, copy);
  }
  assert.throws(() => sha256("abc"));
});

test("canonical bytes sort ASCII keys, preserve arrays, and escape identically", () => {
  const input = { z: [3, null, true], a: { "10": 10, "2": 2, "A": "\0\b\t\n\f\r\"\\\u007f" } };
  const expected = '{"a":{"10":10,"2":2,"A":"\\u0000\\b\\t\\n\\f\\r\\"\\\\\u007f"},"z":[3,null,true]}';
  assert.equal(canonicalJson(input), expected);
  assert.deepEqual(canonicalBytes(input), ascii(expected));
  assert.equal(canonicalJson(Object.assign(Object.create(null), { b: 2, a: 1 })), '{"a":1,"b":2}');
  assert.equal(canonicalJson({ a: 1, b: 2 }), canonicalJson({ b: 2, a: 1 }));
  const repeated = { a: 1 };
  assert.equal(canonicalJson([repeated, repeated]), '[{"a":1},{"a":1}]');
});

test("canonical decoding rejects lossy and executable representations without calling getters", () => {
  let calls = 0;
  const getter = Object.defineProperty({}, "a", { enumerable: true, get() { calls++; return 1; } });
  const cycle = {}; cycle.self = cycle;
  const hidden = Object.defineProperty({}, "a", { value: 1 });
  const sparse = new Array(1);
  const extra = [1]; extra.extra = 2;
  const arrayGetter = Object.defineProperty([], "0", { enumerable: true, get() { calls++; return 1; } });
  for (const value of [undefined, NaN, Infinity, -Infinity, -0, 1.5, Number.MAX_SAFE_INTEGER + 1,
    1n, Symbol("a"), () => 1, "é", "\ud800", { "é": 1 }, new Date(0), new Map(),
    Object.create({ a: 1 }), { [Symbol("a")]: 1 }, getter, hidden, cycle, sparse, extra, arrayGetter,
    { a: undefined }, [undefined]]) assert.throws(() => canonicalJson(value));
  assert.equal(calls, 0);
  let nested = 0;
  for (let i = 0; i < 65; i++) nested = [nested];
  assert.throws(() => canonicalJson(nested), /canonical-depth/);
});

test("typed fingerprints use the exact zero-byte domain separator", () => {
  assert.equal(fingerprint("board", { b: 2, a: 1 }), independentFingerprint("board", '{"a":1,"b":2}'));
  assert.notEqual(fingerprint("board", {}), fingerprint("board-state", {}));
  assert.equal(fingerprint("fixture-digit-d4", "0".repeat(81)), independentFingerprint("fixture-digit-d4", JSON.stringify("0".repeat(81))));
  for (const invalid of ["", "Board", "board/v1", "board\0", "a--b", "board\n", "board4",
    "fixture-digit-d5", "fixture-digit-d4\n"]) assert.throws(() => fingerprint(invalid, {}));
});

test("empty 6x6 puzzle and logical projection match independently calculated fixed hashes", () => {
  const puzzle = createPuzzle(createTopology(6), []);
  assert.equal(puzzle.puzzleFingerprint, "sha256:212aa81cf4edf5339c9537f2c101de1e806990e1451d15eaa6d57c1b943216ae");
  const logical = initialLogicalState(createBoard(puzzle, 0, [], []));
  assert.equal(logical.fingerprint, "sha256:56e54ca427519c34d123f37d87f0eab39db998952d4e6c5db46529b269d6715e");
  assert.equal(logical.candidates.length, 36);
  assert.ok(logical.candidates.every((candidate) => candidate.mask === 63));
});

for (const size of [6, 9]) {
  test(`${size}x${size} topology has complete ordered units and symmetric peers`, () => {
    const topology = createTopology(size);
    const all = cells(topology);
    const allUnits = units(topology);
    assert.equal(all.length, size * size);
    assert.deepEqual([...all].sort(), all);
    assert.equal(allUnits.length, size * 3);
    for (const unit of allUnits) {
      assert.equal(unit.cells.length, size);
      assert.equal(new Set(unit.cells).size, size);
      assert.deepEqual([...unit.cells].sort(), unit.cells);
    }
    for (const cell of all) {
      assert.equal(allUnits.filter((unit) => unit.cells.includes(cell)).length, 3);
      const connected = peers(topology, cell);
      assert.equal(connected.length, size === 6 ? 12 : 20);
      assert.ok(!connected.includes(cell));
      for (const peer of connected) assert.ok(peers(topology, peer).includes(cell));
    }
    assert.throws(() => { topology.size = 4; });
    assert.throws(() => { allUnits[0].cells.push("r1c1"); });
    for (const value of [0, -0, size + 1, 1.5, "1", NaN]) assert.throws(() => digit(topology, value));
    for (const value of ["r0c1", "r1c0", "r01c1", "R1C1", "r1c10", "r1c1\n", null]) assert.throws(() => cellId(topology, value));
    if (size === 6) assert.throws(() => cellId(topology, "r7c1"));
  });

  test(`${size}x${size} initial candidates agree with an independent coordinate oracle`, () => {
    const topology = createTopology(size);
    // Original formula-generated consistent givens; no private fixture or solver is used.
    const givens = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      if ((r * size + c) % 4 === 0) givens.push({ cellId: `r${r + 1}c${c + 1}`,
        digit: 1 + (topology.boxColumns * r + Math.floor(r / topology.boxRows) + c) % size });
    }
    const puzzle = createPuzzle(topology, givens);
    const state = initialLogicalState(createBoard(puzzle, 0, [], []));
    assert.equal(state.candidates.length + state.values.length, size * size);
    for (const { cellId: cell, mask } of state.candidates) {
      const r = Number(cell[1]) - 1, c = Number(cell[3]) - 1;
      const forbidden = new Set(givens.filter((value) => {
        const vr = Number(value.cellId[1]) - 1, vc = Number(value.cellId[3]) - 1;
        return r === vr || c === vc || (Math.floor(r / topology.boxRows) === Math.floor(vr / topology.boxRows) &&
          Math.floor(c / topology.boxColumns) === Math.floor(vc / topology.boxColumns));
      }).map((value) => value.digit));
      for (let d = 1; d <= size; d++) assert.equal(Boolean(mask & (1 << (d - 1))), !forbidden.has(d));
      assert.equal(mask >>> size, 0);
    }
  });
}

test("constructors reject forged trusted objects and invalid givens", () => {
  assert.throws(() => createTopology(4));
  const topology = createTopology(9);
  assert.throws(() => cells({ ...topology }));
  for (const givens of [
    [{ cellId: "r1c1", digit: 1 }, { cellId: "r1c2", digit: 1 }],
    [{ cellId: "r1c1", digit: 1 }, { cellId: "r2c1", digit: 1 }],
    [{ cellId: "r1c1", digit: 1 }, { cellId: "r2c2", digit: 1 }],
    [{ cellId: "r1c2", digit: 1 }, { cellId: "r1c1", digit: 2 }],
    [{ cellId: "r1c1", digit: 1 }, { cellId: "r1c1", digit: 2 }],
    [{ cellId: "r1c1", digit: 1, extra: 0 }], [null], new Array(1),
  ]) assert.throws(() => createPuzzle(topology, givens));
  const puzzle = createPuzzle(topology, []);
  assert.throws(() => createBoard({ ...puzzle }, 0, [], []));
  const board = createBoard(puzzle, 0, [], []);
  assert.throws(() => initialLogicalState({ ...board }));
  assert.throws(() => initialLogicalState(JSON.parse(JSON.stringify(board))));
});

test("board and logical hashes exclude notes while full state binds notes and revision", () => {
  const puzzle = createPuzzle(createTopology(9), [{ cellId: "r1c1", digit: 1 }]);
  const first = createBoard(puzzle, 0, [], []);
  const notes = createBoard(puzzle, 1, [], [{ cellId: "r1c2", digits: [1, 2] }]);
  const revision = createBoard(puzzle, 2, [], notes.notes);
  assert.equal(first.boardFingerprint, notes.boardFingerprint);
  assert.notEqual(first.stateFingerprint, notes.stateFingerprint);
  assert.notEqual(notes.stateFingerprint, revision.stateFingerprint);
  assert.deepEqual(initialLogicalState(first), initialLogicalState(notes));
  assert.deepEqual(initialLogicalState(notes), initialLogicalState(revision));
  const entered = createBoard(puzzle, 1, [{ cellId: "r1c2", digit: 2 }], []);
  assert.notEqual(entered.boardFingerprint, first.boardFingerprint);
  assert.notEqual(initialLogicalState(entered).fingerprint, initialLogicalState(first).fingerprint);
  assert.equal(puzzle.puzzleFingerprint, independentFingerprint("puzzle",
    '{"givens":[{"cellId":"r1c1","digit":1}],"topology":{"boxColumns":3,"boxRows":3,"size":9,"type":"classic"}}'));
  assert.equal(first.boardFingerprint, independentFingerprint("board",
    `{"entries":[],"puzzleFingerprint":"${puzzle.puzzleFingerprint}"}`));
  assert.equal(first.stateFingerprint, independentFingerprint("board-state",
    `{"entries":[],"notes":[],"puzzleFingerprint":"${puzzle.puzzleFingerprint}","revision":0}`));
});

test("trusted state copies and recursively freezes every caller-owned collection", () => {
  const givens = [{ cellId: "r1c1", digit: 1 }];
  const entries = [{ cellId: "r1c2", digit: 2 }];
  const notes = [{ cellId: "r1c3", digits: [3, 4] }];
  const puzzle = createPuzzle(createTopology(9), givens);
  const board = createBoard(puzzle, 0, entries, notes);
  const logical = initialLogicalState(board);
  givens[0].digit = 9; entries[0].digit = 9; notes[0].digits.push(9);
  assert.equal(puzzle.givens[0].digit, 1);
  assert.equal(board.entries[0].digit, 2);
  assert.deepEqual(board.notes[0].digits, [3, 4]);
  for (const mutate of [() => { puzzle.givens[0].digit = 3; }, () => { board.entries.push(entries[0]); },
    () => { board.notes[0].digits.push(9); }, () => { logical.values[0].digit = 2; },
    () => { logical.candidates[0].mask = 0; }, () => { logical.candidates.pop(); }]) assert.throws(mutate);
  assert.deepEqual(logical, initialLogicalState(board));
});

test("board validation rejects malformed notes, overlaps, revisions and exotic objects", () => {
  const puzzle = createPuzzle(createTopology(6), [{ cellId: "r1c1", digit: 1 }]);
  for (const revision of [-1, -0, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "0"]) {
    assert.throws(() => createBoard(puzzle, revision, [], []));
  }
  assert.equal(createBoard(puzzle, Number.MAX_SAFE_INTEGER, [], []).revision, Number.MAX_SAFE_INTEGER);
  assert.throws(() => createBoard(puzzle, 0, [{ cellId: "r1c1", digit: 2 }], []));
  for (const notes of [[{ cellId: "r1c1", digits: [1] }], [{ cellId: "r1c2", digits: [] }],
    [{ cellId: "r1c2", digits: [2, 1] }], [{ cellId: "r1c2", digits: [1, 1] }],
    [{ cellId: "r1c2", digits: [7] }], [{ cellId: "r1c2", digits: [1], extra: true }],
    [{ cellId: "r1c3", digits: [1] }, { cellId: "r1c2", digits: [1] }],
    [{ cellId: "r1c2", digits: [1] }, { cellId: "r1c2", digits: [2] }], [null]]) {
    assert.throws(() => createBoard(puzzle, 0, [], notes));
  }
  assert.throws(() => createBoard(puzzle, 0, [{ cellId: "r1c2", digit: 2 }], [{ cellId: "r1c2", digits: [3] }]));
  let called = false;
  const entry = { cellId: "r1c2", get digit() { called = true; return 2; } };
  assert.throws(() => createBoard(puzzle, 0, [entry], []));
  assert.equal(called, false);
});

test("contradictory player entries and zero candidate masks remain representable", () => {
  const puzzle = createPuzzle(createTopology(6), []);
  const duplicate = createBoard(puzzle, 0, [{ cellId: "r1c1", digit: 1 }, { cellId: "r1c2", digit: 1 }], []);
  assert.equal(initialLogicalState(duplicate).values.length, 2);
  const entries = [1, 2, 3, 4, 5].map((d) => ({ cellId: `r1c${d + 1}`, digit: d }));
  entries.push({ cellId: "r2c1", digit: 6 });
  const logical = initialLogicalState(createBoard(puzzle, 0, entries, []));
  assert.equal(logical.candidates.find((value) => value.cellId === "r1c1").mask, 0);
  // No validity, uniqueness or verified-proof capability is supplied by this initial state.
  assert.deepEqual(Object.keys(logical).sort(), ["candidates", "fingerprint", "puzzleFingerprint", "rulesetVersion", "values"]);
});
