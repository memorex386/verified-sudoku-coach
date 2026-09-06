import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { checkLocalFixture } from "./local-tutor-fixture.mjs";
import { startTutor } from "./local-tutor-server.mjs";
import { createBoard, createPuzzle, createTopology, applyPlayerAction, peers } from "@verified-sudoku/domain";
import { proposeSingle, verifySingle, readVerifiedSingle } from "@verified-sudoku/proof-engine";
import { localLesson } from "@verified-sudoku/coach-core";
import { exactCoverCount } from "../packages/testing/test/exact-cover.mjs";

const fixture = checkLocalFixture();
const initial = () => createBoard(createPuzzle(createTopology(9), fixture.givens), 0, [], []);
function route() {
  let board = initial(); const facts = [];
  for (let i = 0; i < 81; i++) {
    const result = proposeSingle(board);
    if (result.type === "solved") return facts;
    assert.equal(result.type, "proposal");
    const capability = verifySingle(board, result.proposal), fact = readVerifiedSingle(board, capability);
    assert.ok(fact); facts.push(fact);
    board = applyPlayerAction(board, board.revision, board.stateFingerprint, { type: "place-value", cellId: fact.cellId, digit: fact.digit }).board;
  }
  assert.fail("local puzzle did not finish");
}

test("local seed is the first singles-solvable attempt, independently unique and exactly regenerable", () => {
  assert.equal(fixture.provenance.seed, "vsc-fixture/v1:2");
  assert.equal(fixture.givens.length, 28);
  const grid = Array(81).fill("0");
  for (const value of fixture.givens) grid[(Number(value.cellId[1]) - 1) * 9 + Number(value.cellId[3]) - 1] = String(value.digit);
  assert.equal(exactCoverCount(grid.join("")), 1);
  assert.equal(route().length, 53);
});

test("lesson facts reference verified clues, freeze output and reject stale/forged capabilities", () => {
  let board = initial(); let naked = false;
  for (const fact of route()) {
    const capability = verifySingle(board, fact);
    for (const depth of [0, 1, 2]) {
      const lesson = localLesson(board, capability, depth);
      assert.ok(lesson && Object.isFrozen(lesson) && Object.isFrozen(lesson.beats[0].cells));
      if (depth === 2 && fact.technique === "naked-single") {
        naked = true;
        assert.equal(lesson.beats.filter(beat => beat.ruledOut !== null).length, 8);
        for (const beat of lesson.beats.filter(beat => beat.ruledOut !== null)) {
          const witness = [...board.puzzle.givens, ...board.entries].find(value => value.cellId === beat.cells[0]);
          assert.equal(witness.digit, beat.ruledOut);
          assert.ok(peers(board.puzzle.topology, fact.cellId).includes(witness.cellId));
          assert.notEqual(beat.ruledOut, fact.digit);
        }
      }
    }
    assert.equal(localLesson(board, {}, 0), null);
    assert.equal(localLesson(board, capability, 3), null);
    const next = applyPlayerAction(board, board.revision, board.stateFingerprint, { type: "place-value", cellId: fact.cellId, digit: fact.digit }).board;
    assert.equal(localLesson(next, capability, 2), null); board = next;
  }
  assert.ok(naked); // Hidden singles also covered by the dedicated synthetic proof cases.
});

test("local browser supports hints, notes, clear/undo, interruption, keyboard and full completion", { timeout: 90000 }, async (t) => {
  const server = await startTutor(0);
  t.after(() => server.close());
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push(request.url()));
  try {
    await page.goto(server.url); await page.locator("#r1c1").waitFor();
    assert.equal(await page.locator("#progress").textContent(), "28 / 81 filled");
    const first = route()[0];
    await page.locator("#help").click();
    assert.equal(await page.locator("#lesson-title").textContent(), "A small nudge");
    assert.equal(await page.locator("#progress").textContent(), "28 / 81 filled");
    await page.locator("#deeper").click(); await page.locator("#deeper").click();
    if (first.technique === "naked-single") {
      await page.locator("#pause").click();
      const paused = await page.locator("#lesson-text").textContent();
      await page.waitForTimeout(750); assert.equal(await page.locator("#lesson-text").textContent(), paused);
      await page.locator("#show-all").click(); assert.equal(await page.locator(".ruled-out").count(), 8);
    }
    await page.locator("#smaller").click(); assert.equal(await page.locator("#lesson-title").textContent(), "Look a little closer");
    await page.locator("#notes").click(); await page.getByRole("button", { name: "Enter 9", exact: true }).click();
    assert.equal(await page.locator("#coach").isVisible(), false);
    assert.equal(await page.locator(`#${first.cellId}`).textContent(), "9");
    await page.locator("#clear").click(); assert.equal(await page.locator(`#${first.cellId}`).textContent(), "");
    await page.locator("#undo").click(); assert.equal(await page.locator(`#${first.cellId}`).textContent(), "9");
    await page.locator("#notes").click();
    await page.getByRole("button", { name: `Enter ${first.digit === 9 ? 1 : 9}`, exact: true }).click();
    await page.locator("#help").click(); assert.equal(await page.locator("#lesson-title").textContent(), "Let's check an entry");
    await page.locator("#undo").click();
    await page.locator(`#${first.cellId}`).focus(); await page.keyboard.press("ArrowRight");
    assert.notEqual(await page.locator(":focus").getAttribute("id"), first.cellId);
    await page.reload(); await page.locator("#r1c1").waitFor();
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const fact of route()) {
      await page.locator("#help").click();
      assert.equal(await page.locator(".selected").getAttribute("id"), fact.cellId);
      await page.locator("#deeper").click(); await page.locator("#deeper").click();
      assert.equal(await page.locator("#show-all").isVisible(), false);
      await page.locator(`#${fact.cellId}`).click(); await page.keyboard.press(String(fact.digit));
      assert.equal(await page.locator("#coach").isVisible(), false);
    }
    assert.equal(await page.locator("#progress").textContent(), "81 / 81 filled");
    assert.match(await page.locator("#status").textContent(), /Puzzle complete/);
    await page.locator("#undo").click(); assert.equal(await page.locator("#progress").textContent(), "80 / 81 filled");
    await page.locator("#help").click(); await page.keyboard.press("Escape"); assert.equal(await page.locator(":focus").getAttribute("id"), "help");
    for (const width of [320, 390, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    assert.deepEqual(errors, []);
    assert.ok(requests.every(url => url.startsWith(server.url + "/")));
  } finally { await browser.close(); }
});
