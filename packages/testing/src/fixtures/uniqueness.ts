import { canonicalJson, type Fingerprint } from "@verified-sudoku/domain";
import { decodePuzzle, decodeUnverifiedUniquenessReceipt, type DecodeResult } from "@verified-sudoku/boundary-codecs";
import { countSolutions } from "./solver.js";

/** Evidence for the givens only, never a verified proof or accepted showcase capability. */
export type UniquenessCheck = Readonly<{
  scope: "uniqueness-only";
  puzzleFingerprint: Fingerprint;
  solverVersion: "1.0.0";
  solutionCount: 1;
}>;

/** Rerun the independent exact solver on canonical public puzzle/receipt JSON files. */
export function checkUniquenessReceipt(puzzleText: unknown, receiptText: unknown): DecodeResult<UniquenessCheck> {
  const puzzle = decodePuzzle(puzzleText);
  if (!puzzle.ok) return puzzle;
  if (puzzleText !== canonicalJson(puzzle.value.dto)) return Object.freeze({ ok: false, code: "syntax" });
  if (puzzle.value.dto.provenance.kind !== "generated") return Object.freeze({ ok: false, code: "semantic" });
  const receipt = decodeUnverifiedUniquenessReceipt(receiptText, puzzle.value);
  if (!receipt.ok) return receipt;
  const grid = new Array<string>(81).fill("0");
  for (const { cellId, digit } of puzzle.value.puzzle.givens) {
    const row = Number(cellId[1]) - 1, column = Number(cellId[3]) - 1;
    grid[row * 9 + column] = String(digit);
  }
  try {
    if (countSolutions(grid.join("")) !== 1) return Object.freeze({ ok: false, code: "semantic" });
  } catch {
    return Object.freeze({ ok: false, code: "semantic" });
  }
  return Object.freeze({ ok: true, value: Object.freeze({ scope: "uniqueness-only",
    puzzleFingerprint: puzzle.value.puzzle.puzzleFingerprint, solverVersion: "1.0.0", solutionCount: 1 }) });
}
