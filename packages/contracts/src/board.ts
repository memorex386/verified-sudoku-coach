import { z } from "zod";

export const revision = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).refine((n) => !Object.is(n, -0));
export const digit = z.number().int().min(1).max(9);
export const cellId = z.string().regex(/^r[1-9]c[1-9](?![\s\S])/);
export const fingerprint = z.string().regex(/^sha256:[0-9a-f]{64}(?![\s\S])/);
export const puzzleId = z.string().regex(/^puz_[a-z0-9]{16,64}(?![\s\S])/);
export const semver = z.string().max(64).regex(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?![\s\S])/);
export const kebabId = z.string().min(1).max(64).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?![\s\S])/);
export const ruleset = z.literal("classic-six/v1");
export const value = z.strictObject({ cellId, digit });
export const topologyV1Schema = z.union([
  z.strictObject({ type: z.literal("classic"), size: z.literal(6), boxRows: z.literal(2), boxColumns: z.literal(3) }),
  z.strictObject({ type: z.literal("classic"), size: z.literal(9), boxRows: z.literal(3), boxColumns: z.literal(3) }),
]);
export const behaviorIdentityV1Schema = z.strictObject({
  schemaId: z.literal("vsc.behavior-identity"), version: z.literal(1), rulesetVersion: ruleset,
  schemaVersion: semver, promptVersion: semver, modelProfileVersion: semver,
  runtimeRegistrationId: kebabId, runtimeBehaviorVersion: semver,
  rendererVersion: semver, fixtureVersion: semver, evaluationSuiteVersion: semver,
});
export const puzzleDefinitionV1Schema = z.strictObject({
  schemaId: z.literal("vsc.puzzle-definition"), version: z.literal(1), puzzleId,
  topology: topologyV1Schema, givens: z.array(value).max(81),
  provenance: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("generated"), generatorId: kebabId, generatorVersion: semver,
      seed: z.string().min(1).max(128).regex(/^[\x20-\x7e]+(?![\s\S])/) }),
    z.strictObject({ kind: z.literal("host-catalog"), catalogVersion: semver, sourceFingerprint: fingerprint }),
  ]),
  puzzleFingerprint: fingerprint,
});
export const boardStateV1Schema = z.strictObject({
  schemaId: z.literal("vsc.board-state"), version: z.literal(1), puzzleId,
  puzzleFingerprint: fingerprint, revision,
  entries: z.array(value).max(81),
  notes: z.array(z.strictObject({ cellId, digits: z.array(digit).min(1).max(9) })).max(81),
  boardFingerprint: fingerprint, stateFingerprint: fingerprint,
});
export const boardActionV1Schema = z.strictObject({
  schemaId: z.literal("vsc.board-action"), version: z.literal(1),
  commandId: z.string().regex(/^cmd_[a-z0-9]{16,64}(?![\s\S])/), puzzleId, puzzleFingerprint: fingerprint,
  expectedRevision: revision, expectedStateFingerprint: fingerprint,
  action: z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("place-value"), cellId, digit }),
    z.strictObject({ type: z.literal("clear-value"), cellId }),
    z.strictObject({ type: z.literal("replace-notes"), cellId, digits: z.array(digit).max(9) }),
  ]),
});
export type TopologyV1 = z.infer<typeof topologyV1Schema>;
export type BehaviorIdentityV1 = z.infer<typeof behaviorIdentityV1Schema>;
export type PuzzleDefinitionV1 = z.infer<typeof puzzleDefinitionV1Schema>;
export type BoardStateV1 = z.infer<typeof boardStateV1Schema>;
export type BoardActionV1 = z.infer<typeof boardActionV1Schema>;
