import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { checkedUrl } from "./browser-guard.mjs";
const argv = process.argv.slice(2),
  arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const serving = arg("--serve", null),
  base = arg("--base-url", null),
  portal = argv.includes("--portal");
const out = resolve(process.env.RUNNER_TEMP || "../qa", "screenshots/boardworld");
mkdirSync(out, { recursive: true });
let server,
  browser,
  origin = base || "http://127.0.0.1:8080";
const results = [];
try {
  if (serving) {
    server = createStaticGameServer(serving);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  checkedUrl(origin);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      acceptDownloads: true,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        (!message.location().url || message.location().url.startsWith(origin))
      )
        errors.push(message.text());
    });
    page.on("response", (r) => {
      if (r.url().startsWith(origin + "/games/tc-sim-boardworld/") && r.status() >= 400)
        errors.push(`HTTP ${r.status()} ${r.url()}`);
    });
    const url =
      origin + (portal ? "/oyna/tc-sim-boardworld" : "/games/tc-sim-boardworld/index.html");
    await page.goto(url, { waitUntil: "networkidle" });
    let surface = portal
      ? await (await page.locator("iframe").elementHandle()).contentFrame()
      : page;
    await surface.locator("#create-form").waitFor();
    const layout = async (stage) => {
      const d = await surface.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        text: document.body.innerText.length,
      }));
      assert.ok(d.text > 100, `${stage}: empty render`);
      assert.ok(d.scroll <= d.width + 1, `${stage}/${width}: overflow ${JSON.stringify(d)}`);
    };
    await layout("creation");
    await page.screenshot({ path: `${out}/creation-${width}.png`, fullPage: true });
    await surface.evaluate(() => localStorage.setItem("tariklab::tc-sim:1", "untouched"));
    await surface.locator("#character-name").fill("Ada <test>");
    await surface.locator("[name=scenario][value=newcomer]").check();
    await surface.locator("[data-testid=create-game]").click();
    await surface.locator("[data-tab=work]").first().waitFor();
    const inspect = () => surface.evaluate(() => window.boardworldInspect());
    const available = () =>
      surface.evaluate(async () => {
        const { getActions } = await import("/games/tc-sim-boardworld/engine.mjs");
        return getActions(window.boardworldInspect()).filter((a) => !a.disabled);
      });
    const drain = async () => {
      for (let i = 0; i < 35; i++) {
        const es = (await available()).filter((a) => a.category === "event");
        if (!es.length) return;
        const a = es.find((a) => a.cost === 0) || es[0];
        await surface.locator(`[data-action="${a.id}"]`).first().click();
      }
      throw new Error("event queue cannot drain");
    };
    const act = async (id, tab) => {
      await drain();
      if (tab) await surface.locator(`[data-tab="${tab}"]`).first().click();
      const a = (await available()).find((a) => a.id === id);
      assert.ok(a, `action ${id} is unavailable at ${JSON.stringify((await inspect()).time)}`);
      await surface.locator(`[data-action="${id}"]`).first().click();
    };
    const initial = await inspect();
    assert.equal(initial.player.name, "Ada <test>");
    assert.equal(await surface.locator("test").count(), 0, "player name must render as text");
    await act("apply:retail", "work");
    assert.equal((await inspect()).job.id, "retail");
    await act("work", "work");
    const worked = await inspect();
    assert.equal(worked.job.shifts, 1);
    assert.ok(worked.job.earned > 0);
    assert.ok(worked.time > initial.time);
    await drain();
    for (const tab of [
      "board",
      "work",
      "life",
      "people",
      "study",
      "wallet",
      "bag",
      "goals",
      "log",
    ]) {
      await surface.locator(`[data-tab="${tab}"]`).first().click();
      await layout(tab);
    }
    await surface.locator("[data-tab=board]").first().click();
    await surface.locator("[data-district=besiktas]").click();
    await act("travel:besiktas");
    assert.equal((await inspect()).location, "besiktas");
    await drain();
    const saved = await inspect();
    await surface.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${out}/board-${width}.png`, fullPage: true });
    await page.reload({ waitUntil: "networkidle" });
    surface = portal ? await (await page.locator("iframe").elementHandle()).contentFrame() : page;
    await surface.waitForFunction(() => window.boardworldInspect?.()?.revision > 0);
    assert.deepEqual(await inspect(), saved, "reload must preserve every field");
    await surface.locator("[data-ui=menu]").click();
    const downloading = page.waitForEvent("download");
    await surface.locator("[data-ui=export]").click();
    const download = await downloading;
    await download.saveAs(`${out}/export-${width}.json`);
    await surface.locator("#import-file").setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{broken"),
    });
    assert.deepEqual(await inspect(), saved, "bad import must leave current game intact");
    await surface.locator("#import-file").setInputFiles(`${out}/export-${width}.json`);
    assert.deepEqual(await inspect(), saved, "export/import preserves exact state");
    await surface.locator("[data-ui=menu]").click();
    await surface.locator("#menu-dialog [data-ui=save]").click();
    const backup = await surface.evaluate(async () => {
      const { BACKUP_KEY } = await import("/games/tc-sim-boardworld/persistence.mjs");
      return JSON.parse(JSON.parse(localStorage.getItem(BACKUP_KEY)).payload);
    });
    await surface.evaluate(async () => {
      const { SAVE_KEY } = await import("/games/tc-sim-boardworld/persistence.mjs");
      localStorage.setItem(SAVE_KEY, "{broken");
    });
    await page.reload({ waitUntil: "networkidle" });
    surface = portal ? await (await page.locator("iframe").elementHandle()).contentFrame() : page;
    await surface.waitForFunction(() => window.boardworldInspect?.());
    assert.deepEqual(await inspect(), backup, "backup recovery must preserve last healthy state");
    assert.equal(
      await surface.evaluate(() => localStorage.getItem("tariklab::tc-sim:1")),
      "untouched",
    );
    assert.deepEqual(errors, [], "browser errors");
    results.push({
      width,
      job: true,
      shift: true,
      travel: true,
      allPanels: true,
      saveReload: true,
      exportImport: true,
      backupRecovery: true,
      errors,
    });
    await context.close();
  }
  // Compare every deployed game module to this verified candidate. A portal HTTP 200 is insufficient.
  const expected = arg("--expected-root", serving || "public");
  for (const file of [
    "index.html",
    "app.mjs",
    "style.css",
    "engine.mjs",
    "content.mjs",
    "persistence.mjs",
    "deep-content.mjs",
    "deep-life.mjs",
    "life-chains.mjs",
    "deep-ui.mjs",
    "deep.css",
  ]) {
    const r = await fetch(`${origin}/games/tc-sim-boardworld/${file}`);
    assert.equal(r.status, 200, file);
    if (file.endsWith(".mjs"))
      assert.match(r.headers.get("content-type"), /javascript/, `${file} MIME`);
    const digest = (b) => createHash("sha256").update(b).digest("hex");
    assert.equal(
      digest(Buffer.from(await r.arrayBuffer())),
      digest(readFileSync(resolve(expected, "games/tc-sim-boardworld", file))),
      `${file}: served candidate differs`,
    );
  }
  if (argv.includes("--legacy")) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/games/tc-sim/index.html", { waitUntil: "networkidle" });
    await page.locator("#show-creation-form").click();
    await page.locator("#new-game-form button[type=submit]").click();
    await page.locator("#advance-week").waitFor();
    for (let i = 0; i < 12; i++) {
      const choice = page.locator(".event-card [data-event-choice]:not([disabled])").first();
      if (await choice.count()) await choice.click();
      else break;
    }
    const decision = page.locator("[data-decision]:not([disabled])").first();
    if (await decision.count()) await decision.click();
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#continue-game").click();
    await page.locator("#advance-week").waitFor();
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `${out}/legacy-tc-sim.png`, fullPage: true });
    await context.close();
    results.push({ legacyTcSim: true, saveReload: true });
  }
  writeFileSync(`${out}/result.json`, JSON.stringify({ ok: true, origin, results }, null, 2));
  console.log(JSON.stringify({ ok: true, origin, results }, null, 2));
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
}
