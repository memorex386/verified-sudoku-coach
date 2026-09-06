import { initialLogicalState, peers, units, type Board, type CellId } from "@verified-sudoku/domain";
import { readVerifiedSingle, type VerifiedSingle } from "@verified-sudoku/proof-engine";

export type LessonBeat = Readonly<{ text: string; cells: readonly CellId[]; ruledOut: number | null }>;
export type LocalLesson = Readonly<{ target: CellId; title: string; beats: readonly LessonBeat[] }>;

/** Factual templates consume a state-bound verified hint, never untrusted prose. */
export function localLesson(board: Board, capability: VerifiedSingle, depth: 0 | 1 | 2): LocalLesson | null {
  const fact = readVerifiedSingle(board, capability);
  if (!fact || ![0, 1, 2].includes(depth)) return null;
  const beats: LessonBeat[] = [];
  const beat = (text: string, cells: readonly CellId[], ruledOut: number | null = null) =>
    beats.push(Object.freeze({ text, cells: Object.freeze([...cells]), ruledOut }));
  const cellLabel = `row ${fact.cellId[1]}, column ${fact.cellId[3]}`;
  if (fact.technique === "naked-single") {
    if (depth === 0) beat(`Take a look at ${cellLabel}. What do its row, column and box rule out?`, [fact.cellId]);
    if (depth === 1) beat("Compare the filled cells around the highlighted square. Only one digit can fit.", peers(board.puzzle.topology, fact.cellId));
    if (depth === 2) {
      const fixed = initialLogicalState(board).values;
      const linked = peers(board.puzzle.topology, fact.cellId);
      for (let digit = 1; digit <= board.puzzle.topology.size; digit++) {
        if (digit === fact.digit) continue;
        const witness = fixed.find(value => value.digit === digit && linked.includes(value.cellId));
        if (!witness) return null;
        const relation = witness.cellId[1] === fact.cellId[1] ? "row" : witness.cellId[3] === fact.cellId[3] ? "column" : "box";
        beat(`${digit} is already in this ${relation}.`, [witness.cellId], digit);
      }
      beat(`That leaves ${fact.digit} for ${cellLabel}. Select the square and place it when you're ready.`, [fact.cellId]);
    }
  } else {
    const unit = units(board.puzzle.topology).find(unit => unit.kind === fact.unit!.kind && unit.index === fact.unit!.index)!;
    if (depth === 0) beat(`Look at ${unit.kind} ${unit.index}. Is there a digit with only one possible home?`, unit.cells);
    if (depth === 1) beat(`Where can ${fact.digit} go in this ${unit.kind}? Check each empty square.`, unit.cells);
    if (depth === 2) beat(`In ${unit.kind} ${unit.index}, only ${cellLabel} can contain ${fact.digit}. This is a hidden single. You place the number.`, unit.cells);
  }
  return Object.freeze({ target: fact.cellId, title: depth === 0 ? "A small nudge" : depth === 1 ? "Look a little closer" : "Why it works",
    beats: Object.freeze(beats) });
}
