import { createTopology, createPuzzle, createBoard, initialLogicalState, fingerprint } from "@verified-sudoku/domain";

// Original constructed wire examples. Proof claims are intentionally NOT verified deductions.
export const identity = {
  schemaId: "vsc.behavior-identity", version: 1, rulesetVersion: "classic-six/v1",
  schemaVersion: "0.0.0", promptVersion: "0.0.0", modelProfileVersion: "0.0.0",
  runtimeRegistrationId: "synthetic-example", runtimeBehaviorVersion: "0.0.0",
  rendererVersion: "0.0.0", fixtureVersion: "0.0.0", evaluationSuiteVersion: "0.0.0",
};
const domainPuzzle = createPuzzle(createTopology(6), [{ cellId: "r1c1", digit: 1 }, { cellId: "r2c4", digit: 2 }]);
export const puzzle = { schemaId: "vsc.puzzle-definition", version: 1,
  puzzleId: "puz_0000000000000000", topology: domainPuzzle.topology, givens: domainPuzzle.givens,
  provenance: { kind: "generated", generatorId: "contract-example", generatorVersion: "1.0.0", seed: "contract-example/v1" },
  puzzleFingerprint: domainPuzzle.puzzleFingerprint };
export function makeBoard(revision = 0, entries = [{ cellId: "r1c2", digit: 2 }], notes = [{ cellId: "r1c3", digits: [3, 4] }]) {
  const board = createBoard(domainPuzzle, revision, entries, notes);
  return { schemaId: "vsc.board-state", version: 1, puzzleId: puzzle.puzzleId,
    puzzleFingerprint: puzzle.puzzleFingerprint, revision, entries, notes,
    boardFingerprint: board.boardFingerprint, stateFingerprint: board.stateFingerprint };
}
export const board = makeBoard();
export const action = { schemaId: "vsc.board-action", version: 1, commandId: "cmd_0000000000000000",
  puzzleId: puzzle.puzzleId, puzzleFingerprint: puzzle.puzzleFingerprint, expectedRevision: board.revision,
  expectedStateFingerprint: board.stateFingerprint, action: { type: "place-value", cellId: "r1c3", digit: 3 } };
export function sealStep(step) {
  const { rulesetVersion, technique, premises, conclusions, beforeStateFingerprint, afterStateFingerprint } = step;
  step.proofId = `proof_${fingerprint("proof", { rulesetVersion, technique, premises, conclusions, beforeStateFingerprint, afterStateFingerprint }).slice(7)}`;
  return step;
}
function initial(dto) { return initialLogicalState(createBoard(domainPuzzle, dto.revision, dto.entries, dto.notes)).fingerprint; }
export const step = sealStep({ schemaId: "vsc.proof-step", version: 1, proofId: "",
  puzzleId: puzzle.puzzleId, puzzleFingerprint: puzzle.puzzleFingerprint,
  sourceBoardRevision: board.revision, sourceBoardFingerprint: board.boardFingerprint,
  rulesetVersion: "classic-six/v1", technique: "naked-single", beforeStateFingerprint: initial(board),
  afterStateFingerprint: fingerprint("logical-state", { syntheticUnverifiedClaim: 1 }),
  premises: { technique: "naked-single", targetCellId: "r1c3", candidateDigits: [3] },
  conclusions: [{ kind: "place", cellId: "r1c3", digit: 3 }] });
export function sealPath(path) {
  const { puzzleId, puzzleFingerprint, sourceBoardRevision, sourceBoardFingerprint, rulesetVersion,
    initialStateFingerprint, outcome, finalStateFingerprint } = path;
  path.proofPathId = `path_${fingerprint("proof-path", { puzzleId, puzzleFingerprint, sourceBoardRevision,
    sourceBoardFingerprint, rulesetVersion, initialStateFingerprint, proofIds: path.steps.map((item) => item.proofId),
    outcome, finalStateFingerprint }).slice(7)}`;
  return path;
}
export function makePath(dto = board, steps = [step]) {
  return sealPath({ schemaId: "vsc.proof-path", version: 1, proofPathId: "", puzzleId: puzzle.puzzleId,
    puzzleFingerprint: puzzle.puzzleFingerprint, sourceBoardRevision: dto.revision, sourceBoardFingerprint: dto.boardFingerprint,
    rulesetVersion: "classic-six/v1", initialStateFingerprint: initial(dto), steps,
    outcome: { type: "stalled" }, finalStateFingerprint: steps.at(-1)?.afterStateFingerprint ?? initial(dto) });
}
export const path = makePath();
export function sealEnvelope(dto, projection, field) {
  const copy = { ...dto }; delete copy[field];
  dto[field] = fingerprint(projection, copy); return dto;
}
export const trace = sealEnvelope({ schemaId: "vsc.trace-envelope", version: 1,
  traceId: "trace_0000000000000000", traceRevision: 2, dataClassification: "public-synthetic",
  behaviorIdentity: identity, behaviorIdentityHash: fingerprint("behavior-identity", identity), puzzle,
  lifecycle: { state: "closed", startedAt: "2026-09-04T22:00:00.000Z", closedAt: "2026-09-04T22:01:00.000Z", reason: "abandoned" },
  events: [board, path].map((payload, index) => ({ eventId: `evt_000000000000000${index}`, sequence: index + 1,
    recordedAt: "2026-09-04T22:00:01.000Z", behaviorIdentityHash: fingerprint("behavior-identity", identity),
    type: index === 0 ? "board-state" : "proof-path", payload })), traceFingerprint: "" }, "trace", "traceFingerprint");
const nextBoard = makeBoard(1, [...board.entries, { cellId: "r1c3", digit: 3 }], []);
export const replay = sealEnvelope({ schemaId: "vsc.replay-artifact", version: 1,
  replayId: "replay_0000000000000000", dataClassification: "public-synthetic",
  behaviorIdentity: identity, behaviorIdentityHash: fingerprint("behavior-identity", identity), puzzle, initialBoard: board,
  records: [{ sequence: 1, action, result: { type: "accepted", board: nextBoard, proofPath: makePath(nextBoard, []) } },
    { sequence: 2, action: { ...action, commandId: "cmd_0000000000000001" },
      result: { type: "rejected", code: "stale", stateFingerprint: nextBoard.stateFingerprint } }],
  replayFingerprint: "" }, "replay", "replayFingerprint");
export const examples = { identity, puzzle, board, action, step, path, trace, replay };
