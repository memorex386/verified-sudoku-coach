import { randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { decodeLocalCoachControl, decodePuzzle, decodeBoard, decodeLocalCoachRequest, decodeLocalCoachChoice } from "@verified-sudoku/boundary-codecs";
import { localCoachOptions } from "@verified-sudoku/coach-core";
import type { Board } from "@verified-sudoku/domain";

type Outcome = { type: "ok"; decision: unknown } | { type: "paused"; code: string };
export type TeacherPort = (packet: string, signal: AbortSignal) => Promise<Outcome>;
type Session = { board: Board | null; recent: { message: string; option: string }[]; moves: number;
  mistakes: number; call: AbortController | null; expires: ReturnType<typeof setTimeout>; };
const write = (response: ServerResponse, status: number, value: object) => {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify({ schemaId: "vsc.local-coach-response", version: 1, ...value }));
};
export function createLocalGateway(puzzleText: string, teacher: TeacherPort | null, maxCalls: number) {
  const decoded = decodePuzzle(puzzleText); if (!decoded.ok) throw new Error("local-fixture-invalid");
  const puzzle = decoded.value;
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 0 || maxCalls > 20) throw new Error("invalid-call-grant");
  const capability = randomBytes(32).toString("hex"), sessions = new Map<string, Session>();
  let attempts = 0, lastCall = 0, inFlight = false;
  const enabled = teacher !== null && maxCalls > 0;
  const end = (id: string) => { const session = sessions.get(id); if (session) { session.call?.abort(); clearTimeout(session.expires); session.recent.length = 0; sessions.delete(id); } };
  async function handle(request: IncomingMessage, response: ServerResponse, origin: string): Promise<void> {
    const supplied = request.headers['x-coach-capability'];
    if (request.headers.host !== new URL(origin).host || request.headers.origin !== origin || typeof supplied !== "string" ||
      Buffer.byteLength(supplied) !== capability.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(capability))) { write(response, 403, { type: "paused", code: "access" }); return; }
    if (request.method !== "POST" || !["/coach/session", "/coach/state", "/coach/turn", "/coach/cancel", "/coach/end"].includes(request.url ?? "") ||
      request.headers['content-type'] !== "application/json") { write(response, 400, { type: "paused", code: "request" }); return; }
    let body = "", bytes = 0;
    const bodyTimer = setTimeout(() => request.destroy(), 5000); bodyTimer.unref();
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) { bytes += chunk.length; if (bytes > 32768) { write(response, 413, { type: "paused", code: "size" }); return; } chunks.push(Buffer.from(chunk)); }
      body = Buffer.concat(chunks).toString("utf8");
    } catch { write(response, 400, { type: "paused", code: "request" }); return; }
    finally { clearTimeout(bodyTimer); }
    try { JSON.parse(body); } catch { write(response, 400, { type: "paused", code: "request" }); return; }
    if (request.url === "/coach/session") {
      if (!decodeLocalCoachControl(body)) { write(response, 400, { type: "paused", code: "request" }); return; }
      if (sessions.size >= 4) { write(response, 429, { type: "paused", code: "sessions" }); return; }
      const id = randomBytes(16).toString("hex"), expires = setTimeout(() => end(id), 30 * 60 * 1000); expires.unref();
      sessions.set(id, { board: null, recent: [], moves: 0, mistakes: 0, call: null, expires });
      write(response, 200, { type: "session", sessionId: id, enabled, remainingCalls: Math.max(0, maxCalls - attempts) }); return;
    }
    const id = request.headers['x-coach-session']; const session = typeof id === "string" ? sessions.get(id) : undefined;
    if (!session) { write(response, 403, { type: "paused", code: "session" }); return; }
    if (request.url === "/coach/end" || request.url === "/coach/cancel") {
      if (!decodeLocalCoachControl(body)) { write(response, 400, { type: "paused", code: "request" }); return; }
      session.call?.abort();
      if (request.url === "/coach/end") end(id as string);
      write(response, 200, { type: "ack" }); return;
    }
    const turn = request.url === "/coach/turn" ? decodeLocalCoachRequest(body, puzzle) : null;
    const state = request.url === "/coach/state" ? decodeBoard(body, puzzle) : null;
    const board = turn?.board ?? (state?.ok ? state.value.board : null);
    if (!board) { write(response, 400, { type: "paused", code: "request" }); return; }
    if (session.board && (board.revision < session.board.revision ||
      (board.revision === session.board.revision && board.stateFingerprint !== session.board.stateFingerprint))) { write(response, 409, { type: "stale" }); return; }
    const changed = session.board?.stateFingerprint !== board.stateFingerprint;
    if (changed) { session.call?.abort(); if (session.board) session.moves++; }
    session.board = board;
    const options = localCoachOptions(board);
    if (changed && options.some(o => o.id === "recover")) session.mistakes++;
    if (!turn) { write(response, 200, { type: "ack" }); return; }
    if (!enabled) { write(response, 503, { type: "paused", code: "not-enabled" }); return; }
    if (inFlight || Date.now() - lastCall < 2500) { write(response, 429, { type: "paused", code: "cadence" }); return; }
    if (attempts >= maxCalls) { write(response, 429, { type: "paused", code: "budget" }); return; }
    // Preference constrains disclosure even if the model requests a stronger option.
    const allowed = turn.preference === "nudge" ? options.filter(o => o.id !== "explain") : options;
    const packet = JSON.stringify({ message: turn.message, preference: turn.preference, recent: session.recent,
      progress: { filled: board.entries.length + board.puzzle.givens.length, moves: session.moves, mistakes: session.mistakes },
      options: allowed.map(o => ({ id: o.id, title: o.lesson.title, beats: o.lesson.beats })) });
    const controller = new AbortController(); session.call = controller; inFlight = true; attempts++; lastCall = Date.now();
    response.once("close", () => controller.abort());
    try {
      const outcome = await teacher!(packet, controller.signal);
      if (controller.signal.aborted || session.board.stateFingerprint !== board.stateFingerprint || !sessions.has(id as string)) { write(response, 200, { type: "stale" }); return; }
      if (outcome.type !== "ok") { write(response, 200, { type: "paused", code: ["timeout", "refusal", "quota", "provider", "invalid", "cancelled"].includes(outcome.code) ? outcome.code : "provider" }); return; }
      const decision = decodeLocalCoachChoice(outcome.decision, board, turn.preference);
      if (!decision || !allowed.some(o => o.id === decision.option) || (decision.option === "pause" && decision.followUp !== "none")) { write(response, 200, { type: "paused", code: "invalid" }); return; }
      session.recent = [...session.recent, { message: turn.message, option: decision.option }].slice(-4);
      write(response, 200, { type: "accepted", stateFingerprint: board.stateFingerprint, decision });
    } catch { write(response, 200, { type: "paused", code: "provider" }); }
    finally { session.call = null; inFlight = false; }
  }
  return { capability, enabled, handle, close: () => { for (const id of sessions.keys()) end(id); } };
}
