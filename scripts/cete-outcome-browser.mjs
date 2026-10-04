// Real decision actions in fresh contexts; no user saves or engine test hooks.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { hydratePlayer, makeRivals, MARKET_START, SAVE_VERSION } from "../src/game/data.ts";
import { checkedUrl } from "./browser-guard.mjs";

const port = process.env.CETE_BUILD === "1" ? "8087" : "8086";
const base = checkedUrl(process.env.CETE_BASE || `http://127.0.0.1:${port}`);
const out = `${process.env.RUNNER_TEMP || "/workspace"}/screenshots/cete-outcome/${process.env.CETE_LABEL || "preview"}`;
await mkdir(out, { recursive: true });
const server = process.env.CETE_BASE ? null : spawn("npm", ["run", process.env.CETE_BUILD === "1" ? "preview" : "dev", "--", "--host", "127.0.0.1", "--port", port], { stdio: "inherit", detached: true });
let browser;
const results = [];
const servedBundles = [];
const responseReads = [];
const readSave = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("tariklab::cete:1")).state.player);
try {
  if (server) {
    let ready = false;
    for (let i = 0; i < 120; i++) {
      try { ready = (await fetch(base)).ok; } catch { /* bounded startup */ }
      if (ready) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(ready, "server startup");
  }
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });
  for (const lang of ["tr", "en"]) for (const width of [1440, 390, 320]) for (const reducedMotion of ["no-preference", "reduce"]) {
    const tag = `${lang}-${width}-${reducedMotion}`;
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 844 }, reducedMotion });
    const player = hydratePlayer({ name: "Outcome Test", neighborhood: "eyup", level: 20, energy: 150, cash: 10000, jobsDone: 0, contractId: "c101", contractGun: 1, tutorialStep: 4, streakDay: "2026-10-04" });
    const fixture = { state: { version: SAVE_VERSION, player, rivals: makeRivals(), logs: [], hiz: 1, market: MARKET_START, savedAt: Date.now() }, version: SAVE_VERSION };
    await context.addInitScript(({ fixture, lang }) => {
      // Canonical legacy save: tests old-save migration without adding fields.
      if (!sessionStorage.getItem("outcome-seeded")) {
        localStorage.setItem("cete-savaslari-save-v1", JSON.stringify(fixture));
        localStorage.setItem("cete-age-ok", "1");
        localStorage.setItem("tariklab.language", lang);
        sessionStorage.setItem("outcome-seeded", "1");
      }
      let seed = 77;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 0.1;
    }, { fixture, lang });
    const page = await context.newPage();
    const errors = [];
    if (!results.length) page.on("response", (response) => {
      if (/\/assets\/game-shell-[^/]+\.js$/.test(response.url())) {
        responseReads.push(response.body().then((bytes) => servedBundles.push({ url: response.url(), sha256: createHash("sha256").update(bytes).digest("hex") })));
      }
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto(`${base}/cete-savaslari?sekme=icraat`, { waitUntil: "networkidle" });
    const action = page.getByRole("button", { name: lang === "tr" ? "İcraata çık" : "Take job", exact: true }).first();
    await action.waitFor();
    assert.equal(await page.locator("[data-outcome-moment]").count(), 0, "load does not replay");
    await page.screenshot({ path: `${out}/${tag}-before.png` });
    const before = await readSave(page);
    await action.click();
    const moment = page.locator("[data-outcome-moment]");
    await moment.waitFor({ state: "visible" });
    const focusSteal = await page.evaluate(() => !!document.activeElement?.closest("[data-outcome-moment]"));
    assert.equal(focusSteal, false, "focus remains on decision");
    await moment.hover(); // Freeze auto-dismiss while inspecting the receipt.
    const after = await readSave(page);
    assert.equal(after.jobsDone, before.jobsDone + 1);
    assert.equal(after.contractId, null);
    const display = await moment.locator("dd").allTextContents();
    const signed = (n) => `${n > 0 ? "+" : ""}${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(n)}`;
    assert.deepEqual(display, [`${signed(after.cash - before.cash)} ₺`, signed(after.itibar - before.itibar), signed(after.isi - before.isi)]);
    const geometry = await moment.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, docWidth: document.documentElement.scrollWidth, width: innerWidth, canvas: el.querySelectorAll("canvas, img, audio, video").length,
        animations: el.getAnimations({ subtree: true }).map((a) => a.effect.getComputedTiming().duration) };
    });
    assert.ok(geometry.left >= 0 && geometry.right <= width && geometry.top >= 0 && geometry.bottom <= 900);
    assert.ok(geometry.scrollWidth <= geometry.clientWidth && geometry.docWidth <= width, JSON.stringify(geometry));
    assert.equal(geometry.canvas, 0);
    assert.ok(await page.getByRole("status").filter({ hasText: lang === "tr" ? "KAYIT KAPANDI" : "RECORD CLOSED" }).count() > 0);
    if (reducedMotion === "reduce") assert.equal(geometry.animations.length, 0);
    await page.screenshot({ path: `${out}/${tag}-after.png` });
    const close = moment.getByRole("button", { name: lang === "tr" ? "Sonucu kapat" : "Close outcome" });
    await close.focus();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(2400);
    assert.equal(await moment.count(), 1, "keyboard focus pauses dismissal");
    await close.press("Escape");
    assert.equal(await moment.count(), 0, "Escape closes");
    assert.equal(await action.evaluate((el) => el === document.activeElement), true, "focus returns to origin");
    // Same ordinary job after the contract is closed: no milestone or repeat.
    await action.click();
    assert.equal(await moment.count(), 0, "ordinary repetition suppressed");
    const saved = await readSave(page);
    await page.reload({ waitUntil: "networkidle" });
    await action.waitFor();
    assert.equal(await moment.count(), 0, "reload does not replay");
    const restored = await readSave(page);
    assert.equal(restored.jobsDone, saved.jobsDone);
    assert.equal(restored.contractId, null);
    assert.equal(restored.cash, saved.cash);
    assert.ok(!Object.keys(restored).some((k) => /moment|outcome/i.test(k)), "no save additions");
    assert.deepEqual(errors, []);
    results.push({ tag, ok: true, deltas: display, geometry, saveReload: true, noReplay: true, focusRestored: true, errors });
    await context.close();
  }
  // Unfocused normal motion exits in 2.2s; reduced motion stays until closed.
  for (const mode of ["no-preference", "reduce", "screen-switch"]) {
    const reducedMotion = mode === "screen-switch" ? "reduce" : mode;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion });
    await context.addInitScript(() => { localStorage.setItem("cete-age-ok", "1"); localStorage.setItem("tariklab.language", "tr"); let seed = 77; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 0.1; });
    const page = await context.newPage();
    await page.goto(`${base}/cete-savaslari`, { waitUntil: "networkidle" });
    await page.getByPlaceholder("Örn. Halil").fill("Süre Testi");
    await page.getByRole("button", { name: /Sokağa in/i }).click();
    const action = page.getByRole("button", { name: "İcraata çık", exact: true }).first();
    await page.getByText("Ana ekrana ekle", { exact: true }).waitFor({ timeout: 7000 });
    await action.click();
    const moment = page.locator("[data-outcome-moment]");
    await moment.waitFor();
    await page.mouse.move(0, 0);
    const started = Date.now();
    assert.equal(await moment.locator(".cete-moment-foot").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("[data-outcome-moment]");
    }), true, "install hint cannot occlude the receipt");
    if (mode === "screen-switch") {
      await page.getByRole("button", { name: "Ben", exact: true }).click();
      assert.equal(await moment.count(), 0, "switch disposes card");
      await page.getByRole("button", { name: "İcraat", exact: true }).click();
      await action.waitFor();
      assert.equal(await moment.count(), 0, "return does not replay");
    } else if (reducedMotion === "reduce") {
      await page.waitForTimeout(2600);
      assert.equal(await moment.count(), 1);
      await moment.getByRole("button", { name: "Sonucu kapat" }).click();
      assert.equal(await moment.count(), 0);
    } else {
      await moment.waitFor({ state: "detached", timeout: 3000 });
      assert.ok(Date.now() - started >= 1500 && Date.now() - started <= 2500, `duration ${Date.now() - started}`);
    }
    results.push({ tag: `duration-${mode}`, ok: true, elapsed: Date.now() - started });
    await context.close();
  }
} catch (e) {
  results.push({ ok: false, error: String(e.stack || e) });
  throw e;
} finally {
  await Promise.all(responseReads);
  await writeFile(`${out}/results.json`, JSON.stringify({ base, results, servedBundles }, null, 2));
  await browser?.close();
  if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* already stopped */ } }
}
console.log(JSON.stringify({ base, scenarios: results.length, ok: results.every((r) => r.ok), out }));
