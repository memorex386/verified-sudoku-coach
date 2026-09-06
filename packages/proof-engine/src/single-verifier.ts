import { canonicalJson, cellId, digit, initialLogicalState, type Board, type CellId, type Digit, type Fingerprint } from "@verified-sudoku/domain";
import { singleState } from "./single-state.js";

export type SingleProposal = Readonly<{
  profile: "local-singles/v1";
  stateFingerprint: Fingerprint;
  technique: "naked-single" | "hidden-single";
  cellId: CellId;
  digit: Digit;
  unit: Readonly<{ kind: "row" | "column" | "box"; index: number }> | null;
}>;
declare const verifiedBrand: unique symbol;
export type VerifiedSingle = Readonly<{ [verifiedBrand]: true }>;
const verified = new WeakMap<VerifiedSingle, SingleProposal>();

/** Recomputes premises; never calls a detector or accepts external candidate masks. */
export function verifySingle(board: Board, input: unknown): VerifiedSingle | null {
  const state = singleState(board);
  if (state.contradictory) return null;
  try {
    canonicalJson(input);
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    if (Object.keys(input).sort().join(",") !== "cellId,digit,profile,stateFingerprint,technique,unit") return null;
    const value = input as SingleProposal;
    if (value.profile !== "local-singles/v1" || value.stateFingerprint !== board.stateFingerprint) return null;
    const target = cellId(board.puzzle.topology, value.cellId), number = digit(board.puzzle.topology, value.digit);
    const bit = 1 << (number - 1), mask = state.candidates.get(target);
    if (mask === undefined || !(mask & bit)) return null;
    let unit: SingleProposal["unit"] = null;
    if (value.technique === "naked-single") {
      if (value.unit !== null || mask !== bit) return null;
    } else if (value.technique === "hidden-single") {
      if (!value.unit || Object.keys(value.unit).sort().join(",") !== "index,kind") return null;
      const group = state.groups.find(group => group.kind === value.unit!.kind && group.index === value.unit!.index);
      if (!group) return null;
      const matches = group.cells.filter(cell => (state.candidates.get(cell) ?? 0) & bit);
      if (matches.length !== 1 || matches[0] !== target) return null;
      unit = Object.freeze({ kind: group.kind, index: group.index });
    } else return null;
    const proposal: SingleProposal = Object.freeze({ profile: "local-singles/v1", stateFingerprint: board.stateFingerprint,
      technique: value.technique, cellId: target, digit: number, unit });
    const capability = Object.freeze({}) as VerifiedSingle;
    verified.set(capability, proposal);
    return capability;
  } catch {
    return null;
  }
}

/** Read facts only from a verifier-issued capability for this exact player state. */
export function readVerifiedSingle(board: Board, capability: VerifiedSingle): SingleProposal | null {
  initialLogicalState(board);
  const proposal = verified.get(capability);
  return proposal?.stateFingerprint === board.stateFingerprint ? proposal : null;
}
