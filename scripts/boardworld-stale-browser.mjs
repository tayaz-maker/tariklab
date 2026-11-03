import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { checkedUrl } from "./browser-guard.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const args = process.argv.slice(2),
  arg = (key, fallback) => (args.includes(key) ? args[args.indexOf(key) + 1] : fallback);
const server = arg("--base-url", null) ? null : createStaticGameServer(arg("--serve", "public"));
if (server) await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = checkedUrl(arg("--base-url", `http://127.0.0.1:${server?.address().port}`));
let browser;
const results = [];
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext();
  const a = await context.newPage(),
    b = await context.newPage();
  const errors = [];
  for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.message));
  await b.addInitScript(() => {
    window.addEventListener("storage", (e) => e.stopImmediatePropagation(), true);
  });
  const url = `${origin}/games/tc-sim-boardworld/index.html`;
  await a.goto(url);
  await a.locator("#character-name").fill("Save Audit");
  await a.locator("[data-testid=create-game]").click();
  await b.goto(url);
  const slots = (p) =>
    p.evaluate(() => [
      localStorage.getItem("tariklab.boardworld.v6"),
      localStorage.getItem("tariklab.boardworld.v6.backup"),
    ]);
  const act = async (p) => {
    await p.evaluate(() => {
      window.actionDone = false;
      window.addEventListener("boardworld:action-complete", () => (window.actionDone = true), {
        once: true,
      });
    });
    await p.locator("[data-action]:not([disabled]):visible").first().click();
    await p.waitForFunction(() => window.actionDone);
  };
  await act(a);
  const newer = await slots(a);
  const rev = await a.evaluate(() => window.boardworldInspect().revision);
  await b.locator("[data-ui=menu]").click();
  await b.locator("[data-ui=save]").last().click();
  await b.waitForFunction(() =>
    document.querySelector("#notice").textContent.includes("Başka bir sekme"),
  );
  assert.deepEqual(await slots(b), newer);
  assert.match(await b.locator("#notice").innerText(), /Başka bir sekme/);
  const download = await Promise.all([
    b.waitForEvent("download"),
    b.locator("[data-ui=export]").click(),
  ]);
  assert.ok(download[0].suggestedFilename().endsWith(".json"));
  results.push({
    case: "same-origin native tabs; storage events suppressed; stale manual save",
    pass: true,
    persistedRevision: rev,
    offlineExport: true,
  });
  await b.reload();
  const importBytes = (await slots(b))[0];
  await b.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = function () {
      window.importWaiting = true;
      return new Promise((resolve) => {
        window.finishImport = async () => resolve(await original.call(this));
      });
    };
  });
  await b.locator("#import-file").setInputFiles({
    name: "audit.json",
    mimeType: "application/json",
    buffer: Buffer.from(importBytes),
  });
  await b.waitForFunction(() => window.importWaiting);
  await act(a);
  const after = await slots(a);
  await b.evaluate(() => window.finishImport());
  await b.waitForFunction(() =>
    document.querySelector("#notice").textContent.includes("Başka bir sekme"),
  );
  assert.deepEqual(await slots(b), after);
  results.push({ case: "async file import races newer native tab save", pass: true });
  // Isolate the writer race from automatic storage-event reloads in both tabs.
  // The held lock must contain two queued writes before it is released; input
  // dispatch completion alone is not evidence that both save requests queued.
  await a.addInitScript(() => {
    window.addEventListener("storage", (e) => e.stopImmediatePropagation(), true);
  });
  await a.reload();
  await b.reload();
  await Promise.all([a, b].map((p) => p.waitForFunction(() => window.boardworldInspect?.())));
  assert.deepEqual(await a.evaluate(() => window.boardworldInspect()), await b.evaluate(() => window.boardworldInspect()));
  const beforeRace = await slots(a);
  await a.evaluate(() => {
    window.lockHeld = false;
    void navigator.locks.request("tariklab.boardworld.v6.transaction", async () => {
      window.lockHeld = true;
      await new Promise((r) => (window.releaseHeldLock = r));
    });
  });
  await a.waitForFunction(() => window.lockHeld);
  for (const p of [a, b])
    await p.evaluate(() => {
      window.actionDone = false;
      window.addEventListener("boardworld:action-complete", (event) => {
        window.actionCompletion = { id: event.detail.id, notice: document.querySelector("#notice").textContent };
        window.actionDone = true;
      }, {
        once: true,
      });
    });
  await Promise.all([
    a.locator("[data-action]:not([disabled]):visible").first().click(),
    b.locator("[data-action]:not([disabled]):visible").first().click(),
  ]);
  await a.waitForFunction(async () => {
    const { pending } = await navigator.locks.query();
    return pending.filter((lock) => lock.name === "tariklab.boardworld.v6.transaction").length === 2;
  });
  const held = await slots(a);
  assert.deepEqual(held, beforeRace, "both queued writers preserve storage while the transaction lock is held");
  await a.evaluate(() => window.releaseHeldLock());
  await Promise.all([
    a.waitForFunction(() => window.actionDone),
    b.waitForFunction(() => window.actionDone),
  ]);
  const completions = await Promise.all([a, b].map((p) => p.evaluate(() => window.actionCompletion)));
  const notices = completions.map((result) => result.notice);
  assert.equal(notices.filter((x) => x.includes("Başka bir sekme")).length, 1, JSON.stringify(completions));
  assert.notEqual((await slots(a))[0], held[0]);
  assert.equal((await slots(a))[1], held[0]);
  results.push({
    case: "genuine simultaneous native UI writes queued behind held Web Lock; exactly one saves and one conflicts",
    pass: true,
    queuedWriters: 2,
    completions,
  });
  const unsupported = await browser.newContext();
  const u = await unsupported.newPage();
  await u.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined }));
  await u.goto(url);
  await u.locator("#character-name").fill("Offline Safe");
  await u.locator("[data-testid=create-game]").click();
  await u.waitForFunction(() =>
    document.querySelector(".save-state")?.textContent.includes("otomatik kayıt kapalı"),
  );
  assert.deepEqual(await slots(u), [null, null]);
  await u.locator("[data-ui=menu]").click();
  await Promise.all([u.waitForEvent("download"), u.locator("[data-ui=export]").click()]);
  results.push({
    case: "unsupported Web Locks remains export-only with explicit warning and no storage writes",
    pass: true,
  });
  await unsupported.close();
  assert.deepEqual(errors, []);
  results.push({ case: "console/page exceptions", pass: true, count: errors.length });
  const report = { status: "PASS", origin, results };
  const output = resolve(process.env.RUNNER_TEMP || "../qa-stale", "screenshots/boardworld-stale");
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, "result.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server?.close();
}
