// Wave 1 save repairs: real Chromium controls, storage faults, and reloads.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { checkedUrl, checkedOutputPath } from "./browser-guard.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = resolve(arg("--serve", "public"));
const label = arg("--label", "source");
const proofRoot = resolve(process.env.RUNNER_TEMP || "/workspace", "screenshots");
const out = checkedOutputPath(resolve(proofRoot, "wave1-save", label), [proofRoot]);
await mkdir(out, { recursive: true });
const moduleAt = (file) => import(pathToFileURL(resolve(root, "games", file)).href);
const [Town, TownData, Phone, Pov, Naval] = await Promise.all([
  moduleAt("son-kasaba/sim.js"), moduleAt("son-kasaba/data.js"),
  moduleAt("next-wave.js"), moduleAt("son-100-gun/pov.js"),
  moduleAt("amiral-batti/js/engine.js"),
]);
const copy = (state) => JSON.parse(JSON.stringify(state));
const keys = {
  town: "tariklab.nextwave.son-kasaba.slot1",
  phone: "tariklab.nextwave.kayip-telefon.slot1",
  pov: "tariklab.son100.pov.v1.slot1",
  naval: "tariklab.amiral-batti.match",
};
const townSave = Town.createTown({ context: "balanced" });
while (!townSave.ended && townSave.events.length <= 45) {
  const action = townSave.events.filter((event) => event.status === "open")
    .flatMap((event) => TownData.EVENTS.find((definition) => definition.id === event.id).choices
      .map((choice) => {
        const command = `event:${event.id}:${choice.id}`;
        return { command, ...Town.actionInfo(townSave, command) };
      }))
    .filter((candidate) => !candidate.reason).sort((a, b) => a.cost - b.cost)[0];
  assert.equal(action ? Town.applyTownAction(townSave, action.command) : Town.advanceTown(townSave), true);
}
assert.ok(townSave.events.length > 45);
const phoneSave = Phone.createPhoneState(76543);
for (const id of ["photo_ticket", "cal_bus", "photo_cafe", "cal_naz"])
  Phone.applyAction("kayip-telefon", phoneSave, `discover:${id}`);
for (const command of ["link:photo_ticket:cal_bus", "pin:photo_ticket", "theory:what:planned"])
  Phone.applyAction("kayip-telefon", phoneSave, command);
phoneSave.ui = { app: "not-a-real-app", caseTab: "invalid", linkFrom: "nonexistent-evidence" };

const server = process.env.WAVE1_SAVE_BASE ? null : createStaticGameServer(root);
if (server) await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = checkedUrl(process.env.WAVE1_SAVE_BASE || `http://127.0.0.1:${server.address().port}`);
const results = [];
let browser;

async function stored(page, key) {
  return page.evaluate((name) => localStorage.getItem(name), key);
}
async function parsed(page, key) {
  return JSON.parse(await stored(page, key));
}
async function replaceSave(page, key, raw) {
  await page.evaluate(({ key, raw }) => {
    localStorage.setItem(key, raw);
    localStorage.removeItem(`${key}.backup`);
  }, { key, raw });
  await page.reload({ waitUntil: "networkidle" });
}
async function screenshot(page, name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true, scale: "css" });
}
async function layout(page, tag) {
  const measured = await page.evaluate(() => ({
    viewport: innerWidth, content: document.documentElement.scrollWidth,
    language: window.tlabI18n?.getLang?.(),
  }));
  assert.ok(measured.content <= measured.viewport + 1, `${tag}: horizontal overflow ${JSON.stringify(measured)}`);
  return measured;
}

async function townCase(page, tag) {
  await page.locator("#menu-continue").click();
  await page.locator("#town-advance").waitFor();
  assert.deepEqual(await parsed(page, keys.town), townSave, "loading does not reset the 46-event save");
  await page.locator("#town-advance").click();
  const after = await parsed(page, keys.town);
  const expected = copy(townSave);
  Town.advanceTown(expected);
  assert.deepEqual(after, expected, "real month control applies the expected consequences once");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#menu-continue").click();
  await page.locator("#town-advance").waitFor();
  assert.deepEqual(await parsed(page, keys.town), after);
  await screenshot(page, tag);
  return { month: after.month, retainedEvents: after.events.length, saveReload: true };
}

async function phoneCase(page, tag) {
  await page.locator("#menu-continue").click();
  assert.match(await page.locator('[data-app="messages"]').getAttribute("class"), /is-active/);
  assert.match(await page.locator('[data-case-tab="evidence"]').getAttribute("class"), /is-active/);
  await page.locator(".save-menu > summary").click();
  await page.locator('[data-save-slot="1"]').click();
  const repaired = await parsed(page, keys.phone);
  assert.deepEqual(repaired, copy(Phone.normalize("kayip-telefon", copy(phoneSave))), "repair preserves the complete valid progress");
  await page.locator(".save-menu > summary").click();
  const item = page.locator("[data-item]:not([disabled])").first();
  const id = await item.getAttribute("data-item");
  await item.click();
  const advanced = await parsed(page, keys.phone);
  assert.ok(advanced.discoveredItems.includes(id));
  assert.equal(advanced.discoveredItems.length, repaired.discoveredItems.length + 1);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#menu-continue").click();
  await page.locator(".phone-screen").waitFor();
  assert.deepEqual(await parsed(page, keys.phone), advanced);
  await screenshot(page, tag);
  const gameLayout = await layout(page, tag);

  const invalid = copy(advanced);
  invalid.discoveredItems = ["unknown-evidence"];
  const raw = JSON.stringify(invalid);
  await replaceSave(page, keys.phone, raw);
  assert.equal(await page.locator("#menu-continue").isDisabled(), true);
  assert.equal(await stored(page, keys.phone), raw, "unrecoverable raw data is not silently overwritten");
  await screenshot(page, `${tag}-unrecoverable`);
  return { discoveries: advanced.discoveredItems.length, recoveredUI: true, rawPreserved: true, saveReload: true, gameLayout };
}

const povText = {
  tr: { error: "Kayıt başarısız.", unsaved: "Bu oyun henüz kaydedilmedi.", saved: (day) => `Son kayıt: gün ${day}.` },
  en: { error: "Save failed.", unsaved: "This game has not been saved yet.", saved: (day) => `Last saved: day ${day}.` },
  pl: { error: "Zapis nie powiódł się.", unsaved: "Ta gra nie została jeszcze zapisana.", saved: (day) => `Ostatni zapis: dzień ${day}.` },
};
async function povCase(page, tag, language) {
  const text = povText[language];
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    window.__wave1StorageFault = true;
    Storage.prototype.setItem = function (key, value) {
      if (window.__wave1StorageFault && key.startsWith("tariklab.son100.pov.v1"))
        throw new DOMException("Wave 1 storage failure", "QuotaExceededError");
      return set.call(this, key, value);
    };
  });
  await page.locator("#menu-new").click();
  await page.locator("[data-scenario]").first().click();
  await page.locator("#confirm-start").click();
  assert.ok((await page.locator(".save-popover").innerText()).includes(text.unsaved));
  assert.ok((await page.locator('.save-popover [role="alert"]').innerText()).includes(text.error));
  assert.equal(await stored(page, keys.pov), null);
  await page.evaluate(() => { window.__wave1StorageFault = false; });
  await page.locator("[data-save-retry]").click();
  const initial = await stored(page, keys.pov);
  const before = Pov.restore(initial);
  assert.ok(before);
  const choice = page.locator("[data-card][data-opt]:not([disabled])").first();
  const card = await choice.getAttribute("data-card");
  const option = await choice.getAttribute("data-opt");
  const expected = Pov.restore(initial);
  assert.ok(Pov.choose(expected, card, option));
  await page.evaluate(() => { window.__wave1StorageFault = true; });
  await choice.click();
  await page.locator("#commit").click();
  assert.equal(await stored(page, keys.pov), initial, "failed autosave leaves the actual old payload intact");
  const failedNotice = await page.locator(".save-popover").innerText();
  assert.ok(failedNotice.includes(text.error));
  assert.ok(failedNotice.includes(text.saved(before.day)));
  assert.ok(!failedNotice.includes(text.saved(expected.day)), "unsaved current day must not be reported as saved");
  assert.match(await page.locator(".bar-day").innerText(), new RegExp(`\\b${expected.day}\\b`));
  await screenshot(page, `${tag}-failed-save`);
  const failureLayout = await layout(page, `${tag}-failed-save`);
  await page.evaluate(() => { window.__wave1StorageFault = false; });
  await page.locator("[data-save-retry]").click();
  assert.equal(await stored(page, keys.pov), Pov.serialize(expected), "retry stores the existing decision once");
  assert.equal(await page.locator('.save-popover [role="alert"]').count(), 0);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-load="1"]').click();
  assert.match(await page.locator(".bar-day").innerText(), new RegExp(`\\b${expected.day}\\b`));
  assert.equal(await stored(page, keys.pov), Pov.serialize(expected));
  await screenshot(page, tag);
  return { firstSaveFailureVisible: true, autosaveFailureVisible: true, retryDay: expected.day, saveReload: true, failureLayout };
}

const navalText = {
  tr: { invalid: "Kayıt açılamadı", hotseat: "Sırayla", unavailable: "kullanılamıyor" },
  en: { invalid: "This save could not be opened", hotseat: "Hotseat", unavailable: "unavailable" },
  pl: { invalid: "Nie można otworzyć zapisu", hotseat: "Hotseat", unavailable: "niedostępny" },
};
async function navalCase(page, tag, language) {
  const text = navalText[language];
  assert.equal(await page.locator("#hotseat-option").evaluate((option) => option.disabled), true);
  assert.ok((await page.locator("#hotseat-option").textContent()).includes(text.unavailable));
  assert.ok((await page.locator("#status").innerText()).includes(text.invalid));
  assert.equal(await page.locator("#arena button.cell").count(), 0);
  assert.equal(await page.locator("#place-bar").isVisible(), false, "unusable placement controls are visibly hidden");
  assert.equal(await stored(page, keys.naval), '{"version":1,"phase":"place"}');
  await screenshot(page, `${tag}-invalid-save`);
  await page.locator("#new").click();
  assert.equal(Naval.validateMatch(await parsed(page, keys.naval)), true);
  await page.locator("#auto").click();
  await page.locator("#start").click();
  await page.locator('button.cell[data-kind="enemy"][data-r="0"][data-c="0"]').click();
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).log.length === 2, keys.naval);
  let played = await parsed(page, keys.naval);
  assert.equal(played.turn, "player");
  assert.equal(Naval.validateMatch(played), true);
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual(await parsed(page, keys.naval), played);
  await screenshot(page, tag);
  const gameLayout = await layout(page, tag);

  for (const difficulty of Naval.DIFFICULTIES) {
    const pending = Naval.createMatch({ seed: 42, difficulty });
    pending.playerShips = Naval.autoPlace(37).ships;
    Naval.startMatch(pending);
    Naval.playerShoot(pending, 0, 0);
    assert.equal(pending.turn, "cpu");
    await replaceSave(page, keys.naval, JSON.stringify(pending));
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).log.length === 2, keys.naval);
    played = await parsed(page, keys.naval);
    assert.equal(played.difficulty, difficulty);
    assert.equal(played.turn, "player");
    assert.equal(Naval.validateMatch(played), true);
    await page.reload({ waitUntil: "networkidle" });
    assert.deepEqual(await parsed(page, keys.naval), played, `${difficulty}: CPU reload applies its pending turn once`);
  }
  const hotseat = Naval.createMatch({ seed: 44, mode: "hotseat" });
  hotseat.playerShips = Naval.autoPlace(38).ships;
  Naval.startMatch(hotseat);
  Naval.playerShoot(hotseat, 0, 0);
  assert.equal(Naval.validateMatch(hotseat), true);
  const raw = JSON.stringify(hotseat);
  await replaceSave(page, keys.naval, raw);
  assert.ok((await page.locator("#status").innerText()).includes(text.hotseat));
  assert.equal(await page.locator("#arena button.cell").count(), 0);
  assert.equal(await stored(page, keys.naval), raw);
  assert.equal(await page.locator("#hotseat-option").evaluate((option) => option.disabled), true);
  assert.equal(await page.locator("#place-bar").isVisible(), false);
  await screenshot(page, `${tag}-hotseat-unavailable`);
  return { corruptSavePreserved: true, explicitNewGame: true, difficulties: Naval.DIFFICULTIES, cpuReloadOnce: true, hotseatUnavailable: true, gameLayout };
}

try {
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const language of ["tr", "en", "pl"]) for (const width of [390, 1280]) {
    for (const [game, fixture, check] of [
      ["son-kasaba", { [keys.town]: JSON.stringify(townSave) }, townCase],
      ["kayip-telefon", { [keys.phone]: JSON.stringify(phoneSave) }, phoneCase],
      ["son-100-gun", {}, povCase],
      ["amiral-batti", { [keys.naval]: '{"version":1,"phase":"place"}' }, navalCase],
    ]) {
      const tag = `${game}-${language}-${width}`;
      const context = await browser.newContext({ viewport: { width, height: 900 },
        isMobile: width === 390, hasTouch: width === 390, reducedMotion: "reduce" });
      await context.addInitScript(({ language, fixture }) => {
        localStorage.setItem("tariklab.language", language);
        if (!sessionStorage.getItem("wave1-save-seeded")) {
          for (const [key, value] of Object.entries(fixture)) localStorage.setItem(key, value);
          sessionStorage.setItem("wave1-save-seeded", "yes");
        }
      }, { language, fixture });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      try {
        await page.goto(`${base}/games/${game}/index.html`, { waitUntil: "networkidle" });
        const details = await check(page, tag, language);
        const measured = await layout(page, tag);
        assert.equal(measured.language, language);
        assert.deepEqual(errors, [], `${tag}: no runtime/console errors`);
        results.push({ tag, ok: true, ...details, layout: measured, errors });
        console.log(`PASS ${tag}`);
      } catch (error) {
        await screenshot(page, `${tag}-failure`).catch(() => {});
        results.push({ tag, ok: false, error: error.stack, errors });
        console.error(`FAIL ${tag}: ${error.message}`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify({ label, root, results }, null, 2));
  await browser?.close();
  if (server) await new Promise((done) => server.close(done));
}
assert.equal(results.length, 24, "all four games must run in all six language/viewport cells");
assert.equal(results.filter((result) => !result.ok).length, 0, "see results.json for failed browser cells");
console.log(JSON.stringify({ label, cells: results.length, passed: results.filter((result) => result.ok).length, out }));
