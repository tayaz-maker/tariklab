// Real Chromium layout/interaction regression against the Vite runtime.
// Production compilation remains a separate CI gate; deployed assets are smoked separately.
// Run in CI where the browser binary is installed; no emulated DOM or skipped tests.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { townBrowser } from "./son-kasaba-browser.mjs";
import { correctionFlows } from "./playability-browser.mjs";
import { deskFlows, deskLanguageSwitch } from "./management-desk-browser.mjs";

const origin = "http://127.0.0.1:8081";
const out = `${process.env.RUNNER_TEMP || "/workspace"}/screenshots/tariklab-ux`;
mkdirSync(out, { recursive: true });
const catalog = readFileSync("src/lib/games.ts", "utf8").split("export const GAMES:")[1];
const routes = [...catalog.matchAll(/slug: "([^"]+)"[\s\S]*?status: "live",\s*href: "([^"]+)"/g)]
  .map((match) => ({ id: match[1], href: match[2] }));
assert.equal(routes.length, 19);
const viewports = [[320,568],[360,800],[390,844],[430,932],[640,360],[740,390],[844,390],[768,1024],[820,1180],[1024,768],[1280,720],[1280,800],[1440,900],[1920,1080]];
const nextWave = new Set(["apartman", "tc-sim-devlet", "son-100-gun", "kayip-telefon", "son-kasaba"]);
const errors = [], results = [];
const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "8081"], { stdio: "inherit" });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try { ready = (await fetch(origin)).ok; } catch { /* server is starting */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "Vite runtime did not start");
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });
  for (const lang of ["tr", "en"]) {
    for (const route of [{ id: "portal", href: "/" }, ...routes, { id: "credits", href: "/credits.html" }, { id: "ihtilal", href: "/ihtilal" }]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await context.addInitScript((language) => localStorage.setItem("tariklab.language", language), lang);
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(`${route.id}/${lang}: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error" && message.location().url.startsWith(origin)) errors.push(`${route.id}/${lang}: ${message.text()} ${message.location().url}`);
      });
      page.on("response", (response) => {
        if (response.url().startsWith(origin) && response.status() >= 400) errors.push(`${route.id}: HTTP ${response.status()} ${response.url()}`);
      });
      let surface = page;
      async function measure(stage, sizes = viewports) {
        for (const [width, height] of sizes) {
          await page.setViewportSize({ width, height });
          const dimensions = await surface.evaluate(() => ({
            width: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth,
            text: document.body.innerText.trim().length,
            duplicates: [...document.querySelectorAll("[id]")].map((node) => node.id).filter((id, index, all) => all.indexOf(id) !== index),
          }));
          results.push({ game: route.id, lang, stage, width, height, overflow: dimensions.scroll - dimensions.width });
          assert.ok(dimensions.text > 20, `${route.id}/${stage}: empty surface`);
          assert.ok(dimensions.scroll <= dimensions.width + 1, `${route.id}/${lang}/${stage}/${width}x${height}: overflow ${JSON.stringify(dimensions)}`);
          assert.deepEqual(dimensions.duplicates, [], `${route.id}/${stage}: duplicate IDs`);
        }
      }
      try {
        const response = await page.goto(`${origin}${route.href}`, { waitUntil: "networkidle" });
        assert.equal(response.status(), 200, route.href);
        if (route.href === "/ihtilal") await page.waitForURL(`${origin}/oyna/ihtilal`);
        if (new URL(page.url()).pathname.startsWith("/oyna/")) {
          const iframe = page.locator("iframe");
          await iframe.waitFor();
          surface = await (await iframe.elementHandle()).contentFrame();
          await surface.waitForFunction(() => document.body.innerText.trim().length > 20);
          const duplicateChrome = await surface.locator(
            'a[href="/"], .masthead-exit, .start-exit, [data-lang-host], .tlab-lang',
          ).evaluateAll((nodes) => nodes.filter((node) => {
            const style = getComputedStyle(node);
            const rect = node.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          }).length);
          assert.equal(duplicateChrome, 0, `${route.id}/${lang}: duplicate embedded back/language chrome`);
        }
        await measure("entry");
        if (route.id === "portal") {
          assert.equal(await page.locator('a[href^="/oyna/"], a[href="/cete-savaslari"], a[href="/games/bukucu/index.html"]').count(), routes.length);
        }
        if (["veto-h", "gett-oh"].includes(route.id)) {
          const other = lang === "tr" ? "en" : "tr";
          await page.getByRole("button", { name: other.toUpperCase(), exact: true }).click();
          await surface.waitForFunction(language => document.documentElement.lang === language, other);
          assert.ok(await surface.getByRole("button", { name: other === "en" ? "New Duel" : "Yeni Düello", exact: true }).isVisible());
          await page.getByRole("button", { name: lang.toUpperCase(), exact: true }).click();
          await surface.waitForFunction(language => document.documentElement.lang === language, lang);
          assert.equal(await surface.evaluate(key => localStorage.getItem(key), `tariklab.${route.id}.duel`), null);
        }
        if (nextWave.has(route.id)) {
          assert.equal(await surface.locator(".slot-card").count(), 3);
          await surface.locator("#menu-new").click();
          await measure("setup");
          if (route.id === "tc-sim-devlet") {
            await surface.locator('[data-setup-field="era"][data-setup-value="2002"]').click();
            await surface.locator('[data-setup-field="doctrine"][data-setup-value="none"]').click();
          }
          if (route.id === "son-100-gun") await surface.locator("[data-scenario]").first().click();
          await surface.locator("#confirm-start").click();
          if (route.id === "tc-sim-devlet") assert.equal(await surface.evaluate(() => document.scrollingElement.scrollTop), 0, "New state opens at its overview");
          await measure("game");
          await page.setViewportSize({ width: 390, height: 844 });
          const save = surface.locator(".save-menu > summary");
          assert.ok(await save.isVisible(), `${route.id}: embedded save control hidden`);
          await save.click();
          await measure("save", [[320,568],[390,844],[640,360],[1440,900]]);
          const popup = surface.locator(".save-popover");
          const box = await popup.boundingBox();
          assert.ok(box.width > 0 && box.height > 0);
          await save.click();
        } else if (route.id === "tc-sim") {
          const introCta = surface.locator("#show-creation-form");
          assert.ok(await introCta.isVisible(), `${route.id}/${lang}: editorial intro CTA`);
          await introCta.click();
          assert.ok(
            await surface.locator('input[name="name"]').isVisible(),
            `${route.id}/${lang}: character setup after intro`,
          );
          await surface.locator('input[name="name"]').fill("Uzun İsimli Deneme Karakteri QA");
          await deskLanguageSwitch(page, surface, lang, true);
          await surface.locator('#new-game-form button[type="submit"]').click();
          await measure("game");
        }
        if (["tc-sim", "tc-sim-devlet", "son-kasaba"].includes(route.id)) {
          await page.setViewportSize({ width: 390, height: 844 });
          const nav = surface.locator(".compact-nav");
          const more = nav.locator(".nav-more");
          await more.click();
          assert.equal(await more.getAttribute("aria-expanded"), "true");
          await more.press("Escape");
          assert.equal(await more.getAttribute("aria-expanded"), "false");
          const attribute = route.id === "tc-sim" ? "data-view" : "data-screen";
          const destinations = await nav.locator(`[${attribute}]`).evaluateAll((nodes, attr) => nodes.map((node) => node.getAttribute(attr)), attribute);
          for (const destination of destinations) {
            await page.setViewportSize({ width: 390, height: 844 });
            const target = nav.locator(`[${attribute}="${destination}"]`);
            if (!(await target.isVisible())) await more.click();
            await target.click();
            if (["tc-sim", "tc-sim-devlet"].includes(route.id)) assert.equal(await surface.evaluate(() => document.scrollingElement.scrollTop), 0, "A new workspace must open at its primary controls");
            assert.equal(await nav.locator(`[${attribute}="${destination}"]`).getAttribute("aria-current"), "page");
            await measure(destination, [[320,568],[360,800],[390,844],[430,932],[640,360],[768,1024],[1440,900]]);
          }
        }
        await correctionFlows(page, surface, route.id, lang, out);
        // correctionFlows may reload fixtures; reacquire the current frame.
        if (["tc-sim", "tc-sim-devlet"].includes(route.id)) surface = await (await page.locator("iframe").elementHandle()).contentFrame();
        await deskFlows(page, surface, route.id, lang, out);
        await townBrowser(page, surface, route.id, lang, out);
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.screenshot({ path: `${out}/all-${route.id}-${lang}-1280x720.png`, fullPage: false });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: `${out}/all-${route.id}-${lang}-390x844.png`, fullPage: false });
        if (["portal", "tc-sim-devlet", "tc-sim"].includes(route.id)) {
          await page.screenshot({ path: `${out}/${route.id}-${lang}.png`, fullPage: true });
          await page.setViewportSize({ width: 390, height: 844 });
          await page.screenshot({ path: `${out}/${route.id}-${lang}-mobile.png`, fullPage: true });
        }
      } catch (error) {
        errors.push(`${route.id}/${lang}: ${error.message}`);
        await page.screenshot({ path: `${out}/${route.id}-${lang}-failure.png`, fullPage: true });
        console.error(errors.at(-1));
      } finally { await context.close(); }
    }
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
}
console.log(JSON.stringify({ checks: results.length, errors }, null, 2));
assert.equal(errors.length, 0, "responsive/interaction regression failed");
