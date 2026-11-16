// A fresh life advances only through visible gameplay controls. The pure action
// catalogue and read-only snapshot pick controls and verify actual payments.
import assert from "node:assert/strict";
import {mkdirSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {chromium} from "playwright";
import {createStaticGameServer} from "./static-game-server.mjs";
import {openBoardworldTab} from "./boardworld-browser-navigation.mjs";
import {getActions, loadExpansionRuntime} from "../public/games/tc-sim-boardworld/engine.mjs";

await loadExpansionRuntime();
const assets = process.argv[2] || "public";
const role = process.argv[3] ?? "health";
const career = {
  health: {city: "ankara", district: "ankara:altindag", course: "health-support", workplace: "institution", firm: "ankara:public-health"},
  finance: {city: "izmir", district: "izmir:bornova", course: "finance", workplace: "work", firm: "izmir:digital"},
}[role];
assert.ok(career);
const enroll = `institution:school:${career.course}`, study = "institution:study";
const apply = `district:apply:${role}`, shift = "district:shift";
const out = resolve(process.env.RUNNER_TEMP || "work", "screenshots", `boardworld-${role}-career`);
mkdirSync(out, {recursive: true});

const server = createStaticGameServer(assets);
await new Promise(ready => server.listen(0, "127.0.0.1", ready));
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
const page = await browser.newPage({viewport: {width: 1280, height: 900}});
const errors = [], steps = [];
page.on("pageerror", error => errors.push(error.message));
const inspect = () => page.evaluate(() => window.boardworldInspect());
const place = s => s.expansion.districts?.place?.venueId;
const job = s => s.expansion.districts?.job;
const day = s => Math.floor(s.time / 1440) + 1;
const qualified = s => s.expansion.institutions.qualifications.some(q => q.course === career.course);
const venue = kind => `${career.district}:${kind}`;
const visit = kind => `district:visit:${venue(kind)}`;

function choose(s) {
  const enabled = getActions(s).filter(a => !a.disabled);
  const choose = (...ids) => ids.map(id => enabled.find(a => a.id === id)).find(Boolean);
  const now = s.time % 1440;
  if (s.pendingEvents.length) return enabled.find(a => a.id.startsWith("event:"));
  if (s.player.hunger < 50) {
    const meal = choose("world:meal", "cook", "snack", visit("social"));
    if (meal) return meal;
  }
  if (s.player.energy < 43 || (s.player.energy < 85 && (now < 60 || now >= 21 * 60))) {
    const rest = choose("world:rest", "rest");
    if (rest) return rest;
  }
  if (now >= 8 * 60 && now < 13 * 60) {
    const target = !qualified(s) ? "institution" : career.workplace;
    if (place(s) !== venue(target) && choose(visit(target))) return choose(visit(target));
    if (!qualified(s) && choose(enroll, study)) return choose(enroll, study);
    if (qualified(s) && choose(apply, shift)) return choose(apply, shift);
  }
  return choose("wait:60", "wait:15", "world:rest");
}

async function findVisible(id) {
  const locator = page.locator(`[data-action="${id}"]`);
  const tabs = /^(district:|world:|institution:)/.test(id)
    ? ["expansion-world", "study", "work", "life"] : ["life", "plan"];
  for (const tab of [null, ...tabs]) {
    if (tab) await openBoardworldTab(page, tab);
    for (const button of await locator.all()) {
      for (const fold of (await button.locator("xpath=ancestor::details[not(@open)]").all()).reverse()) {
        const toggle = fold.locator(":scope > summary");
        if (await toggle.isVisible()) await toggle.click();
      }
      if (await button.isVisible() && await button.isEnabled()) return button;
    }
  }
  return null;
}

async function play(action, before) {
  const id = action.id;
  const button = await findVisible(id);
  assert.ok(button, `${id} is legal but no visible control was found at ${before.time}`);
  await page.evaluate(expected => {
    window.__careerAck = null;
    const done = e => {
      if (e.detail?.id !== expected) return;
      removeEventListener("boardworld:action-complete", done);
      window.__careerAck = e.detail;
    };
    addEventListener("boardworld:action-complete", done);
  }, id);
  await button.click();
  await page.waitForFunction(() => window.__careerAck !== null, null, {timeout: 20000});
  const ack = await page.evaluate(() => window.__careerAck);
  assert.equal(ack.saved, true, JSON.stringify(ack));
  const after = await inspect();
  assert.ok(after.revision > before.revision);
  const step = {id, day: day(after), minutes: after.time - before.time, bankChange: after.bank - before.bank};
  steps.push(step);
  if ([enroll, study, apply, shift].includes(id) || steps.length % 20 === 0)
    console.log(JSON.stringify(step));
  return after;
}

let current, enrolledReloaded = false;
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/games/tc-sim-boardworld/`);
  await page.locator("#character-name").fill("Ekin Kaya");
  await page.locator("#create-form details > summary").click();
  await page.locator("select[name=scenario]").selectOption("graduate");
  await page.locator("[name=startCity]").selectOption(career.city);
  await page.locator("[name=startingDistrict]").selectOption(career.district);
  await page.locator('[name=lifePath][value="freeform"]').check();
  await page.locator("[data-testid=create-game]").click();
  await page.waitForFunction(() => window.boardworldInspect?.()?.expansion);
  current = await inspect();
  assert.equal(current.revision, 0);
  assert.ok(!qualified(current) && !job(current));
  for (let i = 0; i < 220 && !job(current)?.shifts; i++) {
    const selected = choose(current);
    assert.ok(selected, `No playable action on day ${day(current)}`);
    const before = current;
    current = await play(selected, before);
    if (selected.id === enroll) {
      assert.ok(before.cash + before.bank > current.cash + current.bank, "a real tuition payment");
      assert.equal(current.expansion.institutions.program.course, career.course);
      await page.reload();
      await page.waitForFunction(() => window.boardworldInspect?.()?.expansion);
      assert.deepEqual(await inspect(), current);
      enrolledReloaded = true;
    }
    if (selected.id === apply) {
      assert.equal(job(current).role, role);
      assert.equal(job(current).firmId, career.firm);
    }
    if (selected.id === shift) {
      const wage = Number(/Ücret: (\d+) TL/.exec(selected.description)[1]);
      assert.equal(current.bank - before.bank, wage);
      assert.equal(current.time - before.time, role === "health" ? 240 : 270);
      if (role === "health") {
        const budget = s => s.expansion.institutions.regions[career.city].treasury;
        assert.equal(budget(before) - budget(current), wage);
      } else {
        const employer = s => s.expansion.economy.firms[career.firm];
        const debit = employer(before).cash - employer(current).cash;
        assert.ok(debit >= wage);
        assert.equal(debit, employer(current).costs - employer(before).costs);
      }
      assert.equal(current.player.skills.knowledge, before.player.skills.knowledge + 1);
      await page.locator(".outcome-strip").scrollIntoViewIfNeeded();
      await page.screenshot({path: resolve(out, "paid-shift.png")});
    }
  }
  assert.ok(enrolledReloaded && qualified(current));
  assert.equal(steps.filter(row => row.id === study).length, 4);
  assert.equal(job(current)?.shifts, 1);
  await page.reload();
  await page.waitForFunction(() => window.boardworldInspect?.()?.expansion);
  assert.deepEqual(await inspect(), current);
  assert.deepEqual(errors, []);
  const report = {ok: true, role, career, enrolledReloaded, paidShiftReloaded: true,
    chromium: browser.version(), errors, steps};
  writeFileSync(resolve(out, "result.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({...report, steps: steps.length}));
} catch (error) {
  await page.screenshot({path: resolve(out, "last-screen.png")}).catch(() => {});
  writeFileSync(resolve(out, "failure.json"), JSON.stringify({message: error.message, errors, steps,
    last: current && {time: current.time, bank: current.bank, place: place(current), player: current.player,
      job: job(current), program: current.expansion.institutions.program}}, null, 2) + "\n");
  throw error;
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
