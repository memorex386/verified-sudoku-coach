import { canonicalJson } from "./canonical.js";
import { fingerprint, type Fingerprint } from "./hash.js";
import { cellId, cells, digit, peers, requireTopology, units, type CellId, type Digit, type Topology } from "./topology.js";

export type ValueInput = Readonly<{ cellId: string; digit: number }>;
export type NoteInput = Readonly<{ cellId: string; digits: readonly number[] }>;
export type CellValue = Readonly<{ cellId: CellId; digit: Digit }>;
export type CellNotes = Readonly<{ cellId: CellId; digits: readonly Digit[] }>;
declare const puzzleBrand: unique symbol;
declare const boardBrand: unique symbol;
declare const logicalBrand: unique symbol;
export type Puzzle = Readonly<{
  [puzzleBrand]: true;
  topology: Topology;
  givens: readonly CellValue[];
  puzzleFingerprint: Fingerprint;
}>;
export type Board = Readonly<{
  [boardBrand]: true;
  puzzle: Puzzle;
  revision: number;
  entries: readonly CellValue[];
  notes: readonly CellNotes[];
  boardFingerprint: Fingerprint;
  stateFingerprint: Fingerprint;
}>;
export type LogicalState = Readonly<{
  [logicalBrand]: true;
  rulesetVersion: "classic-six/v1";
  puzzleFingerprint: Fingerprint;
  values: readonly CellValue[];
  candidates: readonly Readonly<{ cellId: CellId; mask: number }>[];
  fingerprint: Fingerprint;
}>;
const puzzles = new WeakSet<object>();
const boards = new WeakSet<object>();

function exactKeys(value: object, expected: readonly string[]): void {
  const keys = Object.keys(value).sort();
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) throw new Error("state-keys");
}

function copyValues(topology: Topology, input: readonly ValueInput[]): readonly CellValue[] {
  canonicalJson(input); // Reject exotic objects/accessors before reading their properties.
  if (!Array.isArray(input) || input.length > topology.size ** 2) throw new Error("state-values");
  let previous = "";
  return Object.freeze(input.map((item) => {
    if (item === null || typeof item !== "object") throw new Error("state-value");
    exactKeys(item, ["cellId", "digit"]);
    const cell = cellId(topology, item.cellId);
    if (cell <= previous) throw new Error("state-order");
    previous = cell;
    return Object.freeze({ cellId: cell, digit: digit(topology, item.digit) });
  }));
}

/** Consistency is not uniqueness. This constructor never supplies a verified-puzzle capability. */
export function createPuzzle(topology: Topology, givens: readonly ValueInput[]): Puzzle {
  requireTopology(topology);
  const copied = copyValues(topology, givens);
  for (const unit of units(topology)) {
    const values = copied.filter((value) => unit.cells.includes(value.cellId)).map((value) => value.digit);
    if (new Set(values).size !== values.length) throw new Error("conflicting-givens");
  }
  const puzzle = Object.freeze({ topology, givens: copied,
    puzzleFingerprint: fingerprint("puzzle", { topology, givens: copied }) }) as Puzzle;
  puzzles.add(puzzle);
  return puzzle;
}

export function createBoard(puzzle: Puzzle, revision: number, entries: readonly ValueInput[], notes: readonly NoteInput[]): Board {
  if (!puzzles.has(puzzle)) throw new Error("untrusted-puzzle");
  if (!Number.isSafeInteger(revision) || Object.is(revision, -0) || revision < 0) throw new Error("revision");
  const copied = copyValues(puzzle.topology, entries);
  const givens = new Set(puzzle.givens.map((value) => value.cellId));
  if (copied.some((value) => givens.has(value.cellId))) throw new Error("given-entry");
  canonicalJson(notes);
  if (!Array.isArray(notes) || notes.length > puzzle.topology.size ** 2) throw new Error("notes");
  const filled = new Set([...givens, ...copied.map((value) => value.cellId)]);
  let previous = "";
  const copiedNotes = Object.freeze(notes.map((note) => {
    if (note === null || typeof note !== "object") throw new Error("note");
    exactKeys(note, ["cellId", "digits"]);
    const cell = cellId(puzzle.topology, note.cellId);
    if (cell <= previous || filled.has(cell)) throw new Error("note-cell");
    previous = cell;
    if (!Array.isArray(note.digits) || note.digits.length < 1 || note.digits.length > puzzle.topology.size) throw new Error("note-digits");
    let last = 0;
    const digits = Object.freeze(note.digits.map((value: number) => {
      const parsed = digit(puzzle.topology, value);
      if (parsed <= last) throw new Error("note-order");
      last = parsed;
      return parsed;
    }));
    return Object.freeze({ cellId: cell, digits });
  }));
  const projection = { puzzleFingerprint: puzzle.puzzleFingerprint, entries: copied };
  const board = Object.freeze({ puzzle, revision, entries: copied, notes: copiedNotes,
    boardFingerprint: fingerprint("board", projection),
    stateFingerprint: fingerprint("board-state", { ...projection, revision, notes: copiedNotes }) }) as Board;
  boards.add(board);
  return board;
}

/** Initial candidates derive from fixed values only. No external masks or proof application. */
export function initialLogicalState(board: Board): LogicalState {
  if (!boards.has(board)) throw new Error("untrusted-board");
  const topology = board.puzzle.topology;
  const values = Object.freeze([...board.puzzle.givens, ...board.entries].sort((a, b) =>
    a.cellId < b.cellId ? -1 : a.cellId > b.cellId ? 1 : 0));
  const fixed = new Map(values.map((value) => [value.cellId, value.digit]));
  const candidates = Object.freeze(cells(topology).filter((cell) => !fixed.has(cell)).map((cell) => {
    let mask = (1 << topology.size) - 1;
    for (const peer of peers(topology, cell)) {
      const value = fixed.get(peer);
      if (value !== undefined) mask &= ~(1 << (value - 1));
    }
    return Object.freeze({ cellId: cell, mask });
  }));
  const projection = { rulesetVersion: "classic-six/v1" as const,
    puzzleFingerprint: board.puzzle.puzzleFingerprint, values, candidates };
  return Object.freeze({ ...projection, fingerprint: fingerprint("logical-state", projection) }) as LogicalState;
}
