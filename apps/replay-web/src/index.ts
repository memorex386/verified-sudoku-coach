import { createBoard, applyPlayerAction, cells, type Board, type CellId } from "@verified-sudoku/domain";
import { decodePuzzle } from "@verified-sudoku/boundary-codecs";
import { proposeSingle, verifySingle, readVerifiedSingle, type VerifiedSingle } from "@verified-sudoku/proof-engine";
import { localLesson, type LocalLesson } from "@verified-sudoku/coach-core";
import { localPuzzle } from "./local-puzzle.js";

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const decoded = decodePuzzle(localPuzzle);
if (!decoded.ok) throw new Error("local-puzzle-invalid");
let board = createBoard(decoded.value.puzzle, 0, [], []);
const all = cells(board.puzzle.topology), history: Board[] = [];
let selected = all.find(cell => !board.puzzle.givens.some(value => value.cellId === cell))!;
let notes = false, capability: VerifiedSingle | null = null, depth: 0 | 1 | 2 = 0;
let lesson: LocalLesson | null = null, shown = 0, timer: ReturnType<typeof setTimeout> | undefined;
let paused = false, highlighted: readonly CellId[] = [], active: readonly CellId[] = [], wrong: CellId[] = [];

// Derive a completion with verified singles; no separate solution is embedded in the fixture.
function completion(initial: Board): Map<CellId, number> {
  let state = initial;
  for (let i = 0; i < 81; i++) {
    const found = proposeSingle(state);
    if (found.type === "solved") return new Map([...state.puzzle.givens, ...state.entries].map(value => [value.cellId, value.digit]));
    if (found.type !== "proposal") break;
    const proof = verifySingle(state, found.proposal), fact = proof && readVerifiedSingle(state, proof);
    if (!fact) break;
    const result = applyPlayerAction(state, state.revision, state.stateFingerprint, { type: "place-value", cellId: fact.cellId, digit: fact.digit });
    if (result.type !== "accepted") break;
    state = result.board;
  }
  throw new Error("local-puzzle-unsupported");
}
const solution = completion(board);
const notice = (text: string) => { el("status").textContent = text; };
function stopStory() { clearTimeout(timer); timer = undefined; }
function dismiss() {
  stopStory(); capability = null; lesson = null; highlighted = []; active = []; shown = 0;
  el("coach").hidden = true; renderBoard();
}
function renderBoard() {
  wrong = board.entries.filter(value => solution.get(value.cellId) !== value.digit).map(value => value.cellId);
  const fixed = new Map(board.puzzle.givens.map(value => [value.cellId, value.digit]));
  const entered = new Map(board.entries.map(value => [value.cellId, value.digit]));
  for (const cell of all) {
    const button = el<HTMLButtonElement>(cell), value = fixed.get(cell) ?? entered.get(cell);
    const digits = board.notes.find(note => note.cellId === cell)?.digits ?? [];
    button.textContent = value ? String(value) : digits.join(" ");
    button.className = ["cell", fixed.has(cell) ? "given" : "", !value && digits.length ? "pencil" : "",
      cell === selected ? "selected" : "", highlighted.includes(cell) ? "highlight" : "", active.includes(cell) ? "active" : "", wrong.includes(cell) ? "wrong" : ""].join(" ");
    button.tabIndex = cell === selected ? 0 : -1;
    button.setAttribute("aria-selected", String(cell === selected));
    button.setAttribute("aria-label", `Row ${cell[1]}, column ${cell[3]}, ${value ? `${value}${fixed.has(cell) ? ", given" : ""}` : digits.length ? `notes ${digits.join(", ")}` : "empty"}${wrong.includes(cell) ? ", check this entry" : ""}`);
  }
  el("progress").textContent = `${board.puzzle.givens.length + board.entries.length} / 81 filled`;
  el<HTMLButtonElement>("undo").disabled = history.length === 0;
  el("notes").setAttribute("aria-pressed", String(notes));
  el("notes").textContent = notes ? "Notes on" : "Notes off";
  if (board.entries.length + board.puzzle.givens.length === 81 && wrong.length === 0) notice("Puzzle complete. Nicely reasoned!");
}
function mutate(action: Parameters<typeof applyPlayerAction>[3]) {
  const result = applyPlayerAction(board, board.revision, board.stateFingerprint, action);
  if (result.type !== "accepted") { notice("That square cannot be changed that way."); return; }
  history.push(board); board = result.board; dismiss();
  notice(wrong.length ? "An entry needs another look. Get help or undo when you're ready." : "Board updated."); renderBoard();
}
function enter(digit: number) {
  if (notes) {
    const previous: readonly number[] = board.notes.find(note => note.cellId === selected)?.digits ?? [];
    mutate({ type: "replace-notes", cellId: selected, digits: previous.includes(digit) ? previous.filter(d => d !== digit) : [...previous, digit].sort((a, b) => a - b) });
  } else mutate({ type: "place-value", cellId: selected, digit });
}
function undo() {
  const previous = history.pop(); if (!previous) return;
  board = createBoard(board.puzzle, board.revision + 1, previous.entries, previous.notes);
  dismiss(); notice("Last change undone."); renderBoard();
}
function renderStory() {
  if (!lesson || !capability || !readVerifiedSingle(board, capability)) { dismiss(); return; }
  const visible = lesson.beats.slice(0, shown);
  el("lesson-title").textContent = lesson.title; el("lesson-text").textContent = visible.map(beat => beat.text).join(" ");
  highlighted = visible.flatMap(beat => beat.cells); active = visible.at(-1)?.cells ?? [];
  el("strip").hidden = !visible.some(beat => beat.ruledOut !== null);
  for (let digit = 1; digit <= 9; digit++) {
    const excluded = visible.some(beat => beat.ruledOut === digit);
    el(`candidate-${digit}`).classList.toggle("ruled-out", excluded);
    el(`candidate-${digit}`).setAttribute("aria-label", `${digit}${excluded ? ", ruled out" : ""}`);
  }
  el<HTMLButtonElement>("smaller").disabled = depth === 0; el<HTMLButtonElement>("deeper").disabled = depth === 2;
  el("deeper").textContent = depth === 0 ? "Stronger hint" : "Explain";
  el("pause").hidden = lesson.beats.length < 2 || shown >= lesson.beats.length;
  el("show-all").hidden = lesson.beats.length < 2 || shown >= lesson.beats.length;
  el("pause").textContent = paused ? "Continue" : "Pause";
  if (shown >= lesson.beats.length) el("lesson-announcement").textContent = el("lesson-text").textContent;
  renderBoard();
}
function tick() {
  if (!lesson || paused || shown >= lesson.beats.length) return;
  shown++; renderStory(); if (lesson && shown < lesson.beats.length) timer = setTimeout(tick, 650);
}
function showLesson() {
  stopStory(); lesson = capability && localLesson(board, capability, depth);
  if (!lesson) { dismiss(); notice("A verified hint is unavailable. You can keep playing."); return; }
  selected = lesson.target; paused = false; shown = 0;
  el("coach").hidden = false; el("lesson-controls").hidden = false; el("lesson-announcement").textContent = "";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { shown = lesson.beats.length; renderStory(); } else tick();
}
function help() {
  dismiss(); el("coach").hidden = false;
  if (wrong.length) {
    highlighted = wrong; selected = wrong[0]!; el("lesson-title").textContent = "Let's check an entry";
    el("lesson-text").textContent = "The highlighted entry doesn't fit this uniquely solvable puzzle. Clear it or use Undo, then ask for a hint.";
    el("lesson-controls").hidden = true; el("strip").hidden = true; renderBoard();
  } else {
    const found = proposeSingle(board);
    if (found.type === "proposal") { capability = verifySingle(board, found.proposal); depth = 0; showLesson(); }
    else {
      el("lesson-title").textContent = found.type === "solved" ? "You finished!" : "No single available";
      el("lesson-text").textContent = found.type === "solved" ? "Every row, column and box is complete." : "This tutor only teaches singles. You can keep playing without a hint.";
      el("lesson-controls").hidden = true; el("strip").hidden = true;
    }
  }
  el("close").focus();
}
for (let row = 0; row < 9; row++) {
  const line = document.createElement("div"); line.className = "row"; line.setAttribute("role", "row");
  for (const cell of all.slice(row * 9, row * 9 + 9)) {
    const button = document.createElement("button"); button.id = cell; button.type = "button"; button.setAttribute("role", "gridcell");
    button.addEventListener("click", () => { selected = cell; renderBoard(); }); line.append(button);
  }
  el("board").append(line);
}
for (let digit = 1; digit <= 9; digit++) {
  const button = document.createElement("button"); button.textContent = String(digit); button.type = "button";
  button.setAttribute("aria-label", `Enter ${digit}`); button.addEventListener("click", () => enter(digit)); el("keypad").append(button);
  const item = document.createElement("span"); item.id = `candidate-${digit}`; item.textContent = String(digit); el("strip").append(item);
}
el("notes").addEventListener("click", () => { notes = !notes; renderBoard(); });
el("clear").addEventListener("click", () => mutate(board.entries.some(value => value.cellId === selected)
  ? { type: "clear-value", cellId: selected } : { type: "replace-notes", cellId: selected, digits: [] }));
el("undo").addEventListener("click", undo); el("help").addEventListener("click", help);
el("close").addEventListener("click", () => { dismiss(); el("help").focus(); });
el("deeper").addEventListener("click", () => { if (depth < 2) { depth = (depth + 1) as 1 | 2; showLesson(); } });
el("smaller").addEventListener("click", () => { if (depth > 0) { depth = (depth - 1) as 0 | 1; showLesson(); } });
el("show-all").addEventListener("click", () => { stopStory(); if (lesson) { shown = lesson.beats.length; renderStory(); el("close").focus(); } });
el("pause").addEventListener("click", () => { paused = !paused; stopStory(); renderStory(); if (!paused) tick(); });
document.addEventListener("keydown", event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^[1-9]$/.test(event.key)) { event.preventDefault(); enter(Number(event.key)); }
  else if (event.key === "Escape") { dismiss(); el("help").focus(); }
  else if (event.target instanceof HTMLElement && event.target.getAttribute("role") === "gridcell") {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 }[event.key];
    if (delta !== undefined) { event.preventDefault(); selected = all[(all.indexOf(selected) + delta + 81) % 81]!; renderBoard(); el(selected).focus(); }
    if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); el("clear").click(); }
  }
});
renderBoard();
