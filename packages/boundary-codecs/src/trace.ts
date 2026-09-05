import { traceEnvelopeV1Schema, replayArtifactV1Schema, type TraceEnvelopeV1, type ReplayArtifactV1 } from "@verified-sudoku/contracts";
import { fingerprint, canonicalJson, applyPlayerAction, type Fingerprint } from "@verified-sudoku/domain";
import { actionShape, boardValue, puzzleValue } from "./board.js";
import { pathValue, stepValue, unverified, type Unverified } from "./proof.js";
import { attempt, parseSchema, requireCondition, type DecodeResult } from "./json.js";

function timestamp(value: string): void {
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  requireCondition(year > 0 && day <= days[month - 1]!);
}
export function decodeUnverifiedTrace(input: unknown): DecodeResult<Unverified<TraceEnvelopeV1>> {
  return attempt(() => {
    const dto = parseSchema(input, "trace", traceEnvelopeV1Schema);
    const puzzle = puzzleValue(dto.puzzle);
    requireCondition(dto.behaviorIdentityHash === fingerprint("behavior-identity", dto.behaviorIdentity), "fingerprint");
    requireCondition(dto.traceRevision === dto.events.length);
    timestamp(dto.lifecycle.startedAt);
    if (dto.lifecycle.state === "closed") {
      timestamp(dto.lifecycle.closedAt);
      requireCondition(dto.lifecycle.startedAt <= dto.lifecycle.closedAt);
    }
    let previous = dto.lifecycle.startedAt;
    const ids = new Set<string>();
    for (const [i, event] of dto.events.entries()) {
      requireCondition(event.sequence === i + 1 && !ids.has(event.eventId)); ids.add(event.eventId);
      requireCondition(event.behaviorIdentityHash === dto.behaviorIdentityHash, "reference");
      timestamp(event.recordedAt);
      requireCondition(event.recordedAt >= previous && (dto.lifecycle.state === "open" || event.recordedAt <= dto.lifecycle.closedAt));
      previous = event.recordedAt;
      if (event.type === "board-state") boardValue(event.payload, puzzle);
      if (event.type === "board-action") actionShape(event.payload, puzzle);
      if (event.type === "proof-step") stepValue(event.payload, puzzle);
      if (event.type === "proof-path") pathValue(event.payload, puzzle);
    }
    const { traceFingerprint, ...projection } = dto;
    requireCondition(traceFingerprint === fingerprint("trace", projection), "fingerprint");
    return unverified(dto);
  });
}
/** Executes player actions and checks framing. Path deductions remain explicitly unverified. */
export function decodeUnverifiedReplay(input: unknown): DecodeResult<Unverified<ReplayArtifactV1>> {
  return attempt(() => {
    const dto = parseSchema(input, "replay", replayArtifactV1Schema);
    requireCondition(dto.puzzle.provenance.kind === "generated");
    const puzzle = puzzleValue(dto.puzzle);
    let current = boardValue(dto.initialBoard, puzzle);
    requireCondition(dto.behaviorIdentityHash === fingerprint("behavior-identity", dto.behaviorIdentity), "fingerprint");
    const ids = new Set<string>();
    for (const [i, record] of dto.records.entries()) {
      requireCondition(record.sequence === i + 1 && !ids.has(record.action.commandId)); ids.add(record.action.commandId);
      actionShape(record.action, puzzle);
      const applied = applyPlayerAction(current.board, record.action.expectedRevision,
        record.action.expectedStateFingerprint as Fingerprint, record.action.action);
      if (record.result.type === "accepted") {
        requireCondition(applied.type === "accepted");
        const next = boardValue(record.result.board, puzzle);
        requireCondition(canonicalJson(applied.board) === canonicalJson(next.board));
        current = next;
        pathValue(record.result.proofPath, puzzle, current);
      } else {
        requireCondition(applied.type === "rejected" && applied.code === record.result.code);
        requireCondition(record.result.stateFingerprint === current.dto.stateFingerprint);
      }
    }
    const { replayFingerprint, ...projection } = dto;
    requireCondition(replayFingerprint === fingerprint("replay", projection), "fingerprint");
    return unverified(dto);
  });
}
