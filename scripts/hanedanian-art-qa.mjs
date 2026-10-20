// Focused visual QA: HANEDANIAN map viewports.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const origin = process.env.GAME_E2E_ORIGIN || "http://127.0.0.1:8082";
const out = `${process.env.RUNNER_TEMP || "/workspace"}/tariklab/screenshots/final-art`;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox"],
});

try {
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
