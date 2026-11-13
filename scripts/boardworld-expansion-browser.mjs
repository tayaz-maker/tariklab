import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";

const root = process.argv[2] || "public";
const server = createStaticGameServer(root);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/games/tc-sim-boardworld/index.html");
  await page.locator("#character-name").fill("Deniz Test");
  await page.locator('[data-testid="create-game"]').click();
  await page.locator(".event-choices [data-action]:enabled").first().click();
  const gold = await page.evaluate(() => localStorage.getItem("tariklab.boardworld.v6"));
  assert.equal(JSON.parse(gold).version, 6);
  await page.locator("[data-tab=expansion]").click();
  await page.locator("[data-ui=expand]").click();
  await page.waitForFunction(() => window.boardworldInspect?.()?.version === 7);
  assert.equal(await page.evaluate(() => localStorage.getItem("tariklab.boardworld.v6")), gold);
  await page
    .locator("details")
    .filter({ has: page.locator('[data-action="family:adopt"]') })
    .locator("summary")
    .first()
    .click();
  await page.locator('[data-action="family:adopt"]').click();
  await page.waitForFunction(() =>
    window.boardworldInspect?.()?.expansion.events.some((e) => e.type === "family-adoption"),
  );
  const peer = await context.newPage();
  await peer.goto(page.url());
  await peer.waitForFunction(
    () => window.boardworldInspect?.()?.expansion.world.region === "istanbul",
  );
  await page.locator('[data-action="world:move:ankara"]').click();
  await page.waitForFunction(
    () => window.boardworldInspect?.()?.expansion.world.region === "ankara",
  );
  await page.waitForFunction(
    () => !document.querySelector(".save-state")?.textContent.includes("Kaydediliyor"),
  );
  await peer.locator('[data-action="world:move:izmir"]').click();
  await peer
    .getByRole("status")
    .filter({ hasText: "Başka bir sekme kaydı değiştirdi" })
    .first()
    .waitFor();
  await page.reload();
  await page.waitForFunction(
    () => window.boardworldInspect?.()?.expansion.world.region === "ankara",
  );
  const state = await page.evaluate(() => window.boardworldInspect());
  assert.equal(state.player.name, "Deniz Test");
  assert.equal(state.expansion.events.at(-1).type, "relocation");
  assert.ok(state.expansion.events.some((event) => event.type === "family-adoption"));
  assert.equal(await page.evaluate(() => localStorage.getItem("tariklab.boardworld.v6")), gold);
  const size = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  assert.ok(size[0] <= size[1] + 1, size.join("/"));
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: "PASS",
      root,
      region: state.expansion.world.region,
      version: state.version,
    }),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
