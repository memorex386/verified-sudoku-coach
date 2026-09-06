import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { request as httpRequest } from "node:http";
import { chromium } from "playwright";
import { startAiTutor, loadLocalRegistration } from "./local-ai-tutor-server.mjs";
import { localFixture } from "./local-tutor-fixture.mjs";
import { createBoard, createPuzzle, createTopology, applyPlayerAction } from "@verified-sudoku/domain";
import { decodeLocalCoachChoice, decodeLocalCoachRequest, decodeLocalCoachDecision, decodePuzzle } from "@verified-sudoku/boundary-codecs";
import { localCoachDecisionV1Schema } from "@verified-sudoku/contracts";
import { createTeacher } from "@verified-sudoku/adapter-openai";
import { localCoachOptions } from "@verified-sudoku/coach-core";

if (!fs.existsSync(chromium.executablePath())) {
  const installed = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/playwright/cli.js", import.meta.url)),
    "install", ...(process.platform === "linux" ? ["--with-deps"] : []), "--no-shell", "chromium"], { stdio: "inherit", timeout: 240000 });
  assert.equal(installed.status, 0, "pinned Chromium installation failed");
}
const fixture = localFixture(), puzzle = createPuzzle(createTopology(9), fixture.givens);
const initial = () => createBoard(puzzle, 0, [], []);
const dto = board => ({ schemaId: "vsc.board-state", version: 1, puzzleId: fixture.puzzleId,
  puzzleFingerprint: puzzle.puzzleFingerprint, revision: board.revision, entries: board.entries, notes: board.notes,
  boardFingerprint: board.boardFingerprint, stateFingerprint: board.stateFingerprint });
const control = { schemaId: "vsc.local-coach-control", version: 1 };
const decision = (option = "nudge") => ({ schemaId: "vsc.local-coach-decision", version: 1, option, acknowledgement: "listen", followUp: option === "pause" ? "none" : "try" });
const turn = (board = initial(), message = "A small hint, please.", preference = "balanced") => ({ schemaId: "vsc.local-coach-request", version: 1, board: dto(board), message, preference });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function client(t, teacher, maxCalls = 20) {
  const server = await startAiTutor({ port: 0, teacher, maxCalls }); t.after(() => server.close());
  const html = await (await fetch(server.url)).text(), cap = html.match(/name="coach-capability" content="([a-f0-9]+)"/)[1];
  let id = "";
  const request = (route, body, extra = {}) => new Promise((resolve, reject) => {
    const req = httpRequest(server.url + route, { method: "POST", headers: { Origin: server.url,
      "Content-Type": "application/json", "X-Coach-Capability": cap, "X-Coach-Session": id, ...extra } }, res => {
      const chunks = []; res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode })));
    }); req.on("error", reject); req.end(typeof body === "string" ? body : JSON.stringify(body));
  });
  assert.equal((await request("/coach/session", {})).status, 400);
  id = (await (await request("/coach/session", control)).json()).sessionId;
  return { server, request };
}

test("frozen semantic suite rejects unsupported facts and disclosure changes with exact contract decoding", () => {
  const suite = JSON.parse(fs.readFileSync("tools/eval-cli/suites/local-adaptive-v1.json", "utf8"));
  const report = JSON.parse(fs.readFileSync("docs/evaluation/reports/local-adaptive-v1.json", "utf8"));
  let accepted = 0;
  for (const item of suite.cases) {
    const result = decodeLocalCoachChoice(item.decision, initial(), item.preference);
    assert.equal(result !== null, item.accepted, item.id); if (result) accepted++;
  }
  assert.equal(suite.cases.length, report.cases); assert.equal(accepted, report.expectedAccepted);
  assert.equal(suite.cases.length - accepted, report.expectedRejected);
  const decoded = decodePuzzle(JSON.stringify(fixture));
  assert.ok(decodeLocalCoachRequest(JSON.stringify(turn()), decoded.value));
  assert.equal(decodeLocalCoachRequest({ ...turn(), extra: true }, decoded.value), null);
  assert.equal(decodeLocalCoachRequest(turn(initial(), "x".repeat(281)), decoded.value), null);
  assert.equal(decodeLocalCoachRequest(JSON.stringify(turn()).replace('"message":', '"message":"first","message":'), decoded.value), null);
  assert.equal(decodeLocalCoachDecision(JSON.stringify(decision()).replace('"option":', '"option":"explain","option":')), null);
  assert.deepEqual(decodeLocalCoachDecision(JSON.stringify(decision())), decision());
  assert.equal(decodeLocalCoachDecision({ ...decision(), version: 2 }), null);
  const schema = localCoachDecisionV1Schema.toJSONSchema(); delete schema.$schema;
  assert.deepEqual(JSON.parse(fs.readFileSync("packages/contracts/schemas/local-adaptive-v1.json", "utf8")), schema);
  assert.equal(loadLocalRegistration().requestedModel, "gpt-5.6-terra");
});

test("provider request is bounded, tool-free and non-storing; refusals, invalid output and errors are redacted", async () => {
  const registration = loadLocalRegistration(); let captured, calls = 0;
  const response = (patch = {}) => new Response(JSON.stringify({ status: "completed", model: registration.requestedModel,
    service_tier: "default", usage: { input_tokens: 100, output_tokens: 30 },
    output: [{ content: [{ type: "output_text", text: JSON.stringify(decision()) }] }], ...patch }));
  const transport = async (url, init) => { calls++; captured = { url, init }; return response(); };
  const provider = createTeacher(registration, "test-sentinel-key", transport);
  assert.equal((await provider("{}", new AbortController().signal)).type, "ok");
  const body = JSON.parse(captured.init.body);
  assert.equal(body.store, false); assert.deepEqual(body.tools, []); assert.equal(body.max_output_tokens, 768);
  assert.equal(body.text.format.strict, true); assert.equal(captured.init.redirect, "error");
  assert.equal((await provider("x".repeat(16001), new AbortController().signal)).type, "paused"); assert.equal(calls, 1);
  for (const [result, code] of [[response({ output: [{ content: [{ type: "refusal" }] }] }), "refusal"],
    [response({ model: "other" }), "invalid"], [response({ status: "incomplete" }), "invalid"],
    [new Response("private-error-sentinel", { status: 429 }), "quota"], [new Response("private-error-sentinel", { status: 500 }), "provider"],
    [new Response("x".repeat(131073)), "invalid"]]) {
    const outcome = await createTeacher(registration, "test-sentinel-key", async () => result)("{}", new AbortController().signal);
    assert.deepEqual(outcome, { type: "paused", code }); assert.ok(!JSON.stringify(outcome).includes("sentinel"));
  }
  const controller = new AbortController(); controller.abort();
  assert.deepEqual(await provider("{}", controller.signal), { type: "paused", code: "cancelled" }); assert.equal(calls, 1);
  const timed = createTeacher({ ...registration, timeoutMs: 20 }, "test-sentinel-key", async (_, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("sentinel")))));
  assert.deepEqual(await timed("{}", new AbortController().signal), { type: "paused", code: "timeout" });
});

test("gateway rejects hostile access, routes and bodies before inference and never forwards board or notes", async t => {
  const packets = []; const { request, server } = await client(t, async packet => { packets.push(JSON.parse(packet)); return { type: "ok", decision: decision() }; });
  for (const headers of [{ Origin: "https://hostile.invalid" }, { Origin: "null" }, { Host: "rebind.invalid" }, { "X-Coach-Capability": "wrong" }, { "X-Coach-Session": "wrong" }]) {
    assert.equal((await request("/coach/turn", turn(), headers)).status, 403);
  }
  for (const [route, body] of [["/coach/unknown", {}], ["/coach/turn", { ...turn(), model: "other" }], ["/coach/turn", { ...turn(), board: { ...dto(initial()), revision: 99 } }]]) {
    assert.equal((await request(route, body)).status, 400);
  }
  assert.equal((await request("/coach/turn", "x".repeat(32769))).status, 413); assert.equal(packets.length, 0);
  const response = await (await request("/coach/turn", turn())).json(); assert.equal(response.type, "accepted");
  assert.equal(packets.length, 1); assert.equal(packets[0].message, "A small hint, please.");
  for (const forbidden of ["entries", "notes", "boardFingerprint", "puzzleFingerprint", "puzzleId", "solution"]) assert.ok(!JSON.stringify(packets).includes(forbidden));
  const html = await (await fetch(server.url)).text(); assert.ok(!html.includes("OPENAI_API_KEY"));
  const bundle = await (await fetch(server.url + "/src/bundle.js")).text();
  // Scan JavaScript source text for forbidden server-only strings; this is not URL admission.
  assert.doesNotMatch(bundle, /api\.openai\.com/);
  assert.doesNotMatch(bundle, /OPENAI_API_KEY/);
});

test("session context adapts across turns, rejects over-reveals, and ends without resetting the launch budget", async t => {
  const packets = []; const { request } = await client(t, async packet => { packets.push(JSON.parse(packet)); return { type: "ok", decision: decision(packets.length === 1 ? "nudge" : "explain") }; }, 2);
  assert.equal((await (await request("/coach/turn", turn())).json()).type, "accepted");
  assert.equal((await (await request("/coach/turn", turn())).json()).code, "cadence");
  await sleep(2600);
  const second = await (await request("/coach/turn", turn(initial(), "Please explain why", "nudge"))).json();
  assert.equal(second.code, "invalid"); assert.deepEqual(packets[1].recent, [{ message: "A small hint, please.", option: "nudge" }]);
  assert.ok(!packets[1].options.some(o => o.id === "explain"));
  await sleep(2600); assert.equal((await (await request("/coach/turn", turn())).json()).code, "budget");
  await request("/coach/end", control); assert.equal((await request("/coach/turn", turn())).status, 403);
});

test("changed boards abort pending teaching and stale responses never display; incorrect entries offer recovery only", async t => {
  let finish, called; const started = new Promise(resolve => { called = resolve; });
  const { request } = await client(t, async () => { called(); return new Promise(resolve => { finish = resolve; }); });
  const waiting = request("/coach/turn", turn()); await started;
  const wrong = applyPlayerAction(initial(), 0, initial().stateFingerprint, { type: "place-value", cellId: "r1c1", digit: 6 }).board;
  assert.ok(localCoachOptions(wrong).some(o => o.id === "recover"));
  assert.equal((await (await request("/coach/state", dto(wrong))).json()).type, "ack");
  finish({ type: "ok", decision: decision() }); assert.equal((await (await waiting).json()).type, "stale");
  assert.equal((await request("/coach/state", dto(initial()))).status, 409);
  assert.equal(decodeLocalCoachChoice(decision("explain"), wrong, "balanced"), null);
});

test("browser chat keeps text separate from moves, renders verified choices, cancels replies and clears session", { timeout: 45000 }, async t => {
  let count = 0;
  const server = await startAiTutor({ port: 0, maxCalls: 20, teacher: async (packet, signal) => {
    count++; const data = JSON.parse(packet); await sleep(200);
    return signal.aborted ? { type: "paused", code: "cancelled" } : { type: "ok", decision: decision(data.message.includes("why") ? "explain" : "compare") };
  } }); t.after(() => server.close());
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.clock.install();
  await page.goto(server.url); await page.locator("#connect-ai").click();
  await page.locator("#chat-controls").waitFor();
  await page.locator("#chat-input").fill("why is 3 here?");
  assert.equal(await page.locator("#progress").textContent(), "28 / 81 filled");
  await page.locator("#send-ai").click(); await page.waitForFunction(() => document.getElementById("lesson-title").textContent === "Why it works");
  assert.equal(count, 1); assert.equal(await page.locator("#progress").textContent(), "28 / 81 filled");
  await sleep(2600); await page.locator("#chat-input").fill("a smaller step please"); await page.locator("#send-ai").click();
  await page.locator("#cancel-ai").click(); await sleep(300);
  assert.match(await page.locator("#ai-status").textContent(), /cancelled/);
  const beforeInvite = count;
  await page.clock.fastForward(45001); assert.equal(await page.locator("#invitation").isVisible(), true);
  assert.equal(count, beforeInvite);
  await page.locator("#mute-invitation").click(); await page.clock.fastForward(45001);
  assert.equal(await page.locator("#invitation").isVisible(), false); assert.equal(count, beforeInvite);
  await page.locator("#end-ai").click(); assert.equal(await page.locator("#chat-log").textContent(), "");
  assert.equal(await page.locator("#chat-controls").isVisible(), false);
  await page.setViewportSize({ width: 320, height: 844 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
});

test("disabled live mode makes no model request and still exposes a playable board", async t => {
  const { request } = await client(t, null, 0);
  assert.equal((await (await request("/coach/turn", turn())).json()).code, "not-enabled");
});
