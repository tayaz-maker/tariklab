// Bounded Racon map acceptance: real actions, actual WebGL loss, six viewports/modes.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { chromium } from "playwright";
import { loadGame } from "./racon-harness.mjs";
import { checkedOutputPath } from "./browser-guard.mjs";
const args = process.argv.slice(2),
  arg = (key, fallback) => (args.includes(key) ? args[args.indexOf(key) + 1] : fallback);
const root = resolve(arg("--serve", "public")),
  label = arg("--label", "source"),
  only = arg("--only", "");
const proofRoot = resolve(process.env.RUNNER_TEMP || "/workspace", "screenshots"),
  out = checkedOutputPath(resolve(proofRoot, "racon", label), [proofRoot], "proof");
await mkdir(out, { recursive: true });
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname),
      file = resolve(root, `.${pathname.endsWith("/") ? pathname + "index.html" : pathname}`);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    res
      .writeHead(200, {
        "content-type": types[extname(file)] || "application/octet-stream",
        "cache-control": "no-store",
      })
      .end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const h = loadGame();
h.ev(
  'blank("Avlu");enterPlay();S.seed=4242;S.kasa=50000;S.cleanKasa=50000;S.dirtyKasa=0;S.screen="harita";S.stage="kabadayi";S.day=7;S.streets[1].sahip="sen";writeSave();',
);
const fixture = JSON.parse(h.localStorage.getItem("tariklab::racon:1"));
const results = [],
  errors = [];
let browser, page;
const saved = async () =>
  JSON.parse(await page.evaluate(() => localStorage.getItem("tariklab::racon:1")));
const go = async () => {
  await page.locator("#btn-devam").click();
  await page.locator(".rm-node").first().waitFor();
};
async function layout(scenario, phase) {
  const m = await page.evaluate(() => {
    const stage = document.querySelector("#stage"),
      root = document.querySelector(".rm-surface");
    return {
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      stageWidth: stage.clientWidth,
      stageScroll: stage.scrollWidth,
      nodes: document.querySelectorAll(".rm-node").length,
      canvas: document.querySelectorAll("canvas").length,
      renderer: root?.dataset.renderer,
      renderMs: Number(root?.dataset.renderMs) || 0,
      small: [...document.querySelectorAll(".rm-node")].filter(
        (n) => n.getBoundingClientRect().height < 44,
      ).length,
      clipped: [...document.querySelectorAll(".rm-node")].filter(
        (n) => n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1,
      ).length,
    };
  });
  assert.ok(m.scroll <= m.width + 1, JSON.stringify(m));
  assert.ok(m.stageScroll <= m.stageWidth + 1, JSON.stringify(m));
  assert.equal(m.small, 0);
  assert.equal(m.clipped, 0, JSON.stringify(m));
  assert.ok(m.canvas <= 1);
  results.push({ scenario, phase, ...m });
}
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  for (const width of [1440, 390, 320])
    for (const mode of ["pixi", "svg"]) {
      const scenario = `${mode}-${width}`;
      if (only && only !== scenario) continue;
      const ctx = await browser.newContext({
        viewport: { width, height: width === 1440 ? 960 : 844 },
        deviceScaleFactor: 1,
        isMobile: width < 500,
        hasTouch: width < 500,
      });
      await ctx.addInitScript(
        ({ fixture, mode }) => {
          if (!localStorage.getItem("racon-test-initialized")) {
            localStorage.setItem("tariklab::racon:1", JSON.stringify(fixture));
            localStorage.setItem("tariklab::racon:active", "1");
            localStorage.setItem("racon-test-initialized", "1");
          }
          if (mode === "svg") {
            const get = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type, ...args) {
              return /webgl/.test(type) ? null : get.call(this, type, ...args);
            };
          }
        },
        { fixture, mode },
      );
      page = await ctx.newPage();
      page.setDefaultTimeout(12000);
      page.on("pageerror", (e) => errors.push({ scenario, error: String(e) }));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push({ scenario, error: m.text() });
      });
      const start = performance.now();
      await page.goto(`${origin}/games/racon/index.html`);
      assert.equal(await page.locator("canvas").count(), 0, "menu does not eagerly load Pixi");
      await go();
      await page.waitForFunction(
        (mode) => document.querySelector(".rm-surface")?.dataset.renderer === mode,
        mode,
      );
      results.push({ scenario, phase: "startup", ms: performance.now() - start });
      await layout(scenario, "open");
      for (const layer of ["trust", "risk", "resource", "favor", "control"])
        await page.locator(`[data-act="rm-layer"][data-id="${layer}"]`).click();
      await page.locator('.rm-node[data-id="st_aksem"]').focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.id), "st_aksem");
      await page.locator('[data-act="ag-sec"][data-kind="cekil"]').click();
      await page.locator('[data-act="ag-target"][data-id="st_fevzi"]').click();
      const before = await saved();
      await page.locator('[data-act="ag"][data-kind="cekil"]').click();
      const after = await saved();
      assert.equal(after.kasa, before.kasa - 250);
      assert.equal(after.ag.flow.queue.length, 1);
      assert.equal(after.ag.flow.queue[0].left, 2);
      assert.equal(after.ag.flow.queue[0].focus, true);
      assert.equal(after.streets.find((s) => s.id === "st_aksem").sahip, "bos");
      await layout(scenario, "focused-decision");
      await page.locator('.rm-node[data-id="st_fevzi"]').click();
      await page.locator('[data-act="ag-sec"][data-kind="yatirim"]').click();
      await page.locator('[data-act="ag-target"][data-id="st_fener"]').click();
      await page.locator("#stage").evaluate((el) => (el.scrollTop = 0));
      await page.screenshot({ path: `${out}/${scenario}-map.png` });
      await page.locator(".ag-plan").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/${scenario}-decision.png` });
      await page.locator('[data-act="ag"][data-kind="yatirim"]').click();
      const checkpoint = await saved();
      await page.reload();
      await go();
      assert.deepEqual(
        (await saved()).ag,
        checkpoint.ag,
        "orders, direction, queue and log round-trip",
      );
      await page.locator("#btn-ilerlet").click();
      const stepped = await saved();
      assert.equal(stepped.week, checkpoint.week + 1);
      assert.equal(stepped.ag.flow.queue[0].left, 1);
      await layout(scenario, "weekly-step");
      await page.setViewportSize({ width: 720, height: 390 });
      await layout(scenario, "landscape");
      await page.setViewportSize({ width, height: width === 1440 ? 960 : 844 });
      await page.locator('[data-act="nav"][data-id="kasa"]').click();
      assert.equal(await page.locator("canvas").count(), 0, "screen exit cleans up");
      await page.locator('[data-act="nav"][data-id="harita"]').click();
      if (mode === "pixi") {
        await page.waitForFunction(
          () => document.querySelector(".rm-surface")?.dataset.renderer === "pixi",
        );
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const idle = await page.locator(".rm-surface").getAttribute("data-paints");
        await page.waitForTimeout(250);
        assert.equal(
          await page.locator(".rm-surface").getAttribute("data-paints"),
          idle,
          "no idle ticker",
        );
        assert.equal(
          await page.evaluate(() => {
            const c = document.querySelector(".rm-gpu canvas"),
              gl = c.getContext("webgl2") || c.getContext("webgl"),
              ext = gl.getExtension("WEBGL_lose_context");
            if (!ext) return false;
            ext.loseContext();
            return true;
          }),
          true,
        );
        await page.waitForFunction(
          () => document.querySelector(".rm-surface")?.dataset.renderer === "svg",
        );
        assert.equal(await page.locator("canvas").count(), 0);
        await layout(scenario, "actual-context-loss");
      }
      await page.locator('[data-act="rm-light"]').click();
      assert.equal(await page.locator("canvas").count(), 0);
      await layout(scenario, "lightweight");
      const current = (await saved()).ag;
      await page.locator('.top [data-act="menu"]').click();
      assert.equal(await page.locator("canvas").count(), 0);
      await go();
      assert.deepEqual((await saved()).ag, current);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
      assert.equal(await page.locator("canvas").count(), 0);
      await page.evaluate(() =>
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
      );
      await layout(scenario, "bfcache");
      await page.locator("#stage").evaluate((el) => (el.scrollTop = 0));
      await page.screenshot({ path: `${out}/${scenario}-final.png` });
      await ctx.close();
    }
  if (!only) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    page = await ctx.newPage();
    page.setDefaultTimeout(12000);
    page.on("pageerror", (e) => errors.push({ scenario: "new-game", error: String(e) }));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push({ scenario: "new-game", error: m.text() });
    });
    await page.goto(`${origin}/games/racon/index.html`);
    await page.locator('[data-go="nick"]').first().click();
    await page.locator("#lakap").fill("Kurgusal");
    await page.locator('[data-go="origin"]').click();
    await page.locator('[data-act="origin"][data-id="koy"]').click();
    for (let i = 0; i < 5 && (await page.locator("#menu-night").isVisible()); i++)
      await page.locator("#menu-night button").first().click();
    await page.locator('[data-act="nav"][data-id="harita"]').click();
    await page.locator(".rm-node").first().waitFor();
    assert.equal((await saved()).kind, "racon_v1");
    await layout("new-game", "first-map");
    await page.locator('[data-act="rm-plan"]').click();
    assert.equal(
      await page.locator(".ag-panel").evaluate((el) => el === document.activeElement),
      true,
    );
    // Re-enter while a real optional import is still in flight, then leave immediately.
    const bidir = structuredClone(fixture);
    h.win.RaconAg.start(bidir, "st_fevzi", "koru");
    h.win.RaconAg.start(bidir, "st_aksem", "koru");
    h.win.RaconAg.weekly(bidir);
    await page.evaluate((s) => localStorage.setItem("tariklab::racon:1", JSON.stringify(s)), bidir);
    let vendorRequested = false;
    await page.route("**/vendor/pixi/*.mjs", async (route) => {
      vendorRequested = true;
      await new Promise((r) => setTimeout(r, 250));
      await route.continue();
    });
    await page.reload();
    const request = page.waitForRequest((r) => r.url().includes("/vendor/pixi/"));
    await go();
    await request;
    await page.locator('[data-act="nav"][data-id="kasa"]').click();
    await page.waitForTimeout(350);
    assert.equal(vendorRequested, true);
    assert.equal(
      await page.locator("canvas").count(),
      0,
      "cancelled lazy renderer never leaves a canvas",
    );
    await page.unroute("**/vendor/pixi/*.mjs");
    await page.locator('[data-act="nav"][data-id="harita"]').click();
    await page.waitForFunction(
      () => document.querySelector(".rm-surface")?.dataset.renderer === "pixi",
    );
    const arrows = await page.locator('[data-link="st_fevzi|st_aksem"] [data-flow-from]').count();
    assert.equal(arrows, 2, "opposite in-flight effects are both visible");
    await layout("late-init", "cancel-and-reopen");
    await ctx.close();
  }
  assert.deepEqual(errors, []);
} catch (e) {
  errors.push({ error: String(e) });
  if (page) await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser?.close();
  await new Promise((r) => server.close(r));
  console.log(JSON.stringify({ out, checks: results.length, errors }, null, 2));
}
