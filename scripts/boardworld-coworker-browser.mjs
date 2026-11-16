// A fresh character advances only through visible game controls. The read-only
// inspection snapshot and action catalogue choose controls and verify outcomes.
// No resolver calls, fixture saves, or state, clock or money injection.
import assert from "node:assert/strict";
import {mkdirSync, writeFileSync, readdirSync, readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
import {chromium} from "playwright";
import {createStaticGameServer} from "./static-game-server.mjs";
import {openBoardworldTab} from "./boardworld-browser-navigation.mjs";
import {getActions, loadExpansionRuntime} from "../public/games/tc-sim-boardworld/engine.mjs";
await loadExpansionRuntime();

const assets = resolve(process.argv[2] || "public");
const city = "istanbul", district = "istanbul:umraniye";
const residentId = `resident:${district}`;
const meet = `district:meet:${residentId}`, listen = `story:listen:${residentId}`;
const referral = `story:referral:${residentId}`, apply = "district:apply:logistics", shift = "district:shift";
const work = district + ":work", social = district + ":social";
const out = resolve(process.env.RUNNER_TEMP || "work", "screenshots", "boardworld-coworker");
mkdirSync(out, {recursive: true});
const runtime = resolve(assets, "games/tc-sim-boardworld");
const hashes = () => Object.fromEntries(readdirSync(runtime).filter(n => /\.(mjs|css|html|svg)$/.test(n)).sort()
  .map(n => [n, createHash("sha256").update(readFileSync(resolve(runtime, n))).digest("hex")]));
const runtimeSha256 = hashes();
const server = createStaticGameServer(assets);
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const page = await browser.newPage({viewport: {width: 1280, height: 900}, reducedMotion: "reduce"});
const trace = [], errors = [];
const inspect = () => page.evaluate(() => window.boardworldInspect());
const contact = s => s.expansion.districts?.contacts[residentId];
const job = s => s.expansion.districts?.job;
const resident = s => s.expansion.economy.residents[residentId].life;
const p = s => s.expansion.districts?.place?.venueId;
const day = s => Math.floor(s.time / 1440) + 1;
const arc = s => s.expansion.stories?.arcs.find(a => a.person === residentId);
page.on("pageerror", e => errors.push(e.message));

async function locate(id, tabs) {
  const buttons = page.locator(`[data-action="${id}"]`);
  for (const tab of [null, ...tabs]) {
    if (tab) await openBoardworldTab(page, tab);
    for (const button of await buttons.all()) {
      for (const fold of (await button.locator("xpath=ancestor::details[not(@open)]").all()).reverse()) {
        if (await fold.locator(":scope > summary").isVisible()) await fold.locator(":scope > summary").click();
      }
      if (await button.isVisible() && await button.isEnabled()) return button;
    }
  }
  return null;
}
async function click(id, before) {
  const tabs = id.startsWith("story:") ? ["stories", "expansion-world"] :
    /^(district:|world:)/.test(id) ? ["expansion-world", "work", "life"] : ["life", "plan"];
  const button = await locate(id, tabs);
  assert.ok(button, `${id} legal but no visible enabled control at ${before.time}`);
  await page.evaluate(expected => {
    window.__completed = null;
    const done = e => {
      if (e.detail?.id !== expected) return;
      removeEventListener("boardworld:action-complete", done);
      window.__completed = e.detail;
    };
    addEventListener("boardworld:action-complete", done);
  }, id);
  await button.click();
  await page.waitForFunction(() => window.__completed !== null, null, {timeout: 20000});
  const done = await page.evaluate(() => window.__completed);
  assert.equal(done.saved, true, JSON.stringify(done));
  const after = await inspect();
  assert.ok(after.revision > before.revision, id);
  const outcome = await page.locator(".outcome-strip strong").textContent({timeout: 3000});
  const step = {id, from: before.time, to: after.time, revision: after.revision,
    day: day(after), bankChange: after.bank - before.bank, scoreBefore: contact(before)?.score,
    scoreAfter: contact(after)?.score, firmId: job(after)?.firmId, shifts: job(after)?.shifts, outcome};
  trace.push(step);
  if ([meet, listen, apply, shift, referral].includes(id) || trace.length % 15 === 0) console.log(JSON.stringify(step));
  return after;
}

function choose(s) {
  const actions = getActions(s).filter(a => !a.disabled);
  const pick = (...ids) => ids.map(id => actions.find(a => a.id === id)).find(Boolean);
  const m = s.time % 1440, v = p(s);
  if (s.pendingEvents.length) return actions.find(a => a.id.startsWith("event:"));
  if (!contact(s) && m >= 17 * 60 && m < 20 * 60 + 15) {
    const socialize = v === social ? pick(meet) : pick("district:visit:" + social);
    if (socialize) return socialize;
  }
  if (contact(s) && arc(s)?.status === "open" && pick(listen)) return pick(listen);
  if (job(s)?.shifts >= 5 && pick(referral)) return pick(referral);
  if (s.player.hunger < 56) {
    const meal = pick("world:meal", "cook", "snack");
    if (meal) return meal;
    if (v !== social && pick("district:visit:" + social)) return pick("district:visit:" + social);
  }
  if (s.player.energy < 42 || (s.player.energy < 86 && (m < 60 || m > 22 * 60))) {
    const rest = pick("world:rest", "rest", "sleep");
    if (rest) return rest;
  }
  if (arc(s)?.status === "listened" && (job(s)?.shifts || 0) < 5 && job(s)?.lastShiftDay !== day(s)) {
    if (m >= 7 * 60 + 30 && m < 14 * 60 && v !== work && pick("district:visit:" + work))
      return pick("district:visit:" + work);
    if (m >= 8 * 60 && m < 14 * 60 && v === work) {
      const employment = pick(apply, shift);
      if (employment) return employment;
    }
  }
  return pick("wait:60", "wait:15", "world:rest", "sleep");
}

let current, reloadedAtMilestone = false, reloadedAfterAdvice = false;
const startedAt = performance.now();
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/games/tc-sim-boardworld/`);
  await page.locator("#character-name").fill("Yaren Kaya");
  await page.locator("#create-form details > summary").click();
  await page.locator("select[name=scenario]").selectOption("restart");
  await page.locator("[name=startCity]").selectOption(city);
  await page.locator("[name=startingDistrict]").selectOption(district);
  await page.locator('[name=lifePath][value="freeform"]').check();
  await page.locator("[data-testid=create-game]").click();
  await page.waitForFunction(() => window.boardworldInspect?.()?.expansion);
  current = await inspect();
  assert.equal(current.revision, 0);
  assert.ok(!contact(current) && !job(current));
  const initialEmployer = resident(current).employer;
  assert.ok(initialEmployer && current.expansion.economy.firms[initialEmployer]?.status === "open");
  console.log(JSON.stringify({district, initialEmployer, start: current.time, craft: current.player.skills.craft}));
  for (let i = 0; i < 200 && !trace.some(row => row.id === referral); i++) {
    const action = choose(current);
    assert.ok(action, `no eligible action, day ${day(current)}`);
    const previous = current;
    if (action.id === shift && job(previous).shifts < 5)
      assert.ok(!getActions(previous).some(a => a.id === referral), "advice stays locked before the milestone");
    current = await click(action.id, current);
    if (action.id === meet) assert.equal(contact(current)?.score, 5);
    if (action.id === listen) assert.equal(contact(current)?.score, 8);
    if (action.id === apply) {
      assert.equal(job(current)?.role, "logistics");
      assert.equal(job(current).firmId, resident(current).employer);
    }
    if (action.id === shift) {
      const {firmId} = job(previous);
      assert.equal(resident(previous).employer, firmId);
      const wage = Number(/Ücret: (\d+) TL/.exec(action.description)[1]);
      assert.equal(current.bank - previous.bank, wage);
      const employerBefore = previous.expansion.economy.firms[firmId];
      const employerAfter = current.expansion.economy.firms[firmId];
      const debit = employerBefore.cash - employerAfter.cash;
      assert.ok(debit >= wage);
      assert.equal(debit, employerAfter.costs - employerBefore.costs);
      const count = job(current).shifts;
      assert.equal(contact(current)?.score, count === 5 ? 10 : 8);
      if (count === 5) {
        assert.match(trace.at(-1).outcome, /İş arkadaşlığı güçlendi/);
        await page.screenshot({path: resolve(out, "fifth-shift.png")});
        await page.reload();
        await page.waitForFunction(() => window.boardworldInspect?.()?.expansion);
        assert.deepEqual(await inspect(), current);
        reloadedAtMilestone = true;
      }
    }
    if (action.id === referral) {
      assert.equal(current.player.skills.knowledge, previous.player.skills.knowledge + 2);
      trace.at(-1).knowledgeGain = current.player.skills.knowledge - previous.player.skills.knowledge;
      assert.match(trace.at(-1).outcome, /Komşunun iş bilgisi becerini geliştirdi/);
      await page.screenshot({path: resolve(out, "advice.png")});
      await page.reload();
      await page.waitForFunction(() => window.boardworldInspect?.()?.expansion);
      assert.deepEqual(await inspect(), current);
      reloadedAfterAdvice = true;
    }
  }
  assert.equal(reloadedAtMilestone, true);
  assert.equal(reloadedAfterAdvice, true);
  assert.deepEqual(errors, []);
  assert.deepEqual(hashes(), runtimeSha256);
  const report = {ok: true, assets, district, resident: contact(current).name, firm: job(current).firmId,
    reloadedAtMilestone, reloadedAfterAdvice, errors, runtimeSha256, trace,
    chromiumVersion: browser.version(), seconds: Math.round((performance.now() - startedAt) / 1000)};
  writeFileSync(resolve(out, "result.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({...report, trace: trace.filter(r => [meet, listen, apply, shift, referral].includes(r.id)), runtimeSha256: undefined}));
} catch (error) {
  await page.screenshot({path: resolve(out, "last-screen.png")}).catch(() => {});
  const report = {ok: false, assets, district, error: error.message, errors, trace,
    last: current && {time: current.time, player: current.player, contact: contact(current), job: job(current),
      resident: resident(current), place: p(current), bank: current.bank, cash: current.cash, arc: arc(current)}};
  writeFileSync(resolve(out, "failed.json"), JSON.stringify(report, null, 2));
  console.error(JSON.stringify({...report, trace: trace.slice(-5)}));
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise(r => server.close(r));
}
