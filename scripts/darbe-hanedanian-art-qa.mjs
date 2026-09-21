// Focused visual QA: DARBE card sample + HANEDANIAN atlas viewports.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const origin = process.env.GAME_E2E_ORIGIN || "http://127.0.0.1:8082";
const out = `${process.env.RUNNER_TEMP || "/workspace"}/tariklab/screenshots/final-art`;
mkdirSync(out, { recursive: true });

const sample = [
  "DRB-001", "DRB-002", "DRB-003", "DRB-004", "DRB-005", "DRB-006", "DRB-007", "DRB-008",
  "DRB-009", "DRB-010", "DRB-011", "DRB-012", "DRB-061", "DRB-068", "DRB-081", "DRB-125",
  "DRB-064", "DRB-065", "DRB-072", "DRB-076", "DRB-078", "DRB-126", "DRB-130", "DRB-235",
  "DRB-082", "DRB-083", "DRB-084", "DRB-074", "DRB-073", "DRB-066",
];

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const html = `<!doctype html><meta charset="utf-8"><title>DARBE sample</title>
  <style>body{margin:0;background:#12110e;color:#e8dcc4;font:12px/1.3 ui-sans-serif,system-ui}
  h1{font:16px Georgia,serif;margin:12px 16px} .grid{display:flex;flex-wrap:wrap;gap:10px;padding:12px}
  figure{margin:0;width:180px} img{width:180px;height:252px;background:#0e1014;display:block}
  figcaption{margin-top:4px;opacity:.8}</style>
  <h1>DARBE-H! · 30-card human-eye sample</h1>
  <div class="grid">${sample.map((id) => `<figure><img src="${origin}/games/darbe-h/assets/cards/${id}.svg" alt="${id}"><figcaption>${id}</figcaption></figure>`).join("")}</div>`;
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/darbe-30-sample.png`, fullPage: true });

  const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await desk.goto(`${origin}/games/darbe-h/index.html`, { waitUntil: "networkidle" });
  await desk.waitForTimeout(800);
  await desk.screenshot({ path: `${out}/darbe-desktop-menu.png` });
  const archiveBtn = desk.getByRole("button", { name: /arşiv|archive/i }).first();
  if (await archiveBtn.count()) {
    await archiveBtn.click();
    await desk.waitForTimeout(600);
    await desk.screenshot({ path: `${out}/darbe-desktop-archive.png` });
  }

  const hand = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await hand.goto(`${origin}/games/darbe-h/index.html`, { waitUntil: "networkidle" });
  await hand.waitForTimeout(800);
  await hand.screenshot({ path: `${out}/darbe-mobile-menu.png` });

  for (const [width, height, mobile] of [[1280, 720, false], [1920, 1080, false], [390, 844, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const p = await context.newPage();
    await p.goto(`${origin}/games/hanedanian/index.html`, { waitUntil: "networkidle" });
    const welcome = p.locator("#welcome");
    if (await welcome.isVisible()) {
      await p.locator('[data-action="new"]').first().click();
      await p.locator('#new-form input[name="seed"]').fill("TL-ART-ATLAS");
      await p.locator("#new-form button").click();
      await welcome.waitFor({ state: "hidden" });
    }
    await p.waitForFunction(() => Number(document.querySelector("#world-map")?.dataset.drawnTiles) > 0);
    const guide = p.locator("[data-guide='dismiss']");
    if (await guide.count()) await guide.click().catch(() => {});
    await p.screenshot({ path: `${out}/hanedanian-${width}-default.png` });
    const canvas = p.locator("#world-map");
    const box = await canvas.boundingBox();
    if (box) {
      await p.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45);
      await p.waitForTimeout(200);
      await p.screenshot({ path: `${out}/hanedanian-${width}-selected.png` });
      await p.mouse.wheel(0, -280);
      await p.waitForTimeout(200);
      await p.screenshot({ path: `${out}/hanedanian-${width}-zoom.png` });
    }
    const hud = await p.evaluate(() => {
      const top = document.querySelector(".topbar")?.getBoundingClientRect();
      const goal = document.querySelector(".campaign-strip")?.getBoundingClientRect();
      return { top: top?.height || 0, goal: goal?.height || 0, total: (top?.height || 0) + (goal?.height || 0) };
    });
    writeFileSync(`${out}/hanedanian-${width}-hud.json`, JSON.stringify(hud));
    await context.close();
  }
  console.log("qa-written", out);
} finally {
  await browser.close();
}
