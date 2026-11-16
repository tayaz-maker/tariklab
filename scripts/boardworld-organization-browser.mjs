// Fresh gangster character through visible controls only. Read-only inspection
// and catalogue selection verify funded tasks and decisions.
import assert from "node:assert/strict";
import {mkdirSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {chromium} from "playwright";
import {createStaticGameServer} from "./static-game-server.mjs";
import {openBoardworldTab} from "./boardworld-browser-navigation.mjs";

const assets = resolve(process.argv[2] || "public");
const engine = await import(pathToFileURL(resolve(assets, "games/tc-sim-boardworld/engine.mjs")).href);
await engine.loadExpansionRuntime();
const output = resolve(process.env.RUNNER_TEMP || "work", "screenshots", "boardworld-organization");
mkdirSync(output, {recursive: true});
const server = createStaticGameServer(assets);
await new Promise(done => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1280, height: 900}});
const errors = [], trace = [];
page.on("pageerror", error => errors.push(error.message));
const inspect = () => page.evaluate(() => window.boardworldInspect());
const offer = (s, id) => engine.getActions(s).find(a => a.id === id);
const member = s => s.expansion.underworld?.memberships.find(row => row.personId === s.expansion.playerId);
const chapter = s => s.expansion.underworld.chapters.moda;
const politics = s => s.expansion.society.organizations.moda;
const day = s => Math.floor(s.time / 1440) + 1;
let current;

async function findVisible(id, tabs) {
  const controls = page.locator(`[data-action="${id}"]`);
  for (const tab of [null, ...tabs]) {
    if (tab) await openBoardworldTab(page, tab);
    for (const button of await controls.all()) {
      for (const details of (await button.locator("xpath=ancestor::details[not(@open)]").all()).reverse()) {
        const summary = details.locator(":scope > summary");
        if (await summary.isVisible()) await summary.click();
      }
      if (await button.isVisible() && await button.isEnabled()) return button;
    }
  }
}

async function act(id, ...tabs) {
  const before = current;
  const action = offer(before, id);
  assert.ok(action && !action.disabled, `${id}: ${action?.reason || "unavailable"}`);
  const button = await findVisible(id, tabs);
  assert.ok(button, `${id} does not have a visible enabled control`);
  await page.evaluate(expected => {
    window.__organizationAck = null;
    const done = event => {
      if (event.detail?.id !== expected) return;
      removeEventListener("boardworld:action-complete", done);
      window.__organizationAck = event.detail;
    };
    addEventListener("boardworld:action-complete", done);
  }, id);
  await button.click();
  await page.waitForFunction(() => window.__organizationAck !== null, null, {timeout: 20000});
  assert.equal((await page.evaluate(() => window.__organizationAck)).saved, true, id);
  current = await inspect();
  assert.ok(current.revision > before.revision, id);
  const step = {id, day: day(current), minutes: current.time - before.time, bankDelta: current.bank - before.bank,
    rank: member(current)?.rank, responsibility: member(current)?.responsibility};
  trace.push(step);
  if (!id.startsWith("wait:")) console.log(JSON.stringify(step));
  return {before, after: current, action};
}

async function ready(id, ...tabs) {
  if (id.startsWith("visit:") && current.city.venue === id.slice(6)) return;
  for (let tries = 0; tries < 34; tries++) {
    const action = offer(current, id);
    if (action && !action.disabled) return act(id, ...tabs);
    const actions = engine.getActions(current).filter(a => !a.disabled);
    const pending = actions.find(a => a.category === "event");
    const food = current.player.hunger < 40 && actions.find(a => ["soup", "eat", "cook"].includes(a.id));
    const rest = current.player.energy < 38 && actions.find(a => ["rest", "sleep"].includes(a.id));
    await act((pending || food || rest)?.id || "wait:60", "life", "plan");
  }
  assert.fail(`Unable to reach ${id}: ${offer(current, id)?.reason} at minute ${current.time}`);
}

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/games/tc-sim-boardworld/`);
  await page.locator("#character-name").fill("Deniz Moda");
  await page.locator('[name=lifePath][value="gangster"]').check();
  await page.locator("[data-testid=create-game]").click();
  await page.waitForFunction(() => window.boardworldInspect?.()?.expansion);
  current = await inspect();
  assert.equal(current.revision, 0);
  assert.equal(current.location, "kadikoy");
  assert.equal(member(current), undefined);
  const social = "visit:kadikoy-cafe", work = "visit:kadikoy-work";
  await ready(social, "board", "expansion-world");
  await ready("underworld:recruit:moda", "expansion-world", "expansion");
  assert.equal(current.expansion.underworld.offer.chapterId, "moda");
  await ready("underworld:join:moda", "expansion-world", "expansion");
  assert.equal(member(current).rank, 0);
  assert.equal(member(current).chapterId, "moda");
  await ready(work, "board", "expansion-world");
  let payroll = 0, meeting;
  for (let i = 1; i <= 8; i++) {
    await ready("underworld:accept:sorting", "expansion-world", "expansion");
    const {before} = await ready(`underworld:complete:${member(current).task.id}`, "expansion-world", "expansion");
    assert.equal(member(current).task.status, "completed");
    assert.equal(member(current).responsibility, i);
    assert.equal(current.bank - before.bank, 100);
    assert.equal(chapter(before).treasury - chapter(current).treasury, 100);
    assert.equal(chapter(current).ledger.payroll - chapter(before).ledger.payroll, 100);
    payroll += 100;
    if (i === 3 || i === 5) {
      await ready(social, "board", "expansion-world");
      await ready("underworld:promote", "expansion-world", "expansion");
      assert.equal(member(current).rank, i === 3 ? 1 : 2);
      if (i === 3) {
        const {before: prior} = await ready("underworld:faction:trade", "expansion-world", "expansion");
        const old = chapter(prior), updated = chapter(current);
        const purseIncrease = updated.roster.reduce((sum, row, index) => sum + row.purse - old.roster[index].purse, 0);
        assert.equal(old.treasury - updated.treasury, 60);
        assert.equal(updated.ledger.payroll - old.ledger.payroll, 60);
        assert.equal(purseIncrease, 60);
        assert.ok(updated.roster.some((row, index) => row.loyalty !== old.roster[index].loyalty));
        meeting = {paid: 60, loyaltyChanged: true};
      }
      await ready(work, "board", "expansion-world");
    }
  }
  await ready(social, "board", "expansion-world");
  await ready("underworld:lead", "expansion-world", "expansion");
  assert.equal(member(current).rank, 3);
  const originalStrategy = politics(current).strategy;
  const strategy = originalStrategy === "expansion" ? "security" : "expansion";
  await ready(`underworld:policy:${strategy}`, "expansion-world", "expansion");
  assert.equal(politics(current).strategy, strategy);
  assert.ok(politics(current).history.some(event => event.kind === strategy && event.actorId === current.expansion.playerId));
  await page.reload();
  await page.waitForFunction(() => window.boardworldInspect?.()?.expansion?.underworld?.memberships?.length);
  assert.deepEqual(await inspect(), current);
  await ready("underworld:leave", "expansion-world", "expansion");
  assert.ok(member(current).leftAt !== null);
  await page.reload();
  await page.waitForFunction(() => window.boardworldInspect?.()?.expansion?.underworld?.memberships?.length);
  assert.deepEqual(await inspect(), current);
  assert.deepEqual(errors, []);
  await openBoardworldTab(page, "expansion-world");
  await page.screenshot({path:resolve(output, "organization.png")});
  const result = {ok:true, chapter:"moda", completedTasks:8, payroll, meeting, originalStrategy, strategy,
    quitAt:member(current).leftAt, reloaded:true, errors, trace};
  writeFileSync(resolve(output,"result.json"), JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify({...result, trace: trace.length}));
} catch (error) {
  await page.screenshot({path:resolve(output,"last-screen.png")}).catch(() => {});
  writeFileSync(resolve(output,"failed.json"), JSON.stringify({error:error.message,errors,trace,
    last:current && {time:current.time,player:current.player,venue:current.city.venue,member:member(current)}}, null, 2) + "\n");
  throw error;
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
