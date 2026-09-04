import { proofStepV1Schema, proofPathV1Schema, type ProofStepV1, type ProofPathV1, type UnitRefV1 } from "@verified-sudoku/contracts";
import { cellId, digit, fingerprint, initialLogicalState } from "@verified-sudoku/domain";
import { reference, requireBoard, type DecodedPuzzle, type DecodedBoard } from "./board.js";
import { attempt, freeze, parseSchema, requireCondition, type DecodeResult, type DeepReadonly } from "./json.js";

export type Unverified<T> = Readonly<{ verification: "unverified"; dto: DeepReadonly<T> }>;
export function unverified<T>(dto: T): Unverified<T> { return Object.freeze({ verification: "unverified", dto: freeze(dto) }); }
function ordered(values: readonly (string | number)[]): void {
  requireCondition(values.every((value, i) => i === 0 || values[i - 1]! < value));
}
function checkCells(values: readonly string[], puzzle: DecodedPuzzle): void {
  ordered(values);
  for (const value of values) cellId(puzzle.puzzle.topology, value);
}
function checkUnit(unit: UnitRefV1, puzzle: DecodedPuzzle): void { requireCondition(unit.index <= puzzle.puzzle.topology.size); }
function source(dto: ProofStepV1 | ProofPathV1, puzzle: DecodedPuzzle, board?: DecodedBoard): void {
  reference(dto, puzzle);
  if (board) {
    requireBoard(board);
    reference(dto, board.puzzle);
    requireCondition(dto.sourceBoardRevision === board.dto.revision && dto.sourceBoardFingerprint === board.dto.boardFingerprint, "stale");
  }
}
/** Checks wire consistency only. It never derives or authorizes a Sudoku deduction. */
export function stepValue(dto: ProofStepV1, puzzle: DecodedPuzzle, board?: DecodedBoard): void {
  source(dto, puzzle, board);
  requireCondition(dto.technique === dto.premises.technique);
  const topology = puzzle.puzzle.topology;
  const p = dto.premises;
  if ("unit" in p) checkUnit(p.unit, puzzle);
  if ("digit" in p) digit(topology, p.digit);
  if ("candidateCellIds" in p) checkCells(p.candidateCellIds, puzzle);
  if (p.technique === "naked-single") {
    cellId(topology, p.targetCellId); digit(topology, p.candidateDigits[0]!);
  }
  if (p.technique === "locked-pointing") { checkUnit(p.sourceBox, puzzle); checkUnit(p.confinedTo, puzzle); }
  if (p.technique === "locked-claiming") { checkUnit(p.sourceLine, puzzle); checkUnit(p.confinedToBox, puzzle); }
  if (p.technique === "naked-pair" || p.technique === "hidden-pair") {
    checkCells(p.cellIds, puzzle); ordered(p.digits);
    for (const value of p.digits) digit(topology, value);
  }
  const single = dto.technique === "naked-single" || dto.technique === "hidden-single";
  requireCondition(!single || dto.conclusions.length === 1);
  ordered(dto.conclusions.map((conclusion) => `${conclusion.cellId}:${conclusion.digit}`));
  for (const conclusion of dto.conclusions) {
    cellId(topology, conclusion.cellId); digit(topology, conclusion.digit);
    requireCondition(conclusion.kind === (single ? "place" : "eliminate"));
  }
  requireCondition(dto.beforeStateFingerprint !== dto.afterStateFingerprint);
  const { rulesetVersion, technique, premises, conclusions, beforeStateFingerprint, afterStateFingerprint } = dto;
  const hash = fingerprint("proof", { rulesetVersion, technique, premises, conclusions, beforeStateFingerprint, afterStateFingerprint });
  requireCondition(dto.proofId === `proof_${hash.slice(7)}`, "fingerprint");
}
export function pathValue(dto: ProofPathV1, puzzle: DecodedPuzzle, board?: DecodedBoard): void {
  source(dto, puzzle, board);
  if (board) requireCondition(dto.initialStateFingerprint === initialLogicalState(board.board).fingerprint, "fingerprint");
  let current = dto.initialStateFingerprint;
  const seen = new Set<string>();
  for (const step of dto.steps) {
    stepValue(step, puzzle, board);
    requireCondition(step.sourceBoardRevision === dto.sourceBoardRevision && step.sourceBoardFingerprint === dto.sourceBoardFingerprint);
    requireCondition(step.beforeStateFingerprint === current && !seen.has(step.proofId));
    current = step.afterStateFingerprint; seen.add(step.proofId);
  }
  requireCondition(current === dto.finalStateFingerprint);
  const outcome = dto.outcome;
  if (outcome.type === "contradiction" && outcome.code === "empty-candidate-set") cellId(puzzle.puzzle.topology, outcome.cellId);
  if (outcome.type === "contradiction" && outcome.code === "duplicate-fixed-value") {
    checkUnit(outcome.unit, puzzle); digit(puzzle.puzzle.topology, outcome.digit);
    checkCells(outcome.cellIds, puzzle); requireCondition(outcome.cellIds.length <= puzzle.puzzle.topology.size);
  }
  const { puzzleId, puzzleFingerprint, sourceBoardRevision, sourceBoardFingerprint, rulesetVersion, initialStateFingerprint, finalStateFingerprint } = dto;
  const hash = fingerprint("proof-path", { puzzleId, puzzleFingerprint, sourceBoardRevision, sourceBoardFingerprint,
    rulesetVersion, initialStateFingerprint, proofIds: dto.steps.map((step) => step.proofId), outcome, finalStateFingerprint });
  requireCondition(dto.proofPathId === `path_${hash.slice(7)}`, "fingerprint");
}
export function decodeUnverifiedProofStep(input: unknown, board: DecodedBoard): DecodeResult<Unverified<ProofStepV1>> {
  return attempt(() => {
    requireBoard(board);
    const dto = parseSchema(input, "step", proofStepV1Schema);
    stepValue(dto, board.puzzle, board);
    return unverified(dto);
  });
}
export function decodeUnverifiedProofPath(input: unknown, board: DecodedBoard): DecodeResult<Unverified<ProofPathV1>> {
  return attempt(() => {
    requireBoard(board);
    const dto = parseSchema(input, "path", proofPathV1Schema);
    pathValue(dto, board.puzzle, board);
    return unverified(dto);
  });
}
