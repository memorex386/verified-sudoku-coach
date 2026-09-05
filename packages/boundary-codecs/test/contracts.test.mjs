import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import * as schema from "@verified-sudoku/contracts";
import * as codec from "../dist/index.js";
import { canonicalJson, fingerprint, initialLogicalState } from "@verified-sudoku/domain";
import { examples, identity, puzzle, board, action, step, path, trace, replay, makeBoard, makePath, sealStep, sealPath, sealEnvelope } from "./examples.mjs";

const json = (value) => JSON.stringify(value);
const copy = (value) => structuredClone(value);
const success = (result) => { assert.equal(result.ok, true, json(result)); return result.value; };
const reject = (result, code) => { assert.equal(result.ok, false); if (code) assert.equal(result.code, code); assert.deepEqual(Object.keys(result).sort(), ["code", "ok"]); };
const puzzleContext = success(codec.decodePuzzle(json(puzzle)));
const boardContext = success(codec.decodeBoard(json(board), puzzleContext));
const schemas = { identity: schema.behaviorIdentityV1Schema, puzzle: schema.puzzleDefinitionV1Schema,
  board: schema.boardStateV1Schema, action: schema.boardActionV1Schema, step: schema.proofStepV1Schema,
  path: schema.proofPathV1Schema, trace: schema.traceEnvelopeV1Schema, replay: schema.replayArtifactV1Schema };
const decoders = { identity: codec.decodeBehaviorIdentity, puzzle: codec.decodePuzzle,
  board: (input) => codec.decodeBoard(input, puzzleContext), action: (input) => codec.decodeBoardAction(input, boardContext),
  step: (input) => codec.decodeUnverifiedProofStep(input, boardContext), path: (input) => codec.decodeUnverifiedProofPath(input, boardContext),
  trace: codec.decodeUnverifiedTrace, replay: codec.decodeUnverifiedReplay };

for (const [name, example] of Object.entries(examples)) {
  test(`${name}: exact schema, codec, missing/null/future fields and round trip`, () => {
    assert.equal(schemas[name].safeParse(example).success, true);
    success(decoders[name](json(example)));
    success(decoders[name](canonicalJson(example)));
    for (const key of Object.keys(example)) {
      const missing = copy(example); delete missing[key];
      assert.equal(schemas[name].safeParse(missing).success, false, `missing ${name}.${key}`);
      const nullField = { ...example, [key]: null };
      assert.equal(schemas[name].safeParse(nullField).success, false);
    }
    for (const version of [0, 2, "1", null]) reject(decoders[name](json({ ...example, version })), "shape");
    reject(decoders[name](json({ ...example, extra: true })), "shape");
    reject(decoders[name](example), "syntax");
  });
}

test("unknown keys fail at every nested object in every example", () => {
  for (const [name, example] of Object.entries(examples)) {
    function visit(value, keys) {
      if (value === null || typeof value !== "object") return;
      if (!Array.isArray(value)) {
        const hostile = copy(example);
        let target = hostile;
        for (const key of keys) target = target[key];
        target.extra = "sentinel";
        reject(decoders[name](json(hostile)), "shape");
      }
      for (const [key, child] of Object.entries(value)) visit(child, [...keys, key]);
    }
    visit(example, []);
  }
});

test("bounded JSON rejects duplicates, rounded numbers, malformed syntax, Unicode and hostile objects", () => {
  const source = json(puzzle);
  const duplicate = source.replace('"version":1', '"version":1,"version":1');
  reject(codec.decodePuzzle(duplicate), "syntax");
  reject(codec.decodePuzzle(source.replace('"version":1', '"version":1,"\\u0076ersion":1')), "syntax");
  for (const token of ["-0", "1e0", "1.0", "9007199254740991.1", "9007199254740992", "01", "NaN", "Infinity"]) {
    reject(codec.decodePuzzle(source.replace('"version":1', `"version":${token}`)), "syntax");
  }
  for (const input of [source + "true", source.slice(0, -1), '{"a":[1,]}', '{"a":}', '{"a":"\\q"}',
    '{"a":"unterminated}', "\ufeff" + source, "é", "null", "[]"]) reject(codec.decodePuzzle(input));
  reject(codec.decodePuzzle(source.replace('contract-example/v1', '\\u00e9')), "shape");
  let called = 0;
  reject(codec.decodePuzzle({ toString() { called++; return source; } }), "syntax");
  assert.equal(called, 0);
});

test("all wire byte ceilings accept boundary whitespace and reject one byte over", () => {
  const ceilings = { identity: 4096, action: 4096, puzzle: 16384, board: 32768, step: 32768, path: 2097152, trace: 8388608, replay: 8388608 };
  for (const [name, ceiling] of Object.entries(ceilings)) {
    const source = json(examples[name]);
    success(decoders[name](source + " ".repeat(ceiling - source.length)));
    reject(decoders[name](source + " ".repeat(ceiling - source.length + 1)), "size");
  }
  for (const [name, depth] of Object.entries({ identity: 3, action: 5, puzzle: 6, board: 6, step: 8, path: 10, trace: 12, replay: 12 })) {
    reject(decoders[name]("[".repeat(depth + 1) + "0" + "]".repeat(depth + 1)), "size");
  }
});

test("canonical IDs and SemVer reject trailing newlines and malformed prereleases", () => {
  for (const version of ["01.0.0", "1.0", "1.0.0+build", "1.0.0-01", "1.0.0-", "1.0.0\n", "1.0.0-é"]) {
    reject(codec.decodeBehaviorIdentity(json({ ...identity, schemaVersion: version })), version.includes("é") ? "syntax" : "shape");
  }
  for (const version of ["0.0.0", "1.2.3-alpha.1", "1.2.3-0", "1.2.3-001a"]) success(codec.decodeBehaviorIdentity(json({ ...identity, schemaVersion: version })));
  for (const field of ["puzzleId", "puzzleFingerprint"]) reject(codec.decodePuzzle(json({ ...puzzle, [field]: puzzle[field] + "\n" })), "shape");
  reject(codec.decodeBoardAction(json({ ...action, action: { ...action.action, cellId: "r1c3\n" } }), boardContext), "shape");
  reject(codec.decodeBehaviorIdentity(json({ ...identity, runtimeRegistrationId: "synthetic-example\n" })), "shape");
});

test("puzzle and board codecs bind topology, identity, canonical ordering and hashes", () => {
  for (const mutate of [
    (p) => { p.givens[0].cellId = "r7c1"; }, (p) => { p.givens[0].digit = 7; },
    (p) => { p.givens.reverse(); }, (p) => { p.givens.push(p.givens[0]); },
    (p) => { p.givens = [{ cellId: "r1c1", digit: 1 }, { cellId: "r1c2", digit: 1 }]; },
  ]) { const candidate = copy(puzzle); mutate(candidate); reject(codec.decodePuzzle(json(candidate))); }
  reject(codec.decodePuzzle(json({ ...puzzle, puzzleFingerprint: `sha256:${"0".repeat(64)}` })), "fingerprint");
  reject(codec.decodeBoard(json({ ...board, puzzleId: "puz_1111111111111111" }), puzzleContext), "reference");
  reject(codec.decodeBoard(json(board), { ...puzzleContext }), "reference");
  reject(codec.decodeBoard(json({ ...board, stateFingerprint: board.boardFingerprint }), puzzleContext), "fingerprint");
  for (const notes of [[{ cellId: "r1c1", digits: [1] }], [{ cellId: "r1c3", digits: [4, 3] }],
    [{ cellId: "r1c3", digits: [3, 3] }], [{ cellId: "r1c2", digits: [3] }]]) {
    reject(codec.decodeBoard(json({ ...board, notes }), puzzleContext));
  }
  assert.equal(codec.encodePuzzle(puzzleContext), canonicalJson(puzzle));
  assert.equal(codec.encodeBoard(boardContext), canonicalJson(board));
  assert.throws(() => codec.encodeBoard({ ...boardContext }));
  assert.throws(() => { boardContext.dto.notes[0].digits.push(9); });
  const changedNotes = success(codec.decodeBoard(json(makeBoard(1, board.entries, [{ cellId: "r1c3", digits: [1] }])), puzzleContext));
  assert.deepEqual(initialLogicalState(boardContext.board), initialLogicalState(changedNotes.board));
  assert.notEqual(boardContext.dto.stateFingerprint, changedNotes.dto.stateFingerprint);
});

test("action decoding checks stale before applicability and does not mutate snapshots", () => {
  const initial = codec.encodeBoard(boardContext);
  const make = (change) => json({ ...action, action: change });
  for (const value of [{ type: "clear-value", cellId: "r1c2" }, { type: "place-value", cellId: "r1c2", digit: 4 },
    { type: "replace-notes", cellId: "r1c3", digits: [] }]) success(codec.decodeBoardAction(make(value), boardContext));
  for (const value of [{ type: "clear-value", cellId: "r1c3" }, { type: "place-value", cellId: "r1c2", digit: 2 },
    { type: "place-value", cellId: "r1c1", digit: 2 }, { type: "replace-notes", cellId: "r1c2", digits: [3] },
    { type: "replace-notes", cellId: "r1c3", digits: [3, 4] }, { type: "replace-notes", cellId: "r1c4", digits: [] }]) {
    reject(codec.decodeBoardAction(make(value), boardContext), "invalid-action");
  }
  reject(codec.decodeBoardAction(json({ ...action, expectedRevision: 1, action: { type: "clear-value", cellId: "r1c1" } }), boardContext), "stale");
  reject(codec.decodeBoardAction(make({ type: "replace-notes", cellId: "r1c3", digits: [3, 3] }), boardContext));
  reject(codec.decodeBoardAction(make({ type: "place-value", cellId: "r1c3", digit: 7 }), boardContext));
  const exhausted = success(codec.decodeBoard(json(makeBoard(Number.MAX_SAFE_INTEGER)), puzzleContext));
  reject(codec.decodeBoardAction(json({ ...action, expectedRevision: exhausted.dto.revision, expectedStateFingerprint: exhausted.dto.stateFingerprint }), exhausted), "invalid-action");
  assert.equal(codec.encodeBoard(boardContext), initial);
});

test("proof codecs check framing without granting Sudoku authority", () => {
  // r1c3 is NOT a naked single in this synthetic board. A wire codec must not brand it verified.
  assert.notEqual(initialLogicalState(boardContext.board).candidates.find((item) => item.cellId === "r1c3").mask, 1 << 2);
  const decoded = success(codec.decodeUnverifiedProofStep(json(step), boardContext));
  assert.equal(decoded.verification, "unverified");
  assert.deepEqual(Object.keys(decoded).sort(), ["dto", "verification"]);
  assert.throws(() => { decoded.dto.conclusions[0].digit = 4; });
  for (const mutate of [
    (p) => { p.premises.technique = "hidden-single"; }, (p) => { p.proofId = `proof_${"0".repeat(64)}`; },
    (p) => { p.beforeStateFingerprint = p.afterStateFingerprint; }, (p) => { p.conclusions[0].kind = "eliminate"; },
    (p) => { p.conclusions.push(p.conclusions[0]); }, (p) => { p.premises.candidateDigits[0] = 7; },
    (p) => { p.sourceBoardRevision++; },
  ]) { const candidate = copy(step); mutate(candidate); reject(codec.decodeUnverifiedProofStep(json(candidate), boardContext)); }
  for (const mutate of [
    (p) => { p.steps.push(p.steps[0]); }, (p) => { p.initialStateFingerprint = p.finalStateFingerprint; },
    (p) => { p.finalStateFingerprint = p.initialStateFingerprint; }, (p) => { p.proofPathId = `path_${"0".repeat(64)}`; },
  ]) { const candidate = copy(path); mutate(candidate); reject(codec.decodeUnverifiedProofPath(json(candidate), boardContext)); }
  const unprovedOutcome = sealPath({ ...copy(path), outcome: { type: "solved" } });
  assert.equal(success(codec.decodeUnverifiedProofPath(json(unprovedOutcome), boardContext)).verification, "unverified");
});

test("all technique premise variants and canonical conclusion/collection bounds", () => {
  const unit = { kind: "row", index: 1 }, box = { kind: "box", index: 1 };
  for (const premises of [
    { technique: "hidden-single", unit, digit: 3, candidateCellIds: ["r1c3"] },
    { technique: "locked-pointing", sourceBox: box, digit: 3, candidateCellIds: ["r1c2", "r1c3"], confinedTo: unit },
    { technique: "locked-claiming", sourceLine: unit, digit: 3, candidateCellIds: ["r1c2", "r1c3"], confinedToBox: box },
    ...["naked-pair", "hidden-pair"].map((technique) => ({ technique, unit, digits: [3, 4], cellIds: ["r1c2", "r1c3"] })),
  ]) {
    const candidate = sealStep({ ...copy(step), technique: premises.technique, premises,
      conclusions: [{ kind: premises.technique === "hidden-single" ? "place" : "eliminate", cellId: "r1c4", digit: 3 }] });
    assert.equal(success(codec.decodeUnverifiedProofStep(json(candidate), boardContext)).verification, "unverified");
    const invalid = copy(candidate);
    if ("unit" in invalid.premises) invalid.premises.unit.index = 7;
    else invalid.premises.candidateCellIds.reverse();
    reject(codec.decodeUnverifiedProofStep(json(sealStep(invalid)), boardContext));
  }
  assert.equal(schema.proofPathV1Schema.safeParse({ ...path, steps: Array(811).fill(step) }).success, false);
  assert.equal(schema.proofStepV1Schema.safeParse({ ...step, conclusions: [] }).success, false);
  assert.equal(schema.proofStepV1Schema.safeParse({ ...step, conclusions: Array(15).fill(step.conclusions[0]) }).success, false);
});

test("trace lifecycle, calendar, sequence, identity and envelope tampering fail", () => {
  for (const mutate of [
    (t) => { t.traceRevision = 1; }, (t) => { t.events[1].sequence = 1; },
    (t) => { t.events[1].eventId = t.events[0].eventId; },
    (t) => { t.events[0].behaviorIdentityHash = `sha256:${"0".repeat(64)}`; },
    (t) => { t.events[0].recordedAt = "2026-09-04T21:00:00.000Z"; },
    (t) => { t.events[1].recordedAt = "2026-09-04T23:00:00.000Z"; },
    (t) => { t.lifecycle.closedAt = "2026-09-04T21:00:00.000Z"; },
    (t) => { t.puzzle.provenance.generatorId = "changed"; },
  ]) { const candidate = copy(trace); mutate(candidate); reject(codec.decodeUnverifiedTrace(json(candidate))); }
  for (const date of ["0000-01-01", "1900-02-29", "2026-02-29", "2026-04-31"]) {
    const candidate = copy(trace); candidate.lifecycle.startedAt = `${date}T00:00:00.000Z`;
    reject(codec.decodeUnverifiedTrace(json(sealEnvelope(candidate, "trace", "traceFingerprint"))));
  }
  const leap = copy(trace); leap.lifecycle.startedAt = "2000-02-29T00:00:00.000Z";
  success(codec.decodeUnverifiedTrace(json(sealEnvelope(leap, "trace", "traceFingerprint"))));
  const open = copy(trace); open.lifecycle = { state: "open", startedAt: trace.lifecycle.startedAt };
  success(codec.decodeUnverifiedTrace(json(sealEnvelope(open, "trace", "traceFingerprint"))));
  assert.equal(schema.traceEnvelopeV1Schema.safeParse({ ...trace, events: Array(501).fill(trace.events[0]) }).success, false);
});

test("replay framing checks sequence, identity and references while retaining unverified status", () => {
  for (const mutate of [
    (r) => { r.records[1].sequence = 1; }, (r) => { r.records[1].action.commandId = r.records[0].action.commandId; },
    (r) => { r.records[0].result.board.revision = 2; }, (r) => { r.records[0].action.expectedRevision = 1; },
    (r) => { r.records[1].result.stateFingerprint = board.stateFingerprint; },
    (r) => { r.records[0].result.proofPath.initialStateFingerprint = path.initialStateFingerprint; },
    (r) => { r.behaviorIdentityHash = `sha256:${"0".repeat(64)}`; },
    (r) => { r.puzzle.provenance = { kind: "host-catalog", catalogVersion: "1.0.0", sourceFingerprint: puzzle.puzzleFingerprint }; },
  ]) { const candidate = copy(replay); mutate(candidate); reject(codec.decodeUnverifiedReplay(json(sealEnvelope(candidate, "replay", "replayFingerprint")))); }
  assert.equal(success(codec.decodeUnverifiedReplay(json(replay))).verification, "unverified");
  assert.equal(schema.replayArtifactV1Schema.safeParse({ ...replay, records: Array(501).fill(replay.records[0]) }).success, false);
  const empty = { ...copy(replay), records: [] };
  success(codec.decodeUnverifiedReplay(json(sealEnvelope(empty, "replay", "replayFingerprint"))));
  success(codec.decodeUnverifiedProofPath(json(makePath(board, [])), boardContext));
});

test("committed compatibility examples match the constructed synthetic source", () => {
  const artifact = JSON.parse(fs.readFileSync(new URL("../../../docs/contracts/examples/board-proof-v1.json", import.meta.url), "utf8"));
  assert.deepEqual(artifact, JSON.parse(canonicalJson(examples)));
  assert.equal(success(codec.decodeBehaviorIdentity(json(identity))).hash, fingerprint("behavior-identity", identity));
});

const sealReplay = value => sealEnvelope(value, "replay", "replayFingerprint");
const decodeReplay = value => codec.decodeUnverifiedReplay(json(sealReplay(value)));

test("replay rejects rehashed boards that do not follow the recorded player action", () => {
  const wrongBoards = [
    makeBoard(1, [...board.entries, { cellId: "r1c3", digit: 4 }], []),
    makeBoard(1, [...board.entries, { cellId: "r1c3", digit: 3 }], [{ cellId: "r1c4", digits: [4] }]),
    makeBoard(1, [{ cellId: "r1c2", digit: 4 }, { cellId: "r1c3", digit: 3 }], []),
    makeBoard(1, board.entries, board.notes),
  ];
  for (const next of wrongBoards) {
    const candidate = copy(replay);
    candidate.records = [{ sequence: 1, action: copy(action),
      result: { type: "accepted", board: next, proofPath: makePath(next, []) } }];
    reject(decodeReplay(candidate), "semantic");
  }
  for (const mutation of [{ type: "place-value", cellId: "r1c2", digit: 2 },
    { type: "clear-value", cellId: "r1c3" }, { type: "place-value", cellId: "r1c1", digit: 3 }]) {
    const candidate = copy(replay); candidate.records = [candidate.records[0]];
    candidate.records[0].action.action = mutation;
    reject(decodeReplay(candidate), "semantic");
  }
});

test("replay executes note, placement, replacement and clear transitions without trusting proof outcomes", () => {
  const candidate = { ...copy(replay), records: [] };
  const changes = [
    [{ type: "replace-notes", cellId: "r1c3", digits: [1, 3, 5] }, makeBoard(1, board.entries, [{ cellId: "r1c3", digits: [1, 3, 5] }])],
    [{ type: "place-value", cellId: "r1c3", digit: 3 }, makeBoard(2, [...board.entries, { cellId: "r1c3", digit: 3 }], [])],
    [{ type: "place-value", cellId: "r1c3", digit: 4 }, makeBoard(3, [...board.entries, { cellId: "r1c3", digit: 4 }], [])],
    [{ type: "clear-value", cellId: "r1c3" }, makeBoard(4, board.entries, [])],
    [{ type: "replace-notes", cellId: "r1c4", digits: [2] }, makeBoard(5, board.entries, [{ cellId: "r1c4", digits: [2] }])],
    [{ type: "replace-notes", cellId: "r1c4", digits: [] }, makeBoard(6, board.entries, [])],
  ];
  let prior = board;
  for (const [i, [mutation, next]] of changes.entries()) {
    candidate.records.push({ sequence: i + 1,
      action: { ...copy(action), commandId: `cmd_${String(i).padStart(16, "0")}`,
        expectedRevision: prior.revision, expectedStateFingerprint: prior.stateFingerprint, action: mutation },
      result: { type: "accepted", board: next, proofPath: makePath(next, []) } });
    prior = next;
  }
  const result = success(decodeReplay(candidate));
  assert.equal(result.verification, "unverified");
  assert.deepEqual(result.dto.records.at(-1).result.board, prior);
  assert.ok(Object.isFrozen(result.dto.records[0].result.board.notes[0].digits));
  assert.equal(candidate.initialBoard.revision, 0);
  const invalid = copy(candidate); invalid.records[0].result.board = makeBoard(1, board.entries, [{ cellId: "r1c3", digits: [3] }]);
  invalid.records[0].result.proofPath = makePath(invalid.records[0].result.board, []);
  reject(decodeReplay(invalid), "semantic");
});

test("replay rejection reasons must match execution, including stale precedence and exhaustion", () => {
  const rejectedReplay = (initial, mutation, expectedRevision, code) => ({ ...copy(replay), initialBoard: initial,
    records: [{ sequence: 1, action: { ...copy(action), expectedRevision,
      expectedStateFingerprint: initial.stateFingerprint, action: mutation },
      result: { type: "rejected", code, stateFingerprint: initial.stateFingerprint } }] });
  for (const mutation of [{ type: "place-value", cellId: "r1c1", digit: 3 },
    { type: "place-value", cellId: "r1c2", digit: 2 }, { type: "clear-value", cellId: "r1c3" },
    { type: "replace-notes", cellId: "r1c2", digits: [3] },
    { type: "replace-notes", cellId: "r1c3", digits: [3, 4] }]) {
    success(decodeReplay(rejectedReplay(board, mutation, 0, "invalid-action")));
    reject(decodeReplay(rejectedReplay(board, mutation, 0, "stale")), "semantic");
    success(decodeReplay(rejectedReplay(board, mutation, 1, "stale")));
    reject(decodeReplay(rejectedReplay(board, mutation, 1, "invalid-action")), "semantic");
  }
  for (const code of ["stale", "invalid-action"]) reject(decodeReplay(rejectedReplay(board, action.action, 0, code)), "semantic");
  const exhausted = makeBoard(Number.MAX_SAFE_INTEGER);
  success(decodeReplay(rejectedReplay(exhausted, action.action, exhausted.revision, "invalid-action")));
  success(decodeReplay(rejectedReplay(exhausted, action.action, 0, "stale")));
});

test("500-record replay keeps rejected records from advancing state and retains proof distrust", () => {
  const candidate = { ...copy(replay), records: [] };
  for (let i = 0; i < 499; i++) candidate.records.push({ sequence: i + 1,
    action: { ...copy(action), commandId: `cmd_${String(i).padStart(16, "0")}`, expectedRevision: 1 },
    result: { type: "rejected", code: "stale", stateFingerprint: board.stateFingerprint } });
  const last = copy(replay.records[0]); last.sequence = 500; last.action.commandId = "cmd_0000000000000499";
  const next = last.result.board;
  const falseStep = sealStep({ ...copy(step), sourceBoardRevision: next.revision,
    sourceBoardFingerprint: next.boardFingerprint, beforeStateFingerprint: makePath(next, []).initialStateFingerprint,
    premises: { technique: "naked-single", targetCellId: "r1c4", candidateDigits: [4] },
    conclusions: [{ kind: "place", cellId: "r1c4", digit: 4 }] });
  const nextContext = success(codec.decodeBoard(json(next), puzzleContext));
  assert.notEqual(initialLogicalState(nextContext.board).candidates.find(item => item.cellId === "r1c4").mask, 1 << 3);
  last.result.proofPath = makePath(next, [falseStep]);
  candidate.records.push(last);
  const result = success(decodeReplay(candidate));
  assert.equal(result.verification, "unverified");
  assert.deepEqual(Object.keys(result).sort(), ["dto", "verification"]);
  assert.equal(result.dto.records.at(-1).result.board.revision, 1);
});
