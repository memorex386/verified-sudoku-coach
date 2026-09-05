import { createPuzzle, createTopology, fingerprint } from "@verified-sudoku/domain";

// Original compatibility claims, NOT generated showcase artifacts or solver/proof receipts.
const givens = Array.from({ length: 27 }, (_, i) => {
  const r = Math.floor(i / 9), c = i % 9;
  return { cellId: `r${r + 1}c${c + 1}`, digit: 1 + (3 * r + Math.floor(r / 3) + c) % 9 };
});
const puzzle = createPuzzle(createTopology(9), givens);
export const fixturePuzzle = {
  schemaId: "vsc.puzzle-definition", version: 1, puzzleId: "puz_0000000000000000",
  topology: puzzle.topology, givens, puzzleFingerprint: puzzle.puzzleFingerprint,
  provenance: { kind: "generated", generatorId: "artifact-contract-example", generatorVersion: "1.0.0", seed: "artifact-contract-example/v1" },
};
const placeholder = fingerprint("artifact-example", "unverified-placeholder");
const reference = (file) => ({ path: `fixtures/classic-9x9/showcase-v1/${file}.json`, hash: placeholder });
export const fixtureExamples = {
  receipt: { schemaId: "vsc.uniqueness-receipt", version: 1, puzzleFingerprint: puzzle.puzzleFingerprint,
    solverVersion: "1.0.0", solutionCount: 1 },
  manifest: {
    schemaId: "vsc.fixture-manifest", version: 1, fixtureId: "showcase-v1", fixtureVersion: "1.0.0",
    classification: "public-synthetic", license: "Apache-2.0", seed: "vsc-fixture/v1:0", attempt: 0,
    searchStart: 0, searchEnd: 999999, generatorId: "classic-symmetric", generatorVersion: "1.0.0",
    generatorSourceDigest: placeholder, prng: "xoshiro128-starstar/v1", seedDerivation: "sha256-le128/v1",
    topology: puzzle.topology, givensCount: 27, puzzle: reference("puzzle"), uniquenessReceipt: reference("uniqueness-receipt"),
    solverVersion: "1.0.0", solutionCount: 1, rulesetVersion: "classic-six/v1", proofEngineVersion: "0.0.0",
    proofPath: reference("proof-path"), outcome: "solved", stepCount: 3,
    techniqueCounts: { "naked-single": 1, "hidden-single": 0, "locked-pointing": 1, "locked-claiming": 0, "naked-pair": 1, "hidden-pair": 0 },
    firstLockedStep: 1, firstNakedPairStep: 2, selectionFilter: "early-locked-pair/v1", transformSuite: "classic-transforms/v1",
    familyId: "showcase-v1", partition: "showcase",
    transforms: ["d4-0", "d4-1", "d4-2", "d4-3", "d4-4", "d4-5", "d4-6", "d4-7",
      "digit-cycle", "band-swap", "stack-swap", "row-swap", "column-swap", "composition"]
      .map((id) => ({ id, puzzleFingerprint: puzzle.puzzleFingerprint })),
    collisionScheme: "digit-d4/v1", publicExactKeyHash: placeholder, publicNormalizedKeyHash: placeholder,
    limitations: ["nonuniform", "selection-biased", "solve-time-unmeasured"],
  },
  registry: { schemaId: "vsc.fixture-registry", version: 1, fixtures: [reference("manifest")] },
};
