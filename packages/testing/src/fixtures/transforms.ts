import { createPuzzle, createTopology, fingerprint, type Fingerprint } from "@verified-sudoku/domain";
import { transformGrid } from "./generator.js";
import { readGrid } from "./solver.js";

export type ClassicTransformId = "d4-0" | "d4-1" | "d4-2" | "d4-3" | "d4-4" | "d4-5" | "d4-6" | "d4-7" |
  "digit-cycle" | "band-swap" | "stack-swap" | "row-swap" | "column-swap" | "composition";
export type FixtureTransform = Readonly<{ id: ClassicTransformId; grid: string; puzzleFingerprint: Fingerprint }>;

const swapGroups = (index: number): number => index < 3 ? index + 3 : index < 6 ? index - 3 : index;
const swapFirst = (index: number): number => index === 0 ? 1 : index === 1 ? 0 : index;
const digitCycle = (grid: string): string => [...grid].map((d) => d === "0" ? "0" : String(Number(d) % 9 + 1)).join("");
const remap = (grid: string, row: (index: number) => number, column: (index: number) => number): string =>
  Array.from({ length: 81 }, (_, i) => grid[9 * row(Math.floor(i / 9)) + column(i % 9)]).join("");
const identity = (index: number): number => index;
const bandSwap = (grid: string): string => remap(grid, swapGroups, identity);
const stackSwap = (grid: string): string => remap(grid, identity, swapGroups);
const rowSwap = (grid: string): string => remap(grid, swapFirst, identity);
const columnSwap = (grid: string): string => remap(grid, identity, swapFirst);

/** The ordered classic-transforms/v1 grid family. No proof or partition promotion is supplied. */
export function classicTransformSuite(grid: string): readonly FixtureTransform[] {
  readGrid(grid);
  const topology = createTopology(9);
  const record = (id: ClassicTransformId, transformed: string): FixtureTransform => {
    const givens = readGrid(transformed).flatMap((digit, i) => digit === 0 ? [] :
      [{ cellId: `r${Math.floor(i / 9) + 1}c${i % 9 + 1}`, digit }]);
    const puzzle = createPuzzle(topology, givens);
    return Object.freeze({ id, grid: transformed, puzzleFingerprint: puzzle.puzzleFingerprint });
  };
  return Object.freeze([
    ...Array.from({ length: 8 }, (_, d4) => record(`d4-${d4}` as ClassicTransformId, transformGrid(grid, d4))),
    record("digit-cycle", digitCycle(grid)),
    record("band-swap", bandSwap(grid)),
    record("stack-swap", stackSwap(grid)),
    record("row-swap", rowSwap(grid)),
    record("column-swap", columnSwap(grid)),
    record("composition", columnSwap(rowSwap(stackSwap(bandSwap(digitCycle(grid)))))),
  ]);
}

/** First-seen nonzero symbols map to 1, 2, ...; blanks retain their positions. */
export function normalizeDigits(grid: string): string {
  readGrid(grid);
  const digits = new Map<string, string>();
  return [...grid].map((value) => {
    if (value === "0") return "0";
    if (!digits.has(value)) digits.set(value, String(digits.size + 1));
    return digits.get(value)!;
  }).join("");
}

/** Lexicographically smallest digit normalization among the eight D4 transforms only. */
export function normalizeDigitD4(grid: string): string {
  return Array.from({ length: 8 }, (_, d4) => normalizeDigits(transformGrid(grid, d4))).sort()[0]!;
}

/** Computes keys without I/O. Hashes are not anonymization or evidence of collision clearance. */
export function fixtureCollisionKeys(grid: string): Readonly<{
  publicExactKeyHash: Fingerprint; publicNormalizedKeyHash: Fingerprint;
}> {
  readGrid(grid);
  return Object.freeze({ publicExactKeyHash: fingerprint("fixture-exact", grid),
    publicNormalizedKeyHash: fingerprint("fixture-digit-d4", normalizeDigitD4(grid)) });
}
