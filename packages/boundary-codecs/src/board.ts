import {
  behaviorIdentityV1Schema, puzzleDefinitionV1Schema, boardStateV1Schema, boardActionV1Schema,
  type BehaviorIdentityV1, type PuzzleDefinitionV1, type BoardStateV1, type BoardActionV1,
} from "@verified-sudoku/contracts";
import { canonicalJson, fingerprint, createTopology, createPuzzle, createBoard, cellId, digit,
  type Puzzle, type Board } from "@verified-sudoku/domain";
import { attempt, freeze, parseSchema, requireCondition, type DecodeResult, type DeepReadonly } from "./json.js";

declare const puzzleBrand: unique symbol;
declare const boardBrand: unique symbol;
export type DecodedPuzzle = Readonly<{ [puzzleBrand]: true; dto: DeepReadonly<PuzzleDefinitionV1>; puzzle: Puzzle }>;
export type DecodedBoard = Readonly<{ [boardBrand]: true; dto: DeepReadonly<BoardStateV1>; board: Board; puzzle: DecodedPuzzle }>;
const puzzles = new WeakSet<object>();
const boards = new WeakSet<object>();
export function requirePuzzle(puzzle: DecodedPuzzle): void { requireCondition(puzzles.has(puzzle), "reference"); }
export function requireBoard(board: DecodedBoard): void { requireCondition(boards.has(board), "reference"); }
export function reference(dto: { puzzleId: string; puzzleFingerprint: string }, puzzle: DecodedPuzzle): void {
  requirePuzzle(puzzle);
  requireCondition(dto.puzzleId === puzzle.dto.puzzleId && dto.puzzleFingerprint === puzzle.dto.puzzleFingerprint, "reference");
}
export function puzzleValue(dto: PuzzleDefinitionV1): DecodedPuzzle {
  const puzzle = createPuzzle(createTopology(dto.topology.size), dto.givens);
  requireCondition(puzzle.puzzleFingerprint === dto.puzzleFingerprint, "fingerprint");
  const decoded = Object.freeze({ dto: freeze(dto), puzzle }) as DecodedPuzzle;
  puzzles.add(decoded);
  return decoded;
}
export function boardValue(dto: BoardStateV1, puzzle: DecodedPuzzle): DecodedBoard {
  reference(dto, puzzle);
  const board = createBoard(puzzle.puzzle, dto.revision, dto.entries, dto.notes);
  requireCondition(board.boardFingerprint === dto.boardFingerprint && board.stateFingerprint === dto.stateFingerprint, "fingerprint");
  const decoded = Object.freeze({ dto: freeze(dto), board, puzzle }) as DecodedBoard;
  boards.add(decoded);
  return decoded;
}
export function actionShape(dto: BoardActionV1, puzzle: DecodedPuzzle): void {
  reference(dto, puzzle);
  const topology = puzzle.puzzle.topology;
  cellId(topology, dto.action.cellId);
  if (dto.action.type === "place-value") digit(topology, dto.action.digit);
  if (dto.action.type === "replace-notes") {
    requireCondition(dto.action.digits.length <= topology.size);
    let previous = 0;
    for (const value of dto.action.digits) { digit(topology, value); requireCondition(value > previous); previous = value; }
  }
}
export function decodeBehaviorIdentity(input: unknown): DecodeResult<Readonly<{ dto: DeepReadonly<BehaviorIdentityV1>; hash: string }>> {
  return attempt(() => {
    const dto = parseSchema(input, "identity", behaviorIdentityV1Schema);
    return Object.freeze({ dto: freeze(dto), hash: fingerprint("behavior-identity", dto) });
  });
}
export function decodePuzzle(input: unknown): DecodeResult<DecodedPuzzle> {
  return attempt(() => puzzleValue(parseSchema(input, "puzzle", puzzleDefinitionV1Schema)));
}
export function decodeBoard(input: unknown, puzzle: DecodedPuzzle): DecodeResult<DecodedBoard> {
  return attempt(() => boardValue(parseSchema(input, "board", boardStateV1Schema), puzzle));
}
/** Validate applicability without mutating the board or supplying application deduplication. */
export function decodeBoardAction(input: unknown, board: DecodedBoard): DecodeResult<DeepReadonly<BoardActionV1>> {
  return attempt(() => {
    requireBoard(board);
    const dto = parseSchema(input, "action", boardActionV1Schema);
    reference(dto, board.puzzle);
    requireCondition(dto.expectedRevision === board.dto.revision && dto.expectedStateFingerprint === board.dto.stateFingerprint, "stale");
    actionShape(dto, board.puzzle);
    const action = dto.action;
    requireCondition(board.dto.revision < Number.MAX_SAFE_INTEGER &&
      !board.puzzle.dto.givens.some((entry) => entry.cellId === action.cellId), "invalid-action");
    const entry = board.dto.entries.find((value) => value.cellId === action.cellId);
    if (action.type === "place-value") requireCondition(entry?.digit !== action.digit, "invalid-action");
    if (action.type === "clear-value") requireCondition(entry !== undefined, "invalid-action");
    if (action.type === "replace-notes") {
      const existing = board.dto.notes.find((value) => value.cellId === action.cellId)?.digits ?? [];
      requireCondition(entry === undefined && canonicalJson(existing) !== canonicalJson(action.digits), "invalid-action");
    }
    return freeze(dto);
  });
}
export function encodePuzzle(puzzle: DecodedPuzzle): string { requirePuzzle(puzzle); return canonicalJson(puzzle.dto); }
export function encodeBoard(board: DecodedBoard): string { requireBoard(board); return canonicalJson(board.dto); }
