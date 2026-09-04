import { fixtureAttempt, fixtureRandom } from "./random.js";
import { countSolutions, readGrid } from "./solver.js";

/** D4 order: identity, clockwise rotations, vertical reflection then clockwise rotations. */
export function transformGrid(grid: string, transform: number): string {
  readGrid(grid);
  if (!Number.isInteger(transform) || Object.is(transform, -0) || transform < 0 || transform > 7) throw new Error("invalid-transform");
  const result = new Array<string>(81);
  for (let i = 0; i < 81; i++) {
    let r = Math.floor(i / 9), c = i % 9;
    if (transform >= 4) c = 8 - c;
    for (let turn = 0; turn < transform % 4; turn++) [r, c] = [c, 8 - r];
    result[9 * r + c] = grid[i]!;
  }
  return result.join("");
}

export type GenerationPlan = Readonly<{ completeGrid: string; orbits: readonly (readonly number[])[] }>;

export function generationPlan(seed: string): GenerationPlan {
  const random = fixtureRandom(seed);
  const digits = random.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const rows = random.shuffle([0, 1, 2]).flatMap((band) => random.shuffle([0, 1, 2]).map((offset) => band * 3 + offset));
  const columns = random.shuffle([0, 1, 2]).flatMap((stack) => random.shuffle([0, 1, 2]).map((offset) => stack * 3 + offset));
  const source = rows.flatMap((r) => columns.map((c) => digits[(3 * r + Math.floor(r / 3) + c) % 9])).join("");
  const completeGrid = transformGrid(source, random.bounded(8));
  if (completeGrid.includes("0") || countSolutions(completeGrid) !== 1) throw new Error("invalid-generated-grid");
  const orbits = random.shuffle(Array.from({ length: 41 }, (_, i) => Object.freeze(i === 40 ? [40] : [i, 80 - i])));
  return Object.freeze({ completeGrid, orbits: Object.freeze(orbits) });
}

export type FixtureCandidate = Readonly<{
  seed: string; attempt: number; grid: string; givensCount: number; clueCountAccepted: boolean;
  selection: "unfiltered";
}>;

/** One candidate only. No showcase search, proof acceptance, collision clearance or publication. */
export function generateCandidate(seed: string): FixtureCandidate {
  const attempt = fixtureAttempt(seed);
  const plan = generationPlan(seed);
  const clues = [...plan.completeGrid];
  let givensCount = 81;
  for (const orbit of plan.orbits) {
    if (givensCount - orbit.length < 27) continue;
    for (const i of orbit) clues[i] = "0";
    if (countSolutions(clues.join("")) === 1) givensCount -= orbit.length;
    else for (const i of orbit) clues[i] = plan.completeGrid[i]!;
  }
  return Object.freeze({ seed, attempt, grid: clues.join(""), givensCount,
    clueCountAccepted: givensCount >= 27 && givensCount <= 30, selection: "unfiltered" });
}
