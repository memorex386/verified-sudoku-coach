import { parseBoundedJson } from "./json.js";
import { localCoachOptions } from "@verified-sudoku/coach-core";
import type { Board } from "@verified-sudoku/domain";
import { localCoachControlV1Schema, localCoachResponseV1Schema, localCoachDecisionV1Schema, localCoachRequestV1Schema } from "@verified-sudoku/contracts";
import { decodeBoard, type DecodedPuzzle } from "./board.js";

function wire(input: unknown): unknown {
  if (typeof input !== "string") return input;
  try { return parseBoundedJson(input, "localCoach"); } catch { return null; }
}
export function decodeLocalCoachDecision(input: unknown) {
  const result = localCoachDecisionV1Schema.safeParse(wire(input));
  return result.success ? Object.freeze(result.data) : null;
}
export function decodeLocalCoachRequest(input: unknown, puzzle: DecodedPuzzle): Readonly<{ board: Board; message: string; preference: "nudge" | "balanced" | "explain" }> | null {
  const result = localCoachRequestV1Schema.safeParse(wire(input));
  if (!result.success) return null;
  const decoded = decodeBoard(JSON.stringify(result.data.board), puzzle);
  return decoded.ok ? Object.freeze({ board: decoded.value.board, message: result.data.message,
    preference: result.data.preference }) : null;
}

export function decodeLocalCoachResponse(input: unknown) {
  const result = localCoachResponseV1Schema.safeParse(wire(input));
  return result.success ? Object.freeze(result.data) : null;
}

export function decodeLocalCoachChoice(input: unknown, board: Board, preference: "nudge" | "balanced" | "explain") {
  const decision = decodeLocalCoachDecision(input);
  if (!decision || !localCoachOptions(board).some(o => o.id === decision.option) ||
    (preference === "nudge" && decision.option === "explain") ||
    (decision.option === "pause" && decision.followUp !== "none")) return null;
  return decision;
}

export function decodeLocalCoachControl(input: unknown) {
  const result = localCoachControlV1Schema.safeParse(wire(input));
  return result.success ? Object.freeze(result.data) : null;
}
