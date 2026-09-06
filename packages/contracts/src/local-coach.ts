import { z } from "zod";
import { boardStateV1Schema } from "./board.js";

export const localCoachDecisionV1Schema = z.strictObject({
  schemaId: z.literal("vsc.local-coach-decision"), version: z.literal(1),
  option: z.enum(["nudge", "compare", "explain", "pause", "recover", "complete", "unsupported"]),
  acknowledgement: z.enum(["listen", "simplify", "encourage", "respect-space"]),
  followUp: z.enum(["try", "understood", "preference", "none"]),
});
export type LocalCoachDecisionV1 = z.infer<typeof localCoachDecisionV1Schema>;
export const localCoachRequestV1Schema = z.strictObject({
  schemaId: z.literal("vsc.local-coach-request"), version: z.literal(1),
  board: boardStateV1Schema, message: z.string().min(1).max(280),
  preference: z.enum(["nudge", "balanced", "explain"]),
});
export type LocalCoachRequestV1 = z.infer<typeof localCoachRequestV1Schema>;

export const localCoachResponseV1Schema = z.discriminatedUnion("type", [
  z.strictObject({ schemaId: z.literal("vsc.local-coach-response"), version: z.literal(1),
    type: z.literal("accepted"), stateFingerprint: z.string().regex(/^sha256:[0-9a-f]{64}$/), decision: localCoachDecisionV1Schema }),
  z.strictObject({ schemaId: z.literal("vsc.local-coach-response"), version: z.literal(1), type: z.literal("stale") }),
  z.strictObject({ schemaId: z.literal("vsc.local-coach-response"), version: z.literal(1), type: z.literal("ack") }),
  z.strictObject({ schemaId: z.literal("vsc.local-coach-response"), version: z.literal(1), type: z.literal("paused"),
    code: z.enum(["access", "request", "sessions", "size", "session", "not-enabled", "cadence", "budget", "timeout", "refusal", "quota", "provider", "invalid", "cancelled"]) }),
  z.strictObject({ schemaId: z.literal("vsc.local-coach-response"), version: z.literal(1), type: z.literal("session"),
    sessionId: z.string().regex(/^[0-9a-f]{32}$/), enabled: z.boolean(), remainingCalls: z.number().int().min(0).max(20) }),
]);

export const localCoachControlV1Schema = z.strictObject({
  schemaId: z.literal("vsc.local-coach-control"), version: z.literal(1),
});
