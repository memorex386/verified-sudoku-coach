import type { Board } from "@verified-sudoku/domain";
import { decodeLocalCoachResponse } from "@verified-sudoku/boundary-codecs";
import { localCoachOptions, localAcknowledgements, localFollowUps } from "@verified-sudoku/coach-core";

export function mountAdaptive(getBoard: () => Board, puzzleId: string, present: (option: string) => void) {
  const cap = document.querySelector<HTMLMetaElement>('meta[name="coach-capability"]')?.content;
  if (!cap) return;
  const control = { schemaId: "vsc.local-coach-control", version: 1 };
  const panel = document.getElementById("adaptive")!; panel.hidden = false;
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  let sessionId = "", connected = false, serial = Promise.resolve(), pending: AbortController | null = null;
  let generation = 0, muted = false, mistakes = 0, idle: ReturnType<typeof setTimeout> | undefined;
  const log = (text: string, player = false) => { const p = document.createElement("p"); p.textContent = text; p.className = player ? "player-message" : "coach-message";
    get("chat-log").append(p); while (get("chat-log").children.length > 12) get("chat-log").firstElementChild?.remove(); };
  const status = (text: string) => { get("ai-status").textContent = text; };
  const dto = () => { const b = getBoard(); return { schemaId: "vsc.board-state", version: 1, puzzleId,
    puzzleFingerprint: b.puzzle.puzzleFingerprint, revision: b.revision, entries: b.entries, notes: b.notes,
    boardFingerprint: b.boardFingerprint, stateFingerprint: b.stateFingerprint }; };
  async function post(route: string, data: unknown, signal?: AbortSignal) {
    const response = await fetch(route, { method: "POST", headers: { "Content-Type": "application/json",
      "X-Coach-Capability": cap!, "X-Coach-Session": sessionId }, body: JSON.stringify(data),
      signal: signal ?? AbortSignal.timeout(15000) });
    const text = await response.text(); if (text.length > 4096) throw new Error("invalid-response");
    const result = decodeLocalCoachResponse(text); if (!result) throw new Error("invalid-response");
    return result;
  }
  function cancel() {
    generation++; if (pending) { pending.abort(); pending = null; void post("/coach/cancel", control).catch(() => {}); status("Reply cancelled. You can keep playing."); }
    get<HTMLButtonElement>("send-ai").disabled = !connected;
    if (connected) resetIdle();
  }
  function invite() { if (connected && !muted && !pending && !document.hidden) get("invitation").hidden = false; }
  function resetIdle() { clearTimeout(idle); get("invitation").hidden = true; if (connected && !muted) idle = setTimeout(invite, 45000); }
  async function send(message: string) {
    if (!connected || !message.trim() || pending) return;
    cancel(); const ticket = generation, state = getBoard().stateFingerprint;
    pending = new AbortController(); const signal = AbortSignal.any([pending.signal, AbortSignal.timeout(15000)]);
    get<HTMLButtonElement>("send-ai").disabled = true; get("invitation").hidden = true; clearTimeout(idle);
    log(message, true); status("Coach is considering your question…");
    try {
      await serial;
      if (signal.aborted || ticket !== generation) return;
      const response = await post("/coach/turn", { schemaId: "vsc.local-coach-request", version: 1,
        board: dto(), message, preference: get<HTMLSelectElement>("help-preference").value }, signal);
      if (signal.aborted || ticket !== generation || getBoard().stateFingerprint !== state) return;
      if (response.type === "stale") { status("The board changed. Ask again when you're ready."); return; }
      if (response.type !== "accepted") { status("Coach is paused. Try again, or use Get help for a verified clue."); return; }
      const option = localCoachOptions(getBoard()).find(o => o.id === response.decision.option);
      if (!option || response.stateFingerprint !== state || (get<HTMLSelectElement>("help-preference").value === "nudge" && option.id === "explain")) throw new Error("invalid-response");
      pending = null;
      log(`${localAcknowledgements[response.decision.acknowledgement]} ${option.id === "pause" ? option.lesson.beats[0]!.text : ""} ${localFollowUps[response.decision.followUp]}`.trim());
      if (option.id === "pause") { muted = true; clearTimeout(idle); } else present(option.id);
      status("Verified guidance is ready. You make the move.");
    } catch { if (ticket === generation) status("Coach is paused. Try again, or use Get help for a verified clue."); }
    finally { if (ticket === generation) { pending = null; get<HTMLButtonElement>("send-ai").disabled = !connected; resetIdle(); } }
  }
  get("connect-ai").addEventListener("click", async () => {
    if (connected) return;
    try {
      const result = await post("/coach/session", control);
      if (result.type !== "session") throw new Error("session"); sessionId = result.sessionId;
      if (!result.enabled) { await post("/coach/end", control); sessionId = ""; status("Live AI is off. Configure the local server and a call grant first; no request was sent to a model."); return; }
      connected = true; muted = false; mistakes = 0; get("chat-controls").hidden = false; get<HTMLButtonElement>("send-ai").disabled = false;
      get<HTMLButtonElement>("connect-ai").disabled = true;
      await post("/coach/state", dto()); status("Connected for this session. Ask a question or keep playing."); resetIdle();
    } catch { status("Could not connect. Your board is still playable."); }
  });
  get("chat-form").addEventListener("submit", event => { event.preventDefault(); const input = get<HTMLTextAreaElement>("chat-input"); const value = input.value.trim(); if (value) { input.value = ""; void send(value); } });
  for (const button of panel.querySelectorAll<HTMLButtonElement>("[data-question]")) button.addEventListener("click", () => void send(button.dataset['question']!));
  get("cancel-ai").addEventListener("click", cancel);
  get("end-ai").addEventListener("click", () => { cancel(); connected = false; clearTimeout(idle); void post("/coach/end", control).catch(() => {}); sessionId = "";
    get("chat-controls").hidden = true; get("invitation").hidden = true; get("chat-log").replaceChildren(); get<HTMLTextAreaElement>("chat-input").value = ""; get<HTMLButtonElement>("connect-ai").disabled = false; status("Session ended. Conversation cleared."); });
  get("accept-invitation").addEventListener("click", () => void send("I'd like a small hint."));
  get("mute-invitation").addEventListener("click", () => { muted = true; clearTimeout(idle); get("invitation").hidden = true; status("I'll wait until you ask for help."); });
  document.addEventListener("coach-cancel", cancel);
  document.addEventListener("coach-board-change", () => {
    cancel(); if (!connected) return;
    const snapshot = dto(); serial = serial.then(async () => { await post("/coach/state", snapshot); }).catch(() => { status("Board sync paused. Ask again to reconnect the current position."); });
    mistakes = localCoachOptions(getBoard()).some(o => o.id === "recover") ? mistakes + 1 : 0;
    resetIdle(); if (mistakes >= 2) invite();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { clearTimeout(idle); get("invitation").hidden = true; } else resetIdle(); });
}
