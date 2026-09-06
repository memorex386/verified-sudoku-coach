import { initialLogicalState, units, type Board, type LogicalState, type Unit, type CellId } from "@verified-sudoku/domain";

export function singleState(board: Board): { logical: LogicalState; groups: readonly Unit[];
  candidates: ReadonlyMap<CellId, number>; contradictory: boolean } {
  const logical = initialLogicalState(board); // Enforces authentic domain Board ownership.
  const groups = units(board.puzzle.topology);
  const fixed = new Map(logical.values.map(value => [value.cellId, value.digit]));
  const candidates = new Map(logical.candidates.map(value => [value.cellId, value.mask]));
  const contradictory = logical.candidates.some(value => value.mask === 0) || groups.some(unit => {
    const digits: number[] = unit.cells.flatMap(cell => fixed.has(cell) ? [fixed.get(cell)!] : []);
    if (new Set(digits).size !== digits.length) return true;
    for (let digit = 1; digit <= board.puzzle.topology.size; digit++) {
      if (!digits.includes(digit) && !unit.cells.some(cell => (candidates.get(cell) ?? 0) & (1 << (digit - 1)))) return true;
    }
    return false;
  });
  return { logical, groups, candidates, contradictory };
}
