// Chromium regression for the persistent Pixi overlay used by TC SIM: DEVLET.
// The sequence matters: app.js rebuilds body between map screens, while the
// overlay keeps one canvas alive outside the rebuilt markup.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve("public");
const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".mjs": "text/javascript", ".svg": "image/svg+xml", ".webp": "image/webp" };
const server = createServer(async (request, response) => {
  try {
    let path = decodeURIComponent(new URL(request.url, "http://local").pathname);
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
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ["--no-sandbox"] });
  for (const width of [320, 360]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`${width}: pageerror ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${width}: console ${message.text()}`);
    });
    await page.goto(`http://127.0.0.1:${port}/games/tc-sim-devlet/`, { waitUntil: "networkidle" });
    await page.locator("#menu-new").click();
    await page.locator('[data-setup-field="era"][data-setup-value="2002"]').click();
    await page.locator('[data-setup-field="doctrine"][data-setup-value="none"]').click();
    await page.locator("#confirm-start").click();

    const open = async (screen) => {
      const nav = page.locator(".compact-nav");
      const target = nav.locator(`[data-screen="${screen}"]`);
      if (!(await target.isVisible())) await nav.locator(".nav-more").click();
      await target.click();
      await page.locator(screen === "regions" ? "svg.geo-map" : "svg.dip-map").waitFor();
      // Allow the dynamic Pixi import/mount to settle before measuring.
      await page.waitForTimeout(100);
      const measurement = await page.evaluate(() => {
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
      samples.push({ width, screen, ...measurement });
      assert.ok(measurement.scrollWidth <= measurement.viewport, `${width}px/${screen}: document overflow ${measurement.scrollWidth - measurement.viewport}px`);
      for (const [name, box] of [["overlay", measurement.overlay], ["canvas", measurement.canvas]]) {
        if (box) assert.ok(box.left >= -1 && box.right <= measurement.viewport + 1, `${width}px/${screen}: ${name} escapes viewport (${box.left}..${box.right} of ${measurement.viewport})`);
      }
    };
    await open("regions");
    await open("foreign");
    await open("regions");
    await open("foreign");
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
assert.deepEqual(errors, [], `browser console errors:\n${errors.join("\n")}`);
console.log(JSON.stringify({ samples }, null, 2));
