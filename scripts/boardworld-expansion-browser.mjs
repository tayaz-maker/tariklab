import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { openBoardworldTab } from "./boardworld-browser-navigation.mjs";

const root = process.argv[2] || "public";
const server = createStaticGameServer(root);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const expansionRequests = (page) => {
  const files = new Set();
  page.on("request", (request) => {
    const file = new URL(request.url()).pathname.split("/").at(-1);
    if (/^expansion.*\.mjs$/.test(file)) files.add(file);
  });
  return files;
};
async function savedSlots(page) {
  return page.evaluate(async () => {
    const open = indexedDB.open("tariklab.boardworld.v6.transactions", 1);
    const db = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      const read = db.transaction("state").objectStore("state").get("head");
      return await new Promise((resolve, reject) => {
        read.onsuccess = () => resolve(read.result);
        read.onerror = () => reject(read.error);
      });
    } finally {
      db.close();
    }
  });
}
async function rejectFile(page) {
  const before = await savedSlots(page);
  await page.locator("#import-file").setInputFiles({
    name: "invalid-boardworld-save.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"format":"tc-sim-boardworld","version":7,"checksum":"wrong","payload":"{}"}',
    ),
  });
  await page.locator("#notice.error").filter({ hasText: "Bu dosya geçerli" }).waitFor();
  assert.deepEqual(await savedSlots(page), before);
}
async function verifyUnavailableRuntime(browser, url, head, state) {
  const slots = new Map(head.slots);
  assert.ok(slots.get("tariklab.boardworld.v7"));
  assert.ok(slots.get("tariklab.boardworld.v7.backup"));
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    const requests = expansionRequests(page);
    const seedUrl = new URL("/boardworld-browser-seed", url).href;
    await page.route(seedUrl, (route) => route.fulfill({ contentType: "text/html", body: "" }));
    await page.goto(seedUrl);
    await page.evaluate(async (head) => {
      const request = indexedDB.open("tariklab.boardworld.v6.transactions", 1);
      const db = await new Promise((resolve, reject) => {
        request.onupgradeneeded = () => {
          request.result.createObjectStore("state");
          request.result.createObjectStore("seen");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put(head, "head");
        await new Promise((resolve, reject) => {
          tx.oncomplete = resolve;
          tx.onabort = () => reject(tx.error);
        });
      } finally {
        db.close();
      }
    }, head);
    const runtimeUrl = new URL("./expansion.mjs", url).href;
    await page.route(runtimeUrl, (route) => route.abort());
    await page.goto(url);
    await page.waitForFunction(() => window.boardworldInspect?.()?.version === 6);
    assert.ok(requests.has("expansion.mjs"));
    assert.match(await page.locator(".save-state").textContent(), /Nesiller kaydı okunamadı/);
    await openBoardworldTab(page, "expansion");
    await page.locator('[role="alert"]').filter({ hasText: "Nesiller kaydı okunamadı" }).waitFor();
    assert.equal(await page.locator('[data-ui="expand"]').count(), 0);
    assert.deepEqual(await savedSlots(page), head);
    await page.unroute(runtimeUrl);
    await page.reload();
    await page.waitForFunction(() => window.boardworldInspect?.()?.version === 7);
    assert.deepEqual(await page.evaluate(() => window.boardworldInspect()), state);
    assert.deepEqual(await savedSlots(page), head);
  } finally {
    await context.close();
  }
}
async function within(operation, label) {
  let timeout;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
async function verifySlowRuntime(context, writer) {
  const reader = await context.newPage();
  const runtimeUrl = new URL("./expansion.mjs", writer.url()).href;
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  try {
    let requested;
    const pending = new Promise((resolve) => {
      requested = resolve;
    });
    await reader.route(runtimeUrl, async (route) => {
      requested();
      await held;
      await route.continue();
    });
    await reader.goto(writer.url(), { waitUntil: "commit" });
    await within(pending, "expansion runtime request");
    const latest = await within(
      writer.evaluate(async () => {
        const { loadGameLocked, saveGameLocked, loadExpansionLocked, saveExpansionLocked } =
          await import("./persistence.mjs");
        const { state, token } = await loadGameLocked();
        const gold = await saveGameLocked(state, undefined, token);
        if (!gold.ok) throw new Error(gold.message);
        const expansion = await loadExpansionLocked();
        expansion.state.revision++;
        const saved = await saveExpansionLocked(expansion.state, undefined, expansion.token);
        if (!saved.ok) throw new Error(saved.message);
        return expansion.state;
      }),
      "Gold and v7 writes while runtime is pending",
    );
    release();
    await reader.waitForFunction(() => window.boardworldInspect?.()?.version === 7);
    assert.deepEqual(await reader.evaluate(() => window.boardworldInspect()), latest);
  } finally {
    release();
    await reader.close();
  }
}
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const requested = expansionRequests(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + "/games/tc-sim-boardworld/index.html");
  await page.locator("#character-name").waitFor();
  assert.deepEqual([...requested], []);
  await page.locator("#character-name").fill("Deniz Test");
  await page.locator('[data-testid="create-game"]').click();
  const opening = await page.evaluate(() => localStorage.getItem("tariklab.boardworld.v6"));
  await page.locator(".event-choices [data-action]:enabled").first().click();
  await page.waitForFunction(
    (before) => localStorage.getItem("tariklab.boardworld.v6") !== before,
    opening,
  );
  const gold = await page.evaluate(() => localStorage.getItem("tariklab.boardworld.v6"));
  assert.equal(JSON.parse(gold).version, 6);
  assert.deepEqual([...requested], [], "Gold play should request no expansion modules");
  await openBoardworldTab(page, "expansion");
  await page.locator("[data-ui=expand]").waitFor();
  await rejectFile(page);
  assert.deepEqual(
    [...requested],
    ["expansion-preview.mjs"],
    "Preview and malformed file import should request no expansion runtime",
  );
  await page.locator("[data-ui=expand]").click();
  await page.waitForFunction(() => window.boardworldInspect?.()?.version === 7);
  assert.ok(requested.has("expansion.mjs") && requested.has("expansion-ui.mjs"));
  assert.equal(await page.evaluate(() => localStorage.getItem("tariklab.boardworld.v6")), gold);
  const adoption = page.locator('[data-action="family:adopt"]');
  if (!(await adoption.isVisible()))
    await page.locator("details").filter({ has: adoption }).locator("summary").first().click();
  await page.locator('[data-action="family:adopt"]').click();
  await page.waitForFunction(() =>
    window.boardworldInspect?.()?.expansion.events.some((e) => e.type === "family-adoption"),
  );
  const peer = await context.newPage();
  const resumed = expansionRequests(peer);
  await peer.goto(page.url());
  await peer.waitForFunction(
    () => window.boardworldInspect?.()?.expansion.world.region === "istanbul",
  );
  assert.ok(resumed.has("expansion.mjs") && resumed.has("expansion-ui.mjs"));
  if (await page.locator(".primary-nav").count()) await openBoardworldTab(page, "expansion-world");
  if (await peer.locator(".primary-nav").count()) await openBoardworldTab(peer, "expansion-world");
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
  await rejectFile(page);
  const size = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  assert.ok(size[0] <= size[1] + 1, size.join("/"));
  assert.deepEqual(errors, []);
  await verifyUnavailableRuntime(browser, page.url(), await savedSlots(page), state);
  await verifySlowRuntime(context, page);
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
