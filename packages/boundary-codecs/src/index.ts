export { decodeBehaviorIdentity, decodePuzzle, decodeBoard, decodeBoardAction, encodePuzzle, encodeBoard,
  type DecodedPuzzle, type DecodedBoard } from "./board.js";
export { decodeUnverifiedProofStep, decodeUnverifiedProofPath, type Unverified } from "./proof.js";
export { decodeUnverifiedTrace, decodeUnverifiedReplay } from "./trace.js";
export type { DecodeCode, DecodeResult, DeepReadonly } from "./json.js";
export { decodeUnverifiedUniquenessReceipt, decodeUnverifiedFixtureManifest, decodeUnverifiedFixtureRegistry } from "./fixtures.js";

export { decodeLocalCoachControl, decodeLocalCoachChoice, decodeLocalCoachResponse, decodeLocalCoachDecision, decodeLocalCoachRequest } from "./local-coach.js";
