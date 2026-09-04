import { z } from "zod";
import { cellId, digit, fingerprint, puzzleId, revision, ruleset } from "./board.js";

const index = z.number().int().min(1).max(9);
const row = z.strictObject({ kind: z.literal("row"), index });
const column = z.strictObject({ kind: z.literal("column"), index });
const box = z.strictObject({ kind: z.literal("box"), index });
export const unitRefV1Schema = z.discriminatedUnion("kind", [row, column, box]);
const line = z.discriminatedUnion("kind", [row, column]);
const technique = z.enum(["naked-single", "hidden-single", "locked-pointing", "locked-claiming", "naked-pair", "hidden-pair"]);
const pair = { unit: unitRefV1Schema, digits: z.array(digit).length(2), cellIds: z.array(cellId).length(2) };
const premises = z.discriminatedUnion("technique", [
  z.strictObject({ technique: z.literal("naked-single"), targetCellId: cellId, candidateDigits: z.array(digit).length(1) }),
  z.strictObject({ technique: z.literal("hidden-single"), unit: unitRefV1Schema, digit, candidateCellIds: z.array(cellId).length(1) }),
  z.strictObject({ technique: z.literal("locked-pointing"), sourceBox: box, digit,
    candidateCellIds: z.array(cellId).min(2).max(3), confinedTo: line }),
  z.strictObject({ technique: z.literal("locked-claiming"), sourceLine: line, digit,
    candidateCellIds: z.array(cellId).min(2).max(3), confinedToBox: box }),
  z.strictObject({ technique: z.literal("naked-pair"), ...pair }),
  z.strictObject({ technique: z.literal("hidden-pair"), ...pair }),
]);
const conclusion = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("place"), cellId, digit }),
  z.strictObject({ kind: z.literal("eliminate"), cellId, digit }),
]);
export const proofStepV1Schema = z.strictObject({
  schemaId: z.literal("vsc.proof-step"), version: z.literal(1),
  proofId: z.string().regex(/^proof_[0-9a-f]{64}(?![\s\S])/), puzzleId, puzzleFingerprint: fingerprint,
  sourceBoardRevision: revision, sourceBoardFingerprint: fingerprint, rulesetVersion: ruleset,
  technique, beforeStateFingerprint: fingerprint, afterStateFingerprint: fingerprint,
  premises, conclusions: z.array(conclusion).min(1).max(14),
});
const outcome = z.union([
  z.strictObject({ type: z.literal("solved") }),
  z.strictObject({ type: z.literal("stalled") }),
  z.strictObject({ type: z.literal("contradiction"), code: z.literal("empty-candidate-set"), cellId }),
  z.strictObject({ type: z.literal("contradiction"), code: z.literal("duplicate-fixed-value"), unit: unitRefV1Schema,
    digit, cellIds: z.array(cellId).min(2).max(9) }),
  z.strictObject({ type: z.literal("contradiction"), code: z.literal("no-solution") }),
]);
export const proofPathV1Schema = z.strictObject({
  schemaId: z.literal("vsc.proof-path"), version: z.literal(1),
  proofPathId: z.string().regex(/^path_[0-9a-f]{64}(?![\s\S])/), puzzleId, puzzleFingerprint: fingerprint,
  sourceBoardRevision: revision, sourceBoardFingerprint: fingerprint, rulesetVersion: ruleset,
  initialStateFingerprint: fingerprint, steps: z.array(proofStepV1Schema).max(810),
  outcome, finalStateFingerprint: fingerprint,
});
export type UnitRefV1 = z.infer<typeof unitRefV1Schema>;
export type ProofStepV1 = z.infer<typeof proofStepV1Schema>;
export type ProofPathV1 = z.infer<typeof proofPathV1Schema>;
