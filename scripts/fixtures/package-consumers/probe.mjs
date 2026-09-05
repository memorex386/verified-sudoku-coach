// Original empty-board compatibility vectors, never proof or difficulty evidence.
import * as domain from "@verified-sudoku/domain";
import * as contracts from "@verified-sudoku/contracts";
import * as codecs from "@verified-sudoku/boundary-codecs";
import * as proof from "@verified-sudoku/proof-engine";
import * as coach from "@verified-sudoku/coach-core";
import { examples } from "./examples.mjs";
import { fixtureExamples } from "./fixture-examples.mjs";

export function probe() {
  const check = (condition) => { if (!condition) throw new Error("consumer-conformance"); };
  const vectors = [];
  for (const size of [6, 9]) {
    const puzzle = domain.createPuzzle(domain.createTopology(size), []);
    const board = domain.createBoard(puzzle, 0, [], []);
    const noted = domain.createBoard(puzzle, 1, [], [{ cellId: "r1c1", digits: [1] }]);
    const logical = domain.initialLogicalState(board);
    check(logical.fingerprint === domain.initialLogicalState(noted).fingerprint);
    check(board.stateFingerprint !== noted.stateFingerprint);
    check(Object.isFrozen(logical.candidates[0]));
    check(logical.candidates.every(({ mask }) => mask === (1 << size) - 1));
    if (size === 6) {
      check(puzzle.puzzleFingerprint === "sha256:212aa81cf4edf5339c9537f2c101de1e806990e1451d15eaa6d57c1b943216ae");
      check(logical.fingerprint === "sha256:56e54ca427519c34d123f37d87f0eab39db998952d4e6c5db46529b269d6715e");
    }
    const noteAction = domain.applyPlayerAction(board, board.revision, board.stateFingerprint,
      { type: "replace-notes", cellId: "r1c1", digits: [1, 2] });
    check(noteAction.type === "accepted");
    check(domain.initialLogicalState(noteAction.board).fingerprint === logical.fingerprint);
    const placed = domain.applyPlayerAction(noteAction.board, noteAction.board.revision, noteAction.board.stateFingerprint,
      { type: "place-value", cellId: "r1c1", digit: 2 });
    check(placed.type === "accepted" && placed.board.notes.length === 0 && placed.board.revision === 2);
    const stale = domain.applyPlayerAction(placed.board, board.revision, board.stateFingerprint,
      { type: "clear-value", cellId: "r1c1" });
    check(stale.type === "rejected" && stale.code === "stale");
    vectors.push({ size, puzzle: puzzle.puzzleFingerprint, logical: logical.fingerprint,
      playerActions: { noted: noteAction.board.stateFingerprint, placed: placed.board.stateFingerprint,
        logical: domain.initialLogicalState(placed.board).fingerprint, stale: stale.code } });
  }
  const hashes = [0, 3, 55, 56, 63, 64, 65, 119, 120, 1024].map((length) => {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 131 + 17) % 256);
    return { length, hash: domain.sha256(bytes) };
  });
  check(!contracts.puzzleDefinitionV1Schema.safeParse({ extra: true }).success);
  check(!codecs.decodePuzzle('{"schema":1,"schema":1}').ok);
  const puzzle = codecs.decodePuzzle(JSON.stringify(examples.puzzle));
  check(puzzle.ok);
  const board = codecs.decodeBoard(JSON.stringify(examples.board), puzzle.value);
  check(board.ok);
  check(codecs.encodePuzzle(puzzle.value) === domain.canonicalJson(examples.puzzle));
  check(codecs.encodeBoard(board.value) === domain.canonicalJson(examples.board));
  check(!codecs.decodePuzzle(JSON.stringify({ ...examples.puzzle, extra: true })).ok);
  const framed = codecs.decodeUnverifiedProofStep(JSON.stringify(examples.step), board.value);
  // The example deduction is deliberately false: framing must never promote it to verified.
  check(framed.ok && framed.value.verification === "unverified");
  const replay = codecs.decodeUnverifiedReplay(JSON.stringify(examples.replay));
  check(replay.ok && replay.value.verification === "unverified");
  const alteredReplay = JSON.parse(JSON.stringify(examples.replay));
  alteredReplay.records[0].action.action.digit = 4;
  const replayProjection = { ...alteredReplay };
  delete replayProjection.replayFingerprint;
  alteredReplay.replayFingerprint = domain.fingerprint("replay", replayProjection);
  const alteredResult = codecs.decodeUnverifiedReplay(JSON.stringify(alteredReplay));
  check(!alteredResult.ok && alteredResult.code === "semantic");
  const fixturePuzzle = codecs.decodePuzzle(domain.canonicalJson(fixtureExamples.puzzle));
  check(fixturePuzzle.ok);
  const artifacts = [codecs.decodeUnverifiedUniquenessReceipt(domain.canonicalJson(fixtureExamples.receipt), fixturePuzzle.value),
    codecs.decodeUnverifiedFixtureManifest(domain.canonicalJson(fixtureExamples.manifest)),
    codecs.decodeUnverifiedFixtureRegistry(domain.canonicalJson(fixtureExamples.registry))];
  check(artifacts.every((result) => result.ok && result.value.verification === "unverified"));
  check(!codecs.decodeUnverifiedFixtureRegistry(domain.canonicalJson(fixtureExamples.registry) + "\n").ok);
  const canonical = domain.canonicalJson({ z: [1, null, true], a: "\n\u0000" });
  check(canonical === '{"a":"\\n\\u0000","z":[1,null,true]}');
  return { canonical, hashes, vectors, artifactFraming: artifacts.map((result) => result.value.verification),
    replayActions: { status: replay.value.verification, alteredActionRejected: alteredResult.code },
    collisionProjection: domain.fingerprint("fixture-digit-d4", "0".repeat(81)),
    codecRoundTrip: board.value.board.stateFingerprint,
    proofFraming: framed.value.verification, exports: [domain, contracts, codecs, proof, coach]
    .map((value) => Object.keys(value).filter((key) => key !== "__esModule").sort()) };
}
