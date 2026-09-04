import { z } from "zod";
import { behaviorIdentityV1Schema, puzzleDefinitionV1Schema, boardStateV1Schema, boardActionV1Schema, fingerprint, revision } from "./board.js";
import { proofStepV1Schema, proofPathV1Schema } from "./proof.js";

const timestamp = z.string().regex(/^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z(?![\s\S])/);
const sequence = z.number().int().min(1).max(500);
const event = { eventId: z.string().regex(/^evt_[a-z0-9]{16,64}(?![\s\S])/), sequence,
  recordedAt: timestamp, behaviorIdentityHash: fingerprint };
export const traceEnvelopeV1Schema = z.strictObject({
  schemaId: z.literal("vsc.trace-envelope"), version: z.literal(1),
  traceId: z.string().regex(/^trace_[a-z0-9]{16,64}(?![\s\S])/), traceRevision: revision.max(500),
  dataClassification: z.enum(["public-synthetic", "private-account-linked"]),
  behaviorIdentity: behaviorIdentityV1Schema, behaviorIdentityHash: fingerprint, puzzle: puzzleDefinitionV1Schema,
  lifecycle: z.discriminatedUnion("state", [
    z.strictObject({ state: z.literal("open"), startedAt: timestamp }),
    z.strictObject({ state: z.literal("closed"), startedAt: timestamp, closedAt: timestamp,
      reason: z.enum(["completed", "abandoned", "withdrawn", "trace-limit", "error"]) }),
  ]),
  events: z.array(z.discriminatedUnion("type", [
    z.strictObject({ ...event, type: z.literal("board-state"), payload: boardStateV1Schema }),
    z.strictObject({ ...event, type: z.literal("board-action"), payload: boardActionV1Schema }),
    z.strictObject({ ...event, type: z.literal("proof-step"), payload: proofStepV1Schema }),
    z.strictObject({ ...event, type: z.literal("proof-path"), payload: proofPathV1Schema }),
  ])).max(500), traceFingerprint: fingerprint,
});
export const replayArtifactV1Schema = z.strictObject({
  schemaId: z.literal("vsc.replay-artifact"), version: z.literal(1),
  replayId: z.string().regex(/^replay_[a-z0-9]{16,64}(?![\s\S])/), dataClassification: z.literal("public-synthetic"),
  behaviorIdentity: behaviorIdentityV1Schema, behaviorIdentityHash: fingerprint,
  puzzle: puzzleDefinitionV1Schema, initialBoard: boardStateV1Schema,
  records: z.array(z.strictObject({ sequence, action: boardActionV1Schema,
    result: z.discriminatedUnion("type", [
      z.strictObject({ type: z.literal("accepted"), board: boardStateV1Schema, proofPath: proofPathV1Schema }),
      z.strictObject({ type: z.literal("rejected"), code: z.enum(["stale", "invalid-action"]), stateFingerprint: fingerprint }),
    ]),
  })).max(500), replayFingerprint: fingerprint,
});
export type TraceEnvelopeV1 = z.infer<typeof traceEnvelopeV1Schema>;
export type ReplayArtifactV1 = z.infer<typeof replayArtifactV1Schema>;
