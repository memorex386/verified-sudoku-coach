import { uniquenessReceiptV1Schema, fixtureManifestV1Schema, fixtureRegistryV1Schema,
  type UniquenessReceiptV1, type FixtureManifestV1, type FixtureRegistryV1 } from "@verified-sudoku/contracts";
import { canonicalJson } from "@verified-sudoku/domain";
import { requirePuzzle, type DecodedPuzzle } from "./board.js";
import { attempt, parseSchema, requireCondition, type DecodeResult, type ContractKind } from "./json.js";
import { unverified, type Unverified } from "./proof.js";

// Unlike general wire messages, fixture artifact files have one exact byte representation.
function canonicalArtifact<T>(input: unknown, kind: ContractKind,
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } }): T {
  const dto = parseSchema(input, kind, schema);
  requireCondition(input === canonicalJson(dto), "syntax");
  return dto;
}

/** A matching receipt remains a claim until the independent exact solver is rerun. */
export function decodeUnverifiedUniquenessReceipt(input: unknown, puzzle: DecodedPuzzle): DecodeResult<Unverified<UniquenessReceiptV1>> {
  return attempt(() => {
    requirePuzzle(puzzle);
    const dto = canonicalArtifact(input, "receipt", uniquenessReceiptV1Schema);
    requireCondition(puzzle.dto.topology.size === 9 && dto.puzzleFingerprint === puzzle.dto.puzzleFingerprint, "reference");
    return unverified(dto);
  });
}

/** Checks only local manifest invariants; no files, source digests, proofs or collisions are verified. */
export function decodeUnverifiedFixtureManifest(input: unknown): DecodeResult<Unverified<FixtureManifestV1>> {
  return attempt(() => {
    const dto = canonicalArtifact(input, "fixtureManifest", fixtureManifestV1Schema);
    requireCondition(dto.seed === `vsc-fixture/v1:${dto.attempt}`);
    requireCondition(Object.values(dto.techniqueCounts).reduce((total, count) => total + count, 0) === dto.stepCount);
    requireCondition(dto.techniqueCounts["locked-pointing"] + dto.techniqueCounts["locked-claiming"] > 0 &&
      dto.techniqueCounts["naked-pair"] > 0);
    requireCondition(dto.firstLockedStep <= dto.stepCount && dto.firstNakedPairStep <= dto.stepCount &&
      dto.firstLockedStep !== dto.firstNakedPairStep);
    const ids = ["d4-0", "d4-1", "d4-2", "d4-3", "d4-4", "d4-5", "d4-6", "d4-7",
      "digit-cycle", "band-swap", "stack-swap", "row-swap", "column-swap", "composition"];
    requireCondition(dto.transforms.every((record, i) => record.id === ids[i]));
    return unverified(dto);
  });
}

/** The referenced manifest hash is a claim; this decoder never follows paths. */
export function decodeUnverifiedFixtureRegistry(input: unknown): DecodeResult<Unverified<FixtureRegistryV1>> {
  return attempt(() => unverified(canonicalArtifact(input, "fixtureRegistry", fixtureRegistryV1Schema)));
}
