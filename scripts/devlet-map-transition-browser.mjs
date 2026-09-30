// Chromium regression for the persistent Pixi overlay used by TC SIM: DEVLET.
// The sequence matters: app.js rebuilds body between map screens, while the
// overlay keeps one canvas alive outside the rebuilt markup.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve("public");
const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp" };
const server = createServer(async (request, response) => {
  try {
    let path = decodeURIComponent(new URL(request.url, "http://local").pathname);
    if (path === '/_regression.html') {
      response.writeHead(200, {'content-type':'text/html'}).end('<!doctype html><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style><iframe src="/games/tc-sim-devlet/"></iframe>');
      return;
    }
    if (path.endsWith("/")) path += "index.html";
    const file = resolve(root, `.${path}`);
    if (!file.startsWith(`${root}/`)) throw new Error("outside public");
    response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const port = server.address().port;

const errors = [];
const samples = [];
const evidence = resolve(process.env.RUNNER_TEMP || '/tmp', 'screenshots/devlet-map-transition');
await mkdir(evidence, {recursive:true});
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });
  for (const lang of ['tr', 'en']) for (const width of [320, 360, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    await context.addInitScript(language => localStorage.setItem('tariklab.language', language), lang);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${width}: pageerror ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${width}: console ${message.text()}`);
    });
    await page.goto(`http://127.0.0.1:${port}/_regression.html`, { waitUntil: "networkidle" });
    let surface = await (await page.locator('iframe').elementHandle()).contentFrame();
    await surface.locator("#menu-new").click();
    await surface.locator('[data-setup-field="era"][data-setup-value="2002"]').click();
    await surface.locator('[data-setup-field="doctrine"][data-setup-value="none"]').click();
    await surface.locator("#confirm-start").click();

    const open = async (screen) => {
      const nav = surface.locator(".compact-nav");
      const target = nav.locator(`[data-screen="${screen}"]`);
      if (!(await target.isVisible())) await nav.locator(".nav-more").click();
      await target.click();
      await surface.locator(screen === "regions" ? "svg.geo-map" : "svg.dip-map").waitFor();
      // Allow the dynamic Pixi import/mount to settle before measuring.
      await page.waitForTimeout(100);
      const measurement = await surface.evaluate(() => {
        const viewport = window.innerWidth;
        const overlay = document.querySelector(".devlet-map-pixi-overlay");
        const canvas = overlay?.querySelector("canvas");
        const rect = (node) => node ? node.getBoundingClientRect() : null;
        return {
          viewport,
          scrollWidth: document.documentElement.scrollWidth,
          overlay: rect(overlay),
          canvas: rect(canvas),
        };
      });
      samples.push({ lang, width, screen, ...measurement });
      assert.ok(measurement.scrollWidth <= measurement.viewport, `${width}px/${screen}: document overflow ${measurement.scrollWidth - measurement.viewport}px`);
      for (const [name, box] of [["overlay", measurement.overlay], ["canvas", measurement.canvas]]) {
        if (box) assert.ok(box.left >= -1 && box.right <= measurement.viewport + 1, `${width}px/${screen}: ${name} escapes viewport (${box.left}..${box.right} of ${measurement.viewport})`);
      }
    };
    await open("regions");
    await open("foreign");
    // Reproduce CI's wide-to-narrow resize before the asynchronous resize
    // listener catches up. The overlay is offset 23px inside this workspace.
    await open('regions');
    await page.setViewportSize({width:1440,height:900});
    await page.waitForTimeout(100);
    await page.setViewportSize({width,height:568});
    const immediate = await surface.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(immediate.scroll <= immediate.width, `${lang}/${width}: immediate resize overflow`);
    const save = surface.locator('.save-menu > summary');
    await save.click();
    const popup = await surface.locator('.save-popover').boundingBox();
    const bounds = await surface.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(bounds.scroll <= bounds.width, `${lang}/${width}: open save overflow`);
    assert.ok(popup.x >= 0 && popup.x+popup.width <= width, `${lang}/${width}: save outside viewport`);
    await page.screenshot({path:resolve(evidence, `${lang}-${width}-save.png`),fullPage:true});
    await surface.locator('[data-save-slot="1"]').click();
    const saved = await surface.evaluate(() => localStorage.getItem('tariklab.nextwave.tc-sim-devlet.slot1'));
    assert.ok(saved, 'save written locally');
    await page.reload({waitUntil:'networkidle'});
    surface = await (await page.locator('iframe').elementHandle()).contentFrame();
    await surface.locator('#menu-continue').click();
    assert.equal(await surface.evaluate(() => localStorage.getItem('tariklab.nextwave.tc-sim-devlet.slot1')),saved,'reload preserves save');
    await open('regions');
    await open('foreign');
    await open('regions');
    await surface.locator('.save-menu > summary').click();
    await surface.locator('.save-menu > summary').click();
    assert.equal(await surface.locator('.save-menu').getAttribute('open'),null,'save opens and closes');
    await open("regions");
    await open("foreign");
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
assert.deepEqual(errors, [], `browser console errors:\n${errors.join("\n")}`);
await writeFile(resolve(evidence,'results.json'), JSON.stringify({samples,errors},null,2));
console.log(JSON.stringify({ samples }, null, 2));
