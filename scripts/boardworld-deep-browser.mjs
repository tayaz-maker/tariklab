/** Actual DOM acceptance for the 2.0 life systems; simulation writes only through UI. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { checkedUrl } from "./browser-guard.mjs";
const args = process.argv.slice(2),
  arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const serving = arg("--serve", null),
  portal = args.includes("--portal");
const output = resolve(process.env.RUNNER_TEMP || "../qa-deep", "screenshots/boardworld-deep");
mkdirSync(output, { recursive: true });
let server,
  browser,
  origin = arg("--base-url", "http://127.0.0.1:8080");
const results = [];
const assetFiles = [
  "index.html",
  "app.mjs",
  "style.css",
  "favicon.svg",
  "engine.mjs",
  "content.mjs",
  "persistence.mjs",
  "deep-content.mjs",
  "deep-life.mjs",
  "deep-ui.mjs",
  "deep.css",
  "life-chains.mjs",
];
const performanceReport = {
  environment:
    "Headless Chromium; local source or requested origin. Click-handler duration includes simulation, rendering and synchronous save, excludes browser paint/network latency.",
  uncompressedBytes: 0,
  assets: [],
  viewports: [],
};
try {
  if (serving) {
    server = createStaticGameServer(serving);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  checkedUrl(origin);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      reducedMotion: width === 320 ? "reduce" : "no-preference",
    });
    await context.addInitScript(() => {
      window.boardworldQaTimings = [];
      const clickStarts = new WeakMap();
      document.addEventListener(
        "click",
        (event) => {
          if (event.target.closest("[data-action], [data-preview-commit]"))
            clickStarts.set(event, performance.now());
        },
        true,
      );
      window.addEventListener("click", (event) => {
        const start = clickStarts.get(event);
        if (start !== undefined) window.boardworldQaTimings.push(performance.now() - start);
      });
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().startsWith(origin + "/games/tc-sim-boardworld/") && r.status() >= 400)
        errors.push(`HTTP ${r.status()} ${r.url()}`);
    });
    const url =
      origin + (portal ? "/oyna/tc-sim-boardworld" : "/games/tc-sim-boardworld/index.html");
    await page.goto(url, { waitUntil: "networkidle" });
    let surface = portal
      ? await (await page.locator("iframe").elementHandle()).contentFrame()
      : page;
    await surface.locator("#create-form").waitFor();
    const initialRender = await surface.evaluate(() => ({
      domContentLoadedMs: performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd,
      firstContentfulPaintMs:
        performance.getEntriesByName("first-contentful-paint")[0]?.startTime || null,
    }));
    await surface.locator("[name=scenario][value=restart]").check();
    await surface.locator("#character-name").fill("Derin Hayat");
    await surface.locator("[data-testid=create-game]").click();
    const inspect = () => surface.evaluate(() => window.boardworldInspect());
    const snapshot = () =>
      surface.evaluate(async () => {
        const { getActions, getDeepView, getClock } =
          await import("/games/tc-sim-boardworld/engine.mjs");
        const { getStoryView } = await import("/games/tc-sim-boardworld/life-chains.mjs");
        const state = window.boardworldInspect();
        return {
          state,
          actions: getActions(state),
          deep: getDeepView(state),
          stories: getStoryView(state),
          clock: getClock(state),
        };
      });
    const panel = async (tab) => {
      await surface.locator(`.game-tabs [data-tab="${tab}"]`).click();
    };
    const layout = async (stage) => {
      const r = await surface.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        text: document.body.innerText,
      }));
      assert.ok(r.scroll <= r.width + 1, `${width}/${stage} document overflow`);
      assert.ok(r.text.length > 100, `${stage} empty`);
      assert.ok(!/\[object Object\]|\bundefined\b|\bNaN\b/.test(r.text), `${stage} raw data leak`);
    };
    const choose = async (action) => {
      const tabs = {
        travel: "board",
        life: "life",
        work: "work",
        education: "study",
        social: "people",
        finance: "wallet",
        schedule: "plan",
        business: "enterprise",
        story: "stories",
      };
      if (action.category !== "event") await panel(tabs[action.category] || "board");
      if (action.category === "travel")
        await surface.locator(`[data-district="${action.id.split(":")[1]}"]`).click();
      if (action.category === "social") {
        const info = await snapshot();
        const id = info.deep.npcs.find((n) => action.id.split(":").includes(n.id))?.id;
        const promise = info.deep.promises.find((p) => action.id.endsWith(`:${p.id}`));
        const selectedId = id || promise?.npcId;
        if (selectedId) await surface.locator(`.contact[data-npc="${selectedId}"]`).click();
      }
      const button = surface.locator(`[data-action="${action.id}"]`).first();
      assert.equal(await button.count(), 1, `${action.id} reachable from UI`);
      assert.equal(await button.isEnabled(), true, `${action.id} available in UI`);
      const before = await inspect();
      await button.click();
      const after = await inspect();
      assert.ok(after.revision > before.revision, `${action.id} commits`);
      return after;
    };
    const drain = async () => {
      for (let i = 0; i < 50; i++) {
        const x = await snapshot();
        if (!x.state.pendingEvents.length) return;
        const available = x.actions.filter((a) => !a.disabled && a.category === "event");
        assert.ok(available.length);
        await choose(available.find((a) => a.cost === 0) || available[0]);
      }
      throw new Error("Event queue did not drain");
    };
    await drain();
    assert.equal((await inspect()).version, 2);
    assert.ok((await inspect()).deep);
    await panel("board");
    assert.equal(await surface.locator(".neighborhood-art").count(), 3);
    assert.equal(await surface.locator(".neighborhood-select").count(), 3);
    await layout("2.5D board");
    await surface.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/board-${width}.png`, fullPage: true });
    const initial = await snapshot(),
      application = initial.actions.find((a) => a.id === "apply:retail" && !a.disabled);
    assert.ok(application);
    await panel("work");
    await surface.locator('[data-preview="apply:retail"]').click();
    await surface.locator("dialog[open]").waitFor();
    assert.deepEqual(await inspect(), initial.state, "opening preview does not mutate simulation");
    assert.match(await surface.locator("dialog").innerText(), /HAMLEDEN ÖNCE/);
    await surface.locator('[data-preview-commit="apply:retail"]').click();
    assert.equal((await inspect()).job.id, "retail");
    assert.equal(await surface.locator("dialog[open]").count(), 0, "confirmed preview closes");
    await drain();
    await panel("work");
    const blockedPreview = (await snapshot()).actions.find(
      (a) => a.category === "work" && a.disabled,
    );
    if (blockedPreview) {
      await surface.locator(`[data-preview="${blockedPreview.id}"]`).click();
      assert.ok(
        !(await surface.locator("dialog").innerText()).includes("undefined"),
        "disabled action forecast has a readable reason",
      );
      assert.equal(await surface.locator("[data-preview-commit]").isDisabled(), true);
      await surface.locator(".dialog-close").click();
    }
    for (const tab of [
      "plan",
      "enterprise",
      "people",
      "study",
      "wallet",
      "bag",
      "stories",
      "goals",
      "log",
    ]) {
      await panel(tab);
      await layout(tab);
    }
    await panel("people");
    await surface.locator('[data-network-npc="mert"]').focus();
    await surface.locator('[data-network-npc="mert"]').press("Enter");
    assert.match(await surface.locator(".profile-head").innerText(), /Mert/);
    assert.equal(await surface.locator("[data-deep=npc-profile]").count(), 1);
    const beforeNav = await inspect();
    await surface.locator(".knowledge-file summary").first().click();
    assert.deepEqual(await inspect(), beforeNav, "profile inspection has no time cost");
    await panel("plan");
    const options = (await snapshot()).actions;
    const toggle = options.find(
      (a) => a.category === "schedule" && !a.disabled && !a.id.includes(":run:"),
    );
    assert.ok(toggle, "routine settings exposed");
    await choose(toggle);
    assert.ok((await snapshot()).deep.schedule);
    // Return the setting to its original value if the same command is still legal.
    const untoggle = (await snapshot()).actions.find((a) => a.id === toggle.id && !a.disabled);
    if (untoggle) await choose(untoggle);
    const beforeRoutine = await inspect();
    const routine = (await snapshot()).actions.find(
      (a) => a.id === "schedule:run:1" && !a.disabled,
    );
    assert.ok(routine);
    await choose(routine);
    const afterRoutine = await inspect();
    assert.ok(afterRoutine.deep.routine.lastRun > 0, "routine actually executed");
    assert.ok(afterRoutine.time >= beforeRoutine.time);
    assert.ok(afterRoutine.deep.routine.stopReason.length > 0, "routine explains stop condition");
    await drain();
    if (width === 390) {
      // Follow a legitimate working life until a real authored chain opens, then preserve its delayed state.
      for (let turn = 0; turn < 140; turn++) {
        await drain();
        const x = await snapshot();
        if (x.stories.some((s) => s.status === "active")) break;
        const available = x.actions.filter((a) => !a.disabled),
          pick = (id) => available.find((a) => a.id === id);
        let action;
        if (x.state.cash < 400 && x.state.bank >= 1000) action = pick("withdraw:1000");
        if (!action && x.state.player.hunger < 48)
          action = pick("cook") || pick("soup") || pick("eat") || pick("snack");
        if (!action) action = pick("work");
        if (!action && x.clock.minute >= 1080) action = pick("sleep");
        if (!action && (x.state.player.stress > 45 || x.state.player.energy < 50))
          action = pick("rest");
        if (!action) action = pick("practice:communication") || pick("exercise") || pick("wait:60");
        assert.ok(action);
        await choose(action);
      }
      const storyState = await snapshot(),
        story = storyState.stories.find((s) => s.status === "active");
      assert.ok(story, "a real chain unlocked through elapsed actions");
      const choices = storyState.actions.filter(
        (a) => a.category === "story" && a.id.startsWith(`story:${story.id}:`) && !a.disabled,
      );
      assert.ok(choices.length);
      await choose(choices.find((a) => a.cost === 0) || choices[0]);
      const advanced = (await snapshot()).stories.find((s) => s.id === story.id);
      assert.ok(
        advanced.history.length > story.history.length,
        "choice recorded in authored chain",
      );
      assert.equal(advanced.status, "waiting", "next phase is delayed");
      assert.ok(advanced.dueDay > (await snapshot()).clock.day);
      await panel("plan");
      assert.ok(
        (await surface.locator(".timeline-days").innerText()).includes(story.title),
        "waiting chain is shown in calendar",
      );
      await surface.locator(".timeline-link").filter({ hasText: story.title }).click();
      await layout("story delayed state");
      await surface.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${output}/story-${width}.png`, fullPage: true });
    }
    if (width === 390) {
      const act = async (id) => {
        await drain();
        const a = (await snapshot()).actions.find((x) => x.id === id && !x.disabled);
        assert.ok(
          a,
          `real business action ${id} available: ${JSON.stringify((await snapshot()).actions.find((x) => x.id === id))}`,
        );
        await choose(a);
      };
      if ((await inspect()).location !== "kadikoy") await act("travel:kadikoy");
      const shopBefore = await snapshot();
      if (shopBefore.clock.minute < 540 || shopBefore.clock.minute > 1200) {
        await act("sleep");
        await act("wait:60");
      }
      if (!(await inspect()).inventory.tools) await act("buy:tools");
      while ((await inspect()).cash < 4300) await act("withdraw:1000");
      await act("business:start:repair");
      assert.ok((await inspect()).deep.business);
      await act("business:acquire");
      const beforeService = await inspect();
      await act("business:serve");
      const afterService = await inspect();
      assert.ok(afterService.deep.business.revenue > 0, "actual customer payment earned");
      assert.ok(
        afterService.deep.business.costs > beforeService.deep.business.costs,
        "actual material expense recorded",
      );
      assert.ok(afterService.bank > beforeService.bank, "business receipt reaches shared bank");
      await panel("enterprise");
      await layout("operating business");
      await surface.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `${output}/business-${width}.png`, fullPage: true });
    }
    await panel("plan");
    await surface.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/schedule-${width}.png`, fullPage: true });
    const preReloadTimings = await surface.evaluate(() => window.boardworldQaTimings);
    const beforeReload = await inspect();
    await surface.locator("[data-ui=save]").first().click();
    assert.match(await surface.locator("#notice").innerText(), /kaydedildi/i);
    await page.reload({ waitUntil: "networkidle" });
    surface = portal ? await (await page.locator("iframe").elementHandle()).contentFrame() : page;
    try {
      await surface.locator(".game-tabs").waitFor();
    } catch (error) {
      writeFileSync(
        `${output}/reload-failure-${width}.json`,
        JSON.stringify(
          await surface.evaluate(() => ({
            text: document.body.innerText,
            save: localStorage.getItem("tariklab.boardworld.v1"),
            state: window.boardworldInspect?.(),
          })),
          null,
          2,
        ),
      );
      throw error;
    }
    assert.deepEqual(await inspect(), beforeReload, "v2 deep state roundtrip");
    const mirror = await context.newPage();
    await mirror.goto(origin + "/games/tc-sim-boardworld/index.html", { waitUntil: "networkidle" });
    await mirror.locator(".game-tabs").waitFor();
    await drain();
    await choose(
      (await snapshot()).actions.find((a) => a.id === "schedule:toggle:work" && !a.disabled),
    );
    const synced = await inspect();
    await mirror.waitForFunction(
      (revision) => window.boardworldInspect()?.revision === revision,
      synced.revision,
    );
    assert.deepEqual(
      await mirror.evaluate(() => window.boardworldInspect()),
      synced,
      "second tab receives full deep state",
    );
    await mirror.close();
    const timings = [
      ...preReloadTimings,
      ...(await surface.evaluate(() => window.boardworldQaTimings)),
    ];
    timings.sort((a, b) => a - b);
    performanceReport.viewports.push({
      width,
      ...initialRender,
      clickSamples: timings.length,
      actionP50Ms: timings[Math.floor(timings.length * 0.5)] || 0,
      actionP95Ms: timings[Math.min(timings.length - 1, Math.floor(timings.length * 0.95))] || 0,
    });
    if (width === 320)
      assert.equal(
        await surface.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
        true,
      );
    assert.deepEqual(errors, []);
    results.push({
      width,
      version: 2,
      preview: true,
      networkKeyboard: true,
      routineSettings: true,
      routineExecuted: true,
      actualBusiness: width === 390,
      crossTab: true,
      reducedMotion: width === 320,
      storyDelay: width === 390,
      saveReload: true,
      errors,
    });
    await context.close();
  }
  // Import an unchanged 1.0 release save through the real file chooser, then make a normal UI action.
  const oldContext = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    oldPage = await oldContext.newPage();
  await oldPage.goto(origin + "/games/tc-sim-boardworld/index.html", { waitUntil: "networkidle" });
  const fixture = resolve("scripts/fixtures/boardworld/v1-progressed-restart-day46.json"),
    bytes = readFileSync(fixture, "utf8");
  await oldPage.locator("#import-file").setInputFiles(fixture);
  await oldPage.waitForFunction(() => window.boardworldInspect()?.version === 2);
  assert.equal(
    await oldPage.evaluate(() => localStorage.getItem("tariklab.boardworld.v1.original-v1")),
    bytes,
    "original v1 bytes preserved through real import",
  );
  const migrated = await oldPage.evaluate(() => window.boardworldInspect());
  assert.ok(migrated.deep);
  assert.ok(migrated.time >= 45 * 1440);
  await oldPage.reload({ waitUntil: "networkidle" });
  assert.deepEqual(await oldPage.evaluate(() => window.boardworldInspect()), migrated);
  await oldPage.locator(".game-tabs [data-tab=people]").click();
  await oldPage.screenshot({ path: `${output}/migrated-v1.png`, fullPage: true });
  results.push({
    v1Import: true,
    immutableBackup: true,
    migratedDay: Math.floor(migrated.time / 1440) + 1,
  });
  await oldContext.close();
  const expected = arg("--expected-root", serving || "public");
  for (const file of assetFiles) {
    const local = readFileSync(resolve(expected, "games/tc-sim-boardworld", file));
    const response = await fetch(`${origin}/games/tc-sim-boardworld/${file}`);
    assert.equal(response.status, 200, file);
    const remote = Buffer.from(await response.arrayBuffer());
    const digest = (b) => createHash("sha256").update(b).digest("hex");
    assert.equal(digest(remote), digest(local), `${file} is exact expected candidate`);
    performanceReport.uncompressedBytes += local.length;
    performanceReport.assets.push({ file, bytes: local.length });
  }
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify({ ok: true, origin, results, performance: performanceReport }, null, 2),
  );
  console.log(JSON.stringify({ ok: true, origin, results, performance: performanceReport }));
} catch (error) {
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify({ ok: false, origin, error: String(error), results }, null, 2),
  );
  throw error;
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
}
