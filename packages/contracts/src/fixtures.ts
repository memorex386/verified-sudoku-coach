import { z } from "zod";
import { fingerprint, revision, semver, ruleset } from "./board.js";

const reference = <const T extends string>(path: T) => z.strictObject({ path: z.literal(path), hash: fingerprint });
const root = "fixtures/classic-9x9/showcase-v1/";
const count = revision.max(810);
const transformId = z.enum(["d4-0", "d4-1", "d4-2", "d4-3", "d4-4", "d4-5", "d4-6", "d4-7",
  "digit-cycle", "band-swap", "stack-swap", "row-swap", "column-swap", "composition"]);

export const uniquenessReceiptV1Schema = z.strictObject({
  schemaId: z.literal("vsc.uniqueness-receipt"), version: z.literal(1),
  puzzleFingerprint: fingerprint, solverVersion: z.literal("1.0.0"), solutionCount: z.literal(1),
});
export const fixtureManifestV1Schema = z.strictObject({
  schemaId: z.literal("vsc.fixture-manifest"), version: z.literal(1),
  fixtureId: z.literal("showcase-v1"), fixtureVersion: z.literal("1.0.0"),
  classification: z.literal("public-synthetic"), license: z.literal("Apache-2.0"),
  seed: z.string().regex(/^vsc-fixture\/v1:(?:0|[1-9][0-9]{0,5})(?![\s\S])/),
  attempt: revision.max(999999), searchStart: z.literal(0), searchEnd: z.literal(999999),
  generatorId: z.literal("classic-symmetric"), generatorVersion: z.literal("1.0.0"),
  generatorSourceDigest: fingerprint, prng: z.literal("xoshiro128-starstar/v1"),
  seedDerivation: z.literal("sha256-le128/v1"),
  topology: z.strictObject({ type: z.literal("classic"), size: z.literal(9), boxRows: z.literal(3), boxColumns: z.literal(3) }),
  givensCount: revision.min(27).max(30),
  puzzle: reference(`${root}puzzle.json`), uniquenessReceipt: reference(`${root}uniqueness-receipt.json`),
  solverVersion: z.literal("1.0.0"), solutionCount: z.literal(1),
  rulesetVersion: ruleset, proofEngineVersion: semver, proofPath: reference(`${root}proof-path.json`),
  outcome: z.literal("solved"), stepCount: count,
  techniqueCounts: z.strictObject({ "naked-single": count, "hidden-single": count, "locked-pointing": count,
    "locked-claiming": count, "naked-pair": count, "hidden-pair": count }),
  firstLockedStep: revision.min(1).max(20), firstNakedPairStep: revision.min(1).max(20),
  selectionFilter: z.literal("early-locked-pair/v1"), transformSuite: z.literal("classic-transforms/v1"),
  familyId: z.literal("showcase-v1"), partition: z.literal("showcase"),
  transforms: z.array(z.strictObject({ id: transformId, puzzleFingerprint: fingerprint })).length(14),
  collisionScheme: z.literal("digit-d4/v1"), publicExactKeyHash: fingerprint, publicNormalizedKeyHash: fingerprint,
  limitations: z.tuple([z.literal("nonuniform"), z.literal("selection-biased"), z.literal("solve-time-unmeasured")]),
});
export const fixtureRegistryV1Schema = z.strictObject({
  schemaId: z.literal("vsc.fixture-registry"), version: z.literal(1),
  fixtures: z.tuple([reference(`${root}manifest.json`)]),
});
export type UniquenessReceiptV1 = z.infer<typeof uniquenessReceiptV1Schema>;
export type FixtureManifestV1 = z.infer<typeof fixtureManifestV1Schema>;
export type FixtureRegistryV1 = z.infer<typeof fixtureRegistryV1Schema>;
