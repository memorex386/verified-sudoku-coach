import { type Board, type Digit } from "@verified-sudoku/domain";
import { singleState } from "./single-state.js";
import { type SingleProposal } from "./single-verifier.js";

export type SingleSearchResult = Readonly<{ type: "proposal"; proposal: SingleProposal }> |
  Readonly<{ type: "solved" | "unsupported" | "contradiction" }>;

/** Local singles only; unsupported never means the six-technique ruleset is stalled. */
export function proposeSingle(board: Board): SingleSearchResult {
  const state = singleState(board);
  if (state.contradictory) return Object.freeze({ type: "contradiction" });
  if (state.candidates.size === 0) return Object.freeze({ type: "solved" });
  const proposal = (cellId: SingleProposal["cellId"], digit: Digit, unit: SingleProposal["unit"]): SingleSearchResult =>
    Object.freeze({ type: "proposal", proposal: Object.freeze({ profile: "local-singles/v1",
      stateFingerprint: board.stateFingerprint, technique: unit ? "hidden-single" : "naked-single", cellId, digit, unit }) });
  for (const { cellId, mask } of state.logical.candidates) {
    if ((mask & (mask - 1)) === 0) return proposal(cellId, (Math.log2(mask) + 1) as Digit, null);
  }
  for (const unit of state.groups) {
    for (let digit = 1; digit <= board.puzzle.topology.size; digit++) {
      const matches = unit.cells.filter(cell => (state.candidates.get(cell) ?? 0) & (1 << (digit - 1)));
      if (matches.length === 1) return proposal(matches[0]!, digit as Digit, Object.freeze({ kind: unit.kind, index: unit.index }));
    }
  }
  return Object.freeze({ type: "unsupported" });
}
