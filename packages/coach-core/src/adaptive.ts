import { createBoard, applyPlayerAction, type Board, type CellId } from "@verified-sudoku/domain";
import { proposeSingle, verifySingle, readVerifiedSingle } from "@verified-sudoku/proof-engine";
import { localLesson, type LocalLesson } from "./local-lesson.js";

export type LocalOption = Readonly<{ id: string; lesson: LocalLesson }>;
const completionCache = new WeakMap<object, ReadonlyMap<CellId, number>>();
function completion(board: Board): ReadonlyMap<CellId, number> {
  const cached = completionCache.get(board.puzzle); if (cached) return cached;
  let state = createBoard(board.puzzle, 0, [], []);
  for (let i = 0; i <= 81; i++) {
    const found = proposeSingle(state);
    if (found.type === "solved") {
      const result = new Map([...state.puzzle.givens, ...state.entries].map(v => [v.cellId, v.digit]));
      completionCache.set(board.puzzle, result); return result;
    }
    if (found.type !== "proposal") break;
    const proof = verifySingle(state, found.proposal), fact = proof && readVerifiedSingle(state, proof);
    if (!fact) break;
    const placed = applyPlayerAction(state, state.revision, state.stateFingerprint,
      { type: "place-value", cellId: fact.cellId, digit: fact.digit });
    if (placed.type !== "accepted") break;
    state = placed.board;
  }
  return new Map();
}
export function localCoachOptions(board: Board): readonly LocalOption[] {
  const answer = completion(board);
  const wrong = board.entries.filter(v => answer.has(v.cellId) && answer.get(v.cellId) !== v.digit);
  const plain = (id: string, title: string, text: string, linked: readonly CellId[] = []) => Object.freeze({ id,
    lesson: Object.freeze({ target: linked[0] ?? "r1c1" as CellId, title,
      beats: Object.freeze([Object.freeze({ text, cells: Object.freeze([...linked]), ruledOut: null })]) }) });
  const pause = plain("pause", "Your pace", "I'll give you some room. Ask when you want to continue.");
  if (wrong.length) return Object.freeze([plain("recover", "Let's check an entry",
    "The highlighted entry doesn't fit this puzzle. Clear it or use Undo before we reason further.", wrong.map(v => v.cellId)), pause]);
  const found = proposeSingle(board);
  if (found.type !== "proposal") return Object.freeze([plain(found.type === "solved" ? "complete" : "unsupported",
    found.type === "solved" ? "You finished!" : "No verified single available",
    found.type === "solved" ? "Every row, column and box is complete." : "I can only teach verified singles here. Keep playing or ask for less help."), pause]);
  const proof = verifySingle(board, found.proposal);
  if (!proof) return Object.freeze([pause]);
  return Object.freeze([...["nudge", "compare", "explain"].map((id, i) => Object.freeze({ id,
    lesson: localLesson(board, proof, i as 0 | 1 | 2)! })), pause]);
}
export const localAcknowledgements = Object.freeze({ listen: "Let's work through your question.",
  simplify: "Let's slow down and take this a little at a time.", encourage: "We can work through this together.",
  "respect-space": "You're in control of how much help you get." });
export const localFollowUps = Object.freeze({ try: "Want to try the next move yourself?",
  understood: "Does that make sense, or would a smaller step help?", preference: "Would you prefer a nudge or an explanation?", none: "" });
