/** Real DOM acceptance for Living City; all simulation writes use player controls. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { checkedUrl } from "./browser-guard.mjs";
const args = process.argv.slice(2);
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const output = resolve(process.env.RUNNER_TEMP || "../qa-living", "screenshots/boardworld-living");
mkdirSync(output, { recursive: true });
const assets = [
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
  "calendar.mjs",
  "city.mjs",
  "world-content.mjs",
  "world-life.mjs",
  "living-ui.mjs",
  "living.css",
  "emergent-life.mjs",
  "emergent-content.mjs",
  "life-systems.mjs",
  "life-content.mjs",
  "emergent-ui.mjs",
  "emergent.css",
  "daily-flow.mjs",
  "society-content.mjs",
  "society-systems.mjs",
  "society-ui.mjs",
  "society.css",
  "i18n.mjs",
  "locale-keys.mjs",
  "locale-en.mjs",
  "locale-pl.mjs",
];
let browser,
  server,
  origin = arg("--base-url", "http://127.0.0.1:8080");
const results = [],
  timings = [],
  errors = [];
let currentPage;
const gamePath = "/games/tc-sim-boardworld/";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
try {
  if (arg("--serve", null)) {
    server = createStaticGameServer(arg("--serve"));
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  checkedUrl(origin);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const assetReport = [];
  for (const name of assets) {
    const response = await fetch(origin + gamePath + name);
    assert.equal(response.status, 200, `${name} delivered`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const expectedRoot = arg("--expected-root", arg("--serve", null));
    if (expectedRoot)
      assert.equal(
        digest(bytes),
        digest(readFileSync(resolve(expectedRoot, "games/tc-sim-boardworld", name))),
        `${name} exact tested bytes`,
      );
    assetReport.push({ name, bytes: bytes.length, sha256: digest(bytes) });
  }
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      reducedMotion: width === 320 ? "reduce" : "no-preference",
    });
    await context.addInitScript(() => {
      window.boardworldQaTimings = [];
      const starts = new WeakMap();
      document.addEventListener(
        "click",
        (event) => {
          if (
            event.target.closest(
              "[data-action], [data-preview-commit], [data-testid=propose-appointment]",
            )
          )
            starts.set(event, performance.now());
        },
        true,
      );
      window.addEventListener("click", (event) => {
        if (starts.has(event))
          window.boardworldQaTimings.push(performance.now() - starts.get(event));
      });
    });
    const page = (currentPage = await context.newPage());
    page.on("pageerror", (error) => errors.push(`${width}: ${error.message}`));
    page.on("response", (response) => {
      if (response.url().startsWith(origin + gamePath) && response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(
      origin + (args.includes("--portal") ? "/oyna/tc-sim-boardworld" : gamePath + "index.html"),
      { waitUntil: "networkidle" },
    );
    const surface = args.includes("--portal")
      ? await (await page.locator("iframe").elementHandle()).contentFrame()
      : page;
    await surface.locator("#create-form").waitFor();
    const firstPaint = await surface.evaluate(
      () => performance.getEntriesByName("first-contentful-paint")[0]?.startTime || null,
    );
    await surface.locator("[name=scenario][value=restart]").check();
    await surface.locator("#character-name").fill("Yaşayan Şehir");
    await surface.locator("[data-testid=create-game]").click();
    const inspect = () => surface.evaluate(() => window.boardworldInspect());
    const snapshot = () =>
      surface.evaluate(async () => {
        const engine = await import("/games/tc-sim-boardworld/engine.mjs"),
          state = window.boardworldInspect();
        return {
          state,
          actions: engine.getActions(state),
          city: engine.getCityView(state),
          living: engine.getLivingView(state),
          calendar: engine.getCalendarView(state),
        };
      });
    const tab = (name) => surface.locator(`.game-tabs [data-tab="${name}"]`).click();
    const layout = async (stage) => {
      const view = await surface.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        text: document.body.innerText,
      }));
      assert.ok(
        view.scroll <= view.width + 1,
        `${width}/${stage} horizontal overflow ${view.scroll}/${view.width}`,
      );
      assert.ok(
        !/\[object Object\]|\bundefined\b|\bNaN\b/.test(view.text),
        `${width}/${stage} unformatted data`,
      );
    };
    const choose = async (id) => {
      const x = await snapshot(),
        action = x.actions.find((a) => a.id === id);
      assert.ok(action && !action.disabled, `${id}: ${action?.reason || "missing action"}`);
      const categories = {
        travel: "board",
        life: "life",
        work: "work",
        education: "study",
        social: "people",
        finance: "wallet",
        business: "enterprise",
        project: "projects",
        calendar: "plan",
        schedule: "plan",
        story: "stories",
      };
      if (action.category !== "event") await tab(categories[action.category] || "board");
      if (action.category === "travel") {
        const district = action.destination || action.id.split(":")[1].split("-")[0];
        if (await surface.locator(`[data-district="${district}"]`).count())
          await surface.locator(`[data-district="${district}"]`).first().click();
      }
      if (id.startsWith("project:start:")) {
        await surface.locator("#project-form [name=type]").selectOption(id.split(":")[2]);
        await surface.locator("#project-form [name=action]").selectOption(id);
      }
      if (action.category === "social") {
        const npc = x.living.npcs.find((n) => id.split(":").includes(n.id));
        if (npc) await surface.locator(`.contact[data-npc="${npc.id}"]`).click();
      }
      const match = /calendar:(?:accept|decline|cancel|attend):(.+)/.exec(id);
      if (match) {
        const entry = x.state.calendar.entries.find((e) => e.id === match[1]);
        const day = Math.floor(entry.start / 1440) + 1;
        // Day controls are a rolling week; select the correct week before its day.
        while (!(await surface.locator(`[data-calendar-day="${day}"]`).count()))
          await surface.locator('[data-calendar-week="1"]').click();
        await surface.locator(`[data-calendar-day="${day}"]`).first().click();
      }
      const button = surface.locator(`[data-action="${id}"]`).first();
      assert.equal(await button.count(), 1, `${id} exposed in matching panel`);
      await button.click();
      const next = await inspect();
      assert.ok(next.revision > x.state.revision, `${id} committed through UI`);
      return next;
    };
    const drain = async () => {
      for (let i = 0; i < 60; i++) {
        const x = await snapshot(),
          cards = x.actions.filter((a) => a.category === "event" && !a.disabled);
        if (!x.state.pendingEvents.length) return;
        assert.ok(cards.length);
        await choose((cards.find((a) => !a.cost) || cards[0]).id);
      }
      throw new Error("Event queue did not drain");
    };
    const fillPlan = async (payload) => {
      await tab("plan");
      for (const key of [
        "kind",
        "npcId",
        "subjectId",
        "day",
        "venue",
        "duration",
        "minute",
        "repeat",
      ]) {
        if (payload[key] === undefined) continue;
        const field = surface.locator(`#appointment-form [name="${key}"]`);
        if (await field.count()) await field.selectOption(String(payload[key]));
      }
    };
    const propose = async (payload, forecast = false) => {
      await fillPlan(payload);
      const before = await inspect();
      if (forecast) {
        await surface.locator("[data-calendar-preview]").click();
        assert.deepEqual(await inspect(), before, "calendar forecast is read-only");
        assert.ok(await surface.locator("[data-preview-commit]").isEnabled());
        await surface.locator("[data-preview-commit]").click();
      } else await surface.locator("[data-testid=propose-appointment]").click();
      const after = await inspect();
      assert.ok(
        after.revision > before.revision,
        `calendar proposal commits: ${await surface
          .locator("#notice")
          .textContent()
          .catch(() => "")}`,
      );
      return after.calendar.entries.at(-1);
    };
    await drain();
    assert.equal((await inspect()).version, 5);
    await tab("board");
    assert.equal(await surface.locator(".city-node").count(), 3);
    assert.equal(await surface.locator(".neighborhood-select").count(), 3);
    assert.ok((await surface.locator(".venue-card").count()) >= 4);
    await layout("connected map");
    await surface.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/map-${width}.png`, fullPage: true });
    const beforeRoute = await inspect();
    const forecast = await surface.evaluate(async () => {
      const e = await import("/games/tc-sim-boardworld/engine.mjs");
      return e.previewAction(window.boardworldInspect(), "travel:besiktas");
    });
    await choose("travel:besiktas");
    assert.equal((await inspect()).time - beforeRoute.time, forecast.minutes);
    assert.equal((await inspect()).cash - beforeRoute.cash, forecast.cash);
    await drain();
    await choose("visit:besiktas-park");
    assert.equal((await inspect()).city.venue, "besiktas-park");
    for (const name of [
      "board",
      "plan",
      "projects",
      "enterprise",
      "work",
      "life",
      "people",
      "study",
      "wallet",
      "bag",
      "stories",
      "goals",
      "log",
    ]) {
      await tab(name);
      await layout(name);
    }
    await tab("board");
    await surface.locator(".secondary[data-intent-open]").click();
    await surface.locator("#intent-form [name=query]").fill("olmayaneylem123");
    await surface.locator("#intent-form button[type=submit]").click();
    assert.ok(
      (await surface.locator(".intent-results [data-action]:enabled").count()) > 0,
      "unsupported intent has executable alternatives",
    );
    await surface.locator("#intent-form [name=query]").fill("bekle");
    await surface.locator("#intent-form button[type=submit]").click();
    const intentButton = surface.locator('.intent-results [data-action="wait:15"]');
    assert.equal(await intentButton.count(), 1);
    const beforeIntent = await inspect();
    await intentButton.click();
    assert.equal((await inspect()).time, beforeIntent.time + 15);
    await drain();
    const day = Math.floor((await inspect()).time / 1440) + 1;
    let entry = await propose(
      {
        kind: "personal",
        subjectId: "rest",
        day: day + 1,
        venue: "besiktas-park",
        duration: 60,
        minute: 600,
        repeat: "none",
      },
      true,
    );
    assert.equal(entry.status, "confirmed");
    await tab("plan");
    await surface.locator(`[data-calendar-edit="${entry.id}"]`).click();
    await surface.locator("#appointment-form [name=minute]").selectOption("630");
    await surface.locator("[data-testid=propose-appointment]").click();
    assert.equal(
      (await inspect()).calendar.entries.find((e) => e.id === entry.id).status,
      "cancelled",
    );
    entry = (await inspect()).calendar.entries.at(-1);
    assert.equal(entry.start, day * 1440 + 630);
    await fillPlan({
      kind: "personal",
      subjectId: "practice",
      day: day + 1,
      venue: "besiktas-park",
      duration: 60,
      minute: 630,
      repeat: "none",
    });
    const beforeConflict = await inspect();
    await surface.locator("[data-testid=propose-appointment]").click();
    assert.deepEqual(await inspect(), beforeConflict, "conflicting plan rejected without mutation");
    await choose(`calendar:cancel:${entry.id}`);
    assert.equal(
      (await inspect()).calendar.entries.find((e) => e.id === entry.id).status,
      "cancelled",
    );
    const now = (await inspect()).time,
      minute = Math.ceil(((now % 1440) + 60) / 30) * 30;
    const attended = await propose({
      kind: "personal",
      subjectId: "rest",
      day,
      venue: "besiktas-park",
      duration: 60,
      minute,
      repeat: "none",
    });
    // Finite wait commands permit deliberately late/no-show play; safe-forward is separately tested.
    while ((await inspect()).time < attended.start - 30) {
      await choose("wait:15");
      await drain();
    }
    const needsBefore = (await inspect()).player.energy;
    await choose(`calendar:attend:${attended.id}`);
    assert.equal(
      (await inspect()).calendar.entries.find((e) => e.id === attended.id).status,
      "completed",
    );
    assert.ok((await inspect()).player.energy > needsBefore, "personal plan changes shared needs");
    const recurring = await propose({
      kind: "personal",
      subjectId: "practice",
      day: day + 2,
      venue: "besiktas-park",
      duration: 30,
      minute: 600,
      repeat: "weekly",
    });
    assert.ok(recurring.recurrenceId);
    await choose(`calendar:repeat-stop:${recurring.recurrenceId}`);
    assert.equal(
      Boolean(
        (await inspect()).calendar.recurrences.find((r) => r.id === recurring.recurrenceId)
          ?.enabled,
      ),
      false,
    );
    assert.equal(
      (await inspect()).calendar.entries.find((e) => e.id === recurring.id).status,
      "confirmed",
      "stopping repeat preserves current commitment",
    );
    await choose(`calendar:cancel:${recurring.id}`);
    await tab("plan");
    await surface.locator('[data-calendar-mode="week"]').click();
    await layout("week calendar");
    await surface.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/calendar-${width}.png`, fullPage: true });
    const projectAction = (await snapshot()).actions.find(
      (a) => a.category === "project" && !a.disabled && a.id.includes(":start:"),
    );
    assert.ok(projectAction, "at least one feasible real project");
    await choose(projectAction.id);
    assert.ok((await snapshot()).living.projects.some((p) => p.status === "active"));
    const startedProject = (await inspect()).living.projects.at(-1);
    const budgetAction = (await snapshot()).actions.find(
      (a) => a.id.startsWith(`project:budget:${startedProject.id}:`) && !a.disabled,
    );
    await choose(budgetAction.id);
    assert.equal(
      (await inspect()).living.projects.at(-1).budget,
      Number(budgetAction.id.split(":").at(-1)),
    );
    if (startedProject.type === "qualification") {
      await choose(`practice:${startedProject.target}`);
      assert.ok(
        (await snapshot()).living.projects.find((p) => p.id === startedProject.id).progress > 0,
        "project advances from real education action",
      );
    }
    await tab("projects");
    await layout("active project");
    await surface.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/projects-${width}.png`, fullPage: true });
    if (width === 390) {
      await drain();
      // The API selects a supported busy NPC slot; the actual form creates and accepts its counterproposal.
      const proposal = await surface.evaluate(async () => {
        const e = await import("/games/tc-sim-boardworld/engine.mjs"),
          s = window.boardworldInspect();
        const base = {
          kind: "meeting",
          npcId: "leyla",
          subjectId: "",
          day: Math.floor(s.time / 1440) + 2,
          venue: "besiktas-cafe",
          duration: 60,
          repeat: "none",
        };
        const slot = e
          .getAppointmentOptions(s, base)
          .slots.find((t) => t.available && t.counterExpected && !t.rejectionExpected);
        return slot ? { ...base, minute: slot.minute } : null;
      });
      assert.ok(proposal, "busy NPC offers a deterministic counterproposal");
      const counter = await propose(proposal);
      assert.equal(counter.status, "counter");
      await choose(`calendar:accept:${counter.id}`);
      assert.equal(
        (await inspect()).calendar.entries.find((e) => e.id === counter.id).status,
        "confirmed",
      );
      await choose(`calendar:cancel:${counter.id}`);
      // Arrive late to a distinct personal commitment using the same public attendance resolver.
      const lateNow = (await inspect()).time;
      const late = await propose({
        kind: "personal",
        subjectId: "community",
        day: Math.floor(lateNow / 1440) + 1,
        venue: "besiktas-park",
        duration: 60,
        minute: Math.ceil(((lateNow % 1440) + 60) / 30) * 30,
        repeat: "none",
      });
      while ((await inspect()).time <= late.start) {
        await choose("wait:15");
        await drain();
      }
      await choose(`calendar:attend:${late.id}`);
      const arrived = (await inspect()).calendar.entries.find((e) => e.id === late.id);
      assert.equal(arrived.status, "completed");
      assert.ok(arrived.lateBy > 0, "late arrival recorded through actual UI");
      const missedNow = (await inspect()).time;
      const missed = await propose({
        kind: "personal",
        subjectId: "practice",
        day: Math.floor(missedNow / 1440) + 1,
        venue: "besiktas-park",
        duration: 30,
        minute: Math.ceil(((missedNow % 1440) + 60) / 30) * 30,
        repeat: "none",
      });
      while ((await inspect()).time <= missed.start + 30) {
        await choose("wait:15");
        await drain();
      }
      assert.equal(
        (await inspect()).calendar.entries.find((e) => e.id === missed.id).status,
        "missed",
        "no-show processed by shared time engine",
      );
      const interviewDay = Math.floor((await inspect()).time / 1440) + 2;
      const interview = await propose(
        {
          kind: "interview",
          subjectId: "retail",
          day: interviewDay,
          venue: "kadikoy-work",
          minute: 600,
          repeat: "none",
        },
        true,
      );
      assert.equal(interview.end - interview.start, 30, "interview uses fixed real duration");
      await choose(`calendar:cancel:${interview.id}`);
      // A safe skip must stop for live cards instead of auto-selecting or skipping their cost.
      await tab("plan");
      const beforeSkip = await inspect();
      const skip = (await snapshot()).actions.find((a) => a.id === "calendar:next");
      if (skip && !skip.disabled) {
        await surface.locator('[data-action="calendar:next"]').first().click();
        const afterSkip = await inspect();
        assert.ok(afterSkip.time - beforeSkip.time <= 1440, "safe skip is bounded to one day");
        if (
          beforeSkip.pendingEvents.length ||
          Object.values(beforeSkip.stories).some((s) => s.status === "active")
        )
          assert.deepEqual(afterSkip, beforeSkip, "unresolved decisions stop skip");
      }
    }
    await drain();
    await surface.locator('[data-ui="save"]').first().click();
    const saved = await inspect();
    const samples = (await surface.evaluate(() => window.boardworldQaTimings)).sort(
      (a, b) => a - b,
    );
    await page.reload({ waitUntil: "networkidle" });
    const reloaded = args.includes("--portal")
      ? await (await page.locator("iframe").elementHandle()).contentFrame()
      : page;
    assert.deepEqual(
      await reloaded.evaluate(() => window.boardworldInspect()),
      saved,
      "save/reload preserves projects and calendar",
    );
    if (width === 320)
      assert.equal(
        await reloaded.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
        true,
      );
    timings.push({
      width,
      firstContentfulPaintMs: firstPaint,
      sampleCount: samples.length,
      handlerP50Ms: samples[Math.floor(samples.length * 0.5)] || null,
      handlerP95Ms: samples[Math.floor(samples.length * 0.95)] || null,
    });
    results.push({
      width,
      connectedRoutes: true,
      venues: true,
      finiteIntent: true,
      calendarPreview: true,
      reschedule: true,
      conflict: true,
      attendance: true,
      repeat: true,
      projects: true,
      saveReload: true,
      counterproposalAndNoShow: width === 390,
      lateAttendanceAndFixedInterview: width === 390,
    });
    await context.close();
  }
  // Import actual immutable 2.0 bytes through the same file input a player uses.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = (currentPage = await context.newPage());
  await page.goto(origin + gamePath + "index.html", { waitUntil: "networkidle" });
  const fixture = resolve("scripts/fixtures/boardworld/v2-progressed-restart-day46.json"),
    oldBytes = readFileSync(fixture, "utf8");
  await page.locator("#import-file").setInputFiles(fixture);
  await page.waitForFunction(() => window.boardworldInspect()?.version === 5);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("tariklab.boardworld.v2.original-v2")),
    oldBytes,
  );
  const inspect = () => page.evaluate(() => window.boardworldInspect());
  for (let i = 0; i < 60; i++) {
    const event = await page.evaluate(async () => {
      const e = await import("/games/tc-sim-boardworld/engine.mjs");
      return e
        .getActions(window.boardworldInspect())
        .find((a) => a.category === "event" && !a.disabled && !a.cost);
    });
    if (!event) break;
    await page.locator(`[data-action="${event.id}"]`).first().click();
  }
  await page.locator('.game-tabs [data-tab="wallet"]').click();
  await page.locator('[data-action="finance:reserve:500"]').click();
  const upgraded = await inspect();
  const canonical = await page.evaluate(() => ({
    primary: localStorage.getItem("tariklab.boardworld.v5"),
    backup: localStorage.getItem("tariklab.boardworld.v5.backup"),
  }));
  assert.ok(canonical.primary && canonical.backup);
  await page.evaluate(() => {
    window.legacyWrites = 0;
    addEventListener("storage", (e) => {
      if (e.key === "tariklab.boardworld.v2") window.legacyWrites++;
    });
  });
  const writer = await context.newPage();
  await writer.goto(origin + gamePath + "index.html", { waitUntil: "networkidle" });
  for (const [index, bytes] of [
    readFileSync(resolve("scripts/fixtures/boardworld/v2-fresh-restart.json"), "utf8"),
    oldBytes,
  ].entries()) {
    await writer.evaluate((value) => {
      const previous = localStorage.getItem("tariklab.boardworld.v2");
      localStorage.setItem("tariklab.boardworld.v2.backup", previous || value);
      localStorage.setItem("tariklab.boardworld.v2", value);
    }, bytes);
    await page.waitForFunction((count) => window.legacyWrites >= count, index + 1);
    assert.deepEqual(
      await inspect(),
      upgraded,
      "stale open 2.0 tab cannot erase live 5.0 progress",
    );
    assert.deepEqual(
      await page.evaluate(() => ({
        primary: localStorage.getItem("tariklab.boardworld.v5"),
        backup: localStorage.getItem("tariklab.boardworld.v5.backup"),
      })),
      canonical,
    );
  }
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual(await inspect(), upgraded, "reload prefers canonical 5.0 after stale writer");
  await page.locator('.game-tabs [data-tab="wallet"]').click();
  await page.locator('[data-action="finance:reserve:500"]').click();
  const synced = await inspect();
  await writer.waitForFunction(
    (revision) => window.boardworldInspect()?.revision === revision,
    synced.revision,
  );
  assert.deepEqual(
    await writer.evaluate(() => window.boardworldInspect()),
    synced,
    "current 5.0 cross-tab sync remains active",
  );
  await page.screenshot({ path: `${output}/v2-migration.png`, fullPage: true });
  results.push({
    v2ImportDay: Math.floor(upgraded.time / 1440) + 1,
    immutableV2Bytes: true,
    staleV2StorageEvents: 2,
    canonicalAndBackupUnchanged: true,
    reload: true,
    currentCrossTab: true,
  });
  await context.close();
  assert.deepEqual(errors, [], "no browser or asset errors");
  writeFileSync(
    `${output}/result.json`,
    JSON.stringify(
      {
        ok: true,
        origin,
        results,
        errors,
        performance: {
          uncompressedBytes: assetReport.reduce((total, a) => total + a.bytes, 0),
          assets: assetReport,
          timings,
          caveat:
            "Local or explicitly supplied origin; click-handler timing excludes paint and network.",
        },
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ ok: true, results, output }, null, 2));
} catch (error) {
  if (currentPage && !currentPage.isClosed())
    await currentPage.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  writeFileSync(
    `${output}/failure.json`,
    JSON.stringify({ message: error.message, stack: error.stack, errors, results }, null, 2),
  );
  throw error;
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
}
