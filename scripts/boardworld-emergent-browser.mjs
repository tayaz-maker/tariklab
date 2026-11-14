/** Boardworld 4 DOM acceptance. Public diagnostics select actions; only real controls mutate play. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { generatedGameAssets } from "./boardworld-browser-assets.mjs";
import { checkedUrl } from "./browser-guard.mjs";
import { openBoardworldTab, boardworldDestinations } from "./boardworld-browser-navigation.mjs";
const args = process.argv.slice(2);
const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const output = resolve(
  process.env.RUNNER_TEMP || "../qa-emergent",
  "screenshots/boardworld-emergent",
);
mkdirSync(output, { recursive: true });
const assets = [
  "index.html",
  "app.mjs",
  "style.css",
  "favicon.svg",
  "engine.mjs",
  "content.mjs",
  "persistence.mjs",
  "save-codec.mjs",
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
  "emergent-content.mjs",
  "emergent-life.mjs",
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
  "life-content.mjs",
  "life-systems.mjs",
];
const gamePath = "/games/tc-sim-boardworld/";
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const categories = {
  work: "work",
  education: "study",
  finance: "wallet",
  life: "life",
  social: "people",
  travel: "board",
  schedule: "plan",
  policy: "plan",
  household: "life",
  project: "projects",
  business: "enterprise",
  story: "stories",
  systemic: "stories",
  calendar: "plan",
};
let server,
  browser,
  currentPage,
  origin = arg("--base-url", "http://127.0.0.1:8080");
const results = [],
  errors = [],
  assetReport = [],
  timings = [];
try {
  if (arg("--serve", null)) {
    server = createStaticGameServer(arg("--serve"));
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  checkedUrl(origin);
  for (const file of [
    ...assets,
    ...generatedGameAssets(arg("--expected-root", arg("--serve", "public"))),
  ]) {
    const response = await fetch(origin + gamePath + file);
    assert.equal(response.status, 200, `${file} delivered`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const expected = arg("--expected-root", arg("--serve", null));
    if (expected)
      assert.equal(
        digest(bytes),
        digest(readFileSync(resolve(expected, "games/tc-sim-boardworld", file))),
        `${file} exact tested bytes`,
      );
    assetReport.push({
      file,
      bytes: bytes.length,
      gzipBytes: gzipSync(bytes).length,
      sha256: digest(bytes),
    });
  }
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const attach = async (page, portal = args.includes("--portal")) => {
    await page.goto(origin + (portal ? "/oyna/tc-sim-boardworld" : gamePath + "index.html"), {
      waitUntil: "networkidle",
    });
    return portal ? (await page.locator("iframe").elementHandle()).contentFrame() : page;
  };
  const helpers = (surface) => {
    const inspect = () => surface.evaluate(() => window.boardworldInspect());
    const snap = () =>
      surface.evaluate(async () => {
        const e = await import("/games/tc-sim-boardworld/engine.mjs"),
          s = window.boardworldInspect();
        return {
          state: s,
          actions: e.getActions(s),
          emergent: e.getEmergentView(s),
          life: e.getLifeView(s),
        };
      });
    const tab = (id) => openBoardworldTab(surface, id);
    const choose = async (id) => {
      const x = await snap(),
        a = x.actions.find((a) => a.id === id);
      assert.ok(a && !a.disabled, `${id} is a legal current action: ${a?.reason || "missing"}`);
      if (a.category !== "event") await tab(categories[a.category] || "board");
      if (a.category === "travel")
        await surface
          .locator(`[data-district="${a.destination || id.split(":")[1].split("-")[0]}"]`)
          .first()
          .click();
      if (id.startsWith("household:invite:"))
        await surface.locator("[data-household-choice]").selectOption(id);
      if (a.category === "social") {
        const person =
          a.npcId ||
          [...x.life.secondary.map((n) => n.id), ...Object.keys(x.state.npcs)].find((n) =>
            id.split(":").includes(n),
          );
        if (person) await surface.locator(`.contact[data-npc="${person}"]`).first().click();
      }
      if (a.category === "policy" && !id.startsWith("policy:day:"))
        await surface.locator(`[data-policy-field="${id.split(":")[1]}"]`).selectOption(id);
      else await surface.locator(`[data-action="${id}"]`).first().click();
      const after = await inspect();
      assert.ok(after.revision > x.state.revision, `${id} committed through the visible UI`);
      return after;
    };
    const drain = async ({ systemic = true, stories = false } = {}) => {
      for (let i = 0; i < 70; i++) {
        const x = await snap();
        const choices = x.actions.filter(
          (a) =>
            !a.disabled &&
            (a.category === "event" ||
              (systemic && a.category === "systemic") ||
              (stories && a.category === "story")),
        );
        if (!choices.length) return;
        const a = choices.find((a) => !a.cost) || choices[0];
        await choose(a.id);
      }
      throw new Error("Decision queue did not drain");
    };
    const layout = async (stage) => {
      const size = await surface.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(
        size.scroll <= size.width + 1 && size.body <= size.width + 1,
        `${stage} no horizontal page overflow: ${JSON.stringify(size)}`,
      );
    };
    return { inspect, snap, tab, choose, drain, layout };
  };
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      reducedMotion: width === 320 ? "reduce" : "no-preference",
    });
    await context.addInitScript(() => {
      window.boardworldQaTimings = [];
      const starts = new WeakMap();
      for (const type of ["click", "change"]) {
        document.addEventListener(
          type,
          (e) => {
            if (e.target.closest("[data-action],[data-preview-commit],[data-policy-field]"))
              starts.set(e, performance.now());
          },
          true,
        );
        window.addEventListener(type, (e) => {
          if (starts.has(e)) window.boardworldQaTimings.push(performance.now() - starts.get(e));
        });
      }
    });
    const page = (currentPage = await context.newPage());
    page.on("pageerror", (e) => errors.push(`${width}: ${e.message}`));
    page.on("response", (r) => {
      if (r.url().startsWith(origin + gamePath) && r.status() >= 400)
        errors.push(`${r.status()} ${r.url()}`);
    });
    const surface = await attach(page),
      h = helpers(surface);
    await surface.locator("#create-form").waitFor();
    const firstPaint = await surface.evaluate(
      () => performance.getEntriesByName("first-contentful-paint")[0]?.startTime || null,
    );
    await surface.locator("[name=scenario][value=restart]").check();
    await surface.locator("#character-name").fill("Birbirine Bağlı Hayat");
    await surface.locator("[data-testid=create-game]").click();
    await h.drain();
    assert.equal((await h.inspect()).version, 6);
    await h.tab("board");
    if (await surface.locator('[data-ui="dismiss-outcome"]').count())
      await surface.locator('[data-ui="dismiss-outcome"]').click();
    assert.equal(await surface.locator(".city-node").count(), 3);
    assert.deepEqual(
      await boardworldDestinations(surface),
      [
        "dashboard", "life", "plan", "work", "study", "projects", "goals",
        "board", "expansion-world", "stories", "log", "people", "expansion",
        "wallet", "enterprise", "expansion-finance", "bag",
      ],
    );
    await h.layout("compact map");
    const contrast = await surface.evaluate(() => {
      const css = getComputedStyle(document.querySelector(".edition-four"));
      const color = (name) => css.getPropertyValue(name).trim();
      const lum = (hex) => {
        const a = hex
          .match(/[0-9a-f]{2}/gi)
          .map((v) => parseInt(v, 16) / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      };
      const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
      return Object.fromEntries(
        ["--ink", "--muted", "--coral", "--ochre", "--teal"].map((key) => [
          key,
          ratio(color(key), color("--paper")),
        ]),
      );
    });
    for (const [name, ratio] of Object.entries(contrast))
      assert.ok(ratio >= 4.5, `${name} text on paper contrast ${ratio}`);

    const board = await surface.evaluate(() => {
      const el = document.querySelector(".living-map"),
        r = el.getBoundingClientRect();
      return {
        mapDocumentY: r.top + scrollY,
        mapHeight: r.height,
        viewportHeight: innerHeight,
        locationVisible: !!document.querySelector(".rail-location")?.getBoundingClientRect().height,
      };
    });
    assert.ok(board.mapDocumentY < board.viewportHeight, "map starts in first viewport");
    assert.ok(board.locationVisible, "mobile and desktop location visible");
    const venueWidth = await surface.evaluate(() => ({
      available: document.querySelector(".local-venues").getBoundingClientRect().width,
      used: document.querySelector(".venue-grid").getBoundingClientRect().width,
    }));
    assert.ok(
      venueWidth.used >= venueWidth.available * 0.95,
      "venue grid uses its available width",
    );

    await surface.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/board-${width}.png`, fullPage: true });
    await surface.locator('[data-emergent="onboarding"] > summary').click();
    assert.equal(await surface.locator(".guide-step").count(), 4);
    await surface.locator('.guide-step[data-tab="work"]').click();
    assert.ok(await surface.locator(".career-context").count());
    await h.tab("board");
    const before = await h.inspect();
    const forecast = await surface.evaluate(async () => {
      const e = await import("/games/tc-sim-boardworld/engine.mjs");
      return e.previewAction(window.boardworldInspect(), "travel:besiktas");
    });
    await surface.locator('.route-go[data-action="travel:besiktas"]').click();
    assert.equal((await h.inspect()).location, "besiktas");
    assert.equal((await h.inspect()).time - before.time, forecast.minutes);
    assert.equal((await h.inspect()).cash - before.cash, forecast.cash);
    await h.drain();
    await h.tab("plan");
    assert.ok(await surface.locator('[data-emergent="policy"]').count());
    const beforeCalendarJump = await h.inspect();
    await surface.locator("[data-calendar-new]").click();
    assert.equal(
      await surface
        .locator("#appointment-form [name=kind]")
        .evaluate((el) => el === document.activeElement),
      true,
    );
    assert.deepEqual(
      await h.inspect(),
      beforeCalendarJump,
      "manual appointment shortcut consumes no game time",
    );
    await surface.locator("[data-calendar-browse]").click();
    await surface.locator('[data-calendar-mode="week"]').focus();
    await surface.locator('[data-calendar-mode="week"]').press("Enter");
    assert.equal(
      await surface.locator('[data-calendar-mode="week"]').getAttribute("aria-pressed"),
      "true",
    );
    await surface.locator('[data-calendar-mode="day"]').press("Enter");
    const policyPosition = await surface.evaluate(() => ({
      policy: document.querySelector(".policy-desk").getBoundingClientRect().top,
      form: document.querySelector("#appointment-form").getBoundingClientRect().top,
    }));
    assert.ok(
      policyPosition.policy < policyPosition.form,
      "routine policies precede detailed calendar form",
    );
    // Twenty real, reversible policy changes establish per-width handler samples without advancing time.
    for (let i = 0; i < 20; i++) {
      const x = await h.snap(),
        a = x.actions.find(
          (a) => a.category === "policy" && a.id.startsWith("policy:meal:") && !a.disabled,
        );
      assert.ok(a, "finite supported meal policy");
      await h.choose(a.id);
    }
    const priorDays = (await h.inspect()).emergent.policy.days;
    const dayAction = (await h.snap()).actions.find(
      (a) => a.id.startsWith("policy:day:") && !a.disabled,
    );
    await h.choose(dayAction.id);
    const dayIndex = Number(dayAction.id.split(":").at(-1));
    assert.equal((await h.inspect()).emergent.policy.days[dayIndex], !priorDays[dayIndex]);
    await surface.locator(`.policy-days [data-action="${dayAction.id}"]`).focus();
    await surface.locator(`.policy-days [data-action="${dayAction.id}"]`).press("Enter");
    assert.equal(
      (await h.inspect()).emergent.policy.days[dayIndex],
      priorDays[dayIndex],
      "day controls work with keyboard",
    );
    for (const panel of ["plan", "life", "people", "work", "stories", "study", "log"]) {
      await h.tab(panel);
      await h.layout(panel);
    }
    await h.tab("plan");
    await surface.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/policy-${width}.png`, fullPage: true });
    await h.tab("life");
    assert.ok(await surface.locator('[data-life="household"]').count());
    assert.ok(await surface.locator('[data-life="lease"]').count());
    await surface.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `${output}/household-${width}.png`, fullPage: true });
    const firstDetail = surface.locator(".need-details summary").first();
    if (await firstDetail.count()) {
      await firstDetail.click();
      assert.ok(await surface.locator(".need-details[open] p").count());
    }
    await surface.locator('[data-ui="menu"]').click();
    await surface.locator('[data-ui="character"]').click();
    assert.ok(
      (await surface.locator("#menu-dialog").textContent()).includes("Birbirine Bağlı Hayat"),
    );
    await surface.locator('[data-ui="close"]').first().click();
    const saved = await h.inspect();
    await surface.locator('[data-ui="save"]').first().click();
    const samples = (await surface.evaluate(() => window.boardworldQaTimings)).sort(
      (a, b) => a - b,
    );
    assert.ok(samples.length >= 20);
    await page.reload({ waitUntil: "networkidle" });
    const reloaded = args.includes("--portal")
      ? await (await page.locator("iframe").elementHandle()).contentFrame()
      : page;
    assert.deepEqual(
      await reloaded.evaluate(() => window.boardworldInspect()),
      saved,
      "v5 policy/save reload exact",
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
      handlerP50Ms: samples[Math.floor(samples.length * 0.5)],
      handlerP95Ms: samples[Math.floor(samples.length * 0.95)],
    });
    results.push({
      width,
      directTravel: true,
      policyChanges: 22,
      locationVisible: true,
      board,
      contrast,
      keyboardCalendar: true,
      calendarShortcut: true,
      saveReload: true,
      allExistingTabs: 13,
    });
    await context.close();
  }
  // Authentic 3.0 bytes enter through the file upload, then a stale old tab emits real storage events.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    page = (currentPage = await context.newPage());
  page.on("pageerror", (e) => errors.push(`migration: ${e.message}`));
  const surface = await attach(page, false),
    h = helpers(surface);
  const fixture = resolve("scripts/fixtures/boardworld/v3-social-day91.json"),
    bytes = readFileSync(fixture, "utf8");
  await surface.locator("#import-file").setInputFiles(fixture);
  await surface.waitForFunction(() => window.boardworldInspect()?.version === 6);
  assert.equal(
    await surface.evaluate(() => localStorage.getItem("tariklab.boardworld.v3.original-v3")),
    bytes,
    "immutable authentic v3 archived",
  );
  const imported = await h.inspect();
  assert.equal(Math.floor(imported.time / 1440) + 1, 91);
  await h.drain({ stories: true });
  await h.tab("plan");
  const edit = (await h.snap()).actions.find(
    (a) => a.category === "policy" && a.id.startsWith("policy:meal:") && !a.disabled,
  );
  await h.choose(edit.id);
  const upgraded = await h.inspect(),
    canonical = await surface.evaluate(() => ({
      primary: localStorage.getItem("tariklab.boardworld.v6"),
      backup: localStorage.getItem("tariklab.boardworld.v6.backup"),
    }));
  assert.ok(canonical.primary && canonical.backup);
  await surface.evaluate(() => {
    window.staleWrites = 0;
    addEventListener("storage", (e) => {
      if (e.key === "tariklab.boardworld.v3") window.staleWrites++;
    });
  });
  const writer = await context.newPage();
  await attach(writer, false);
  for (const [i, old] of [
    readFileSync(resolve("scripts/fixtures/boardworld/v3-fresh-restart.json"), "utf8"),
    bytes,
  ].entries()) {
    await writer.evaluate((value) => {
      const old = localStorage.getItem("tariklab.boardworld.v3");
      localStorage.setItem("tariklab.boardworld.v3.backup", old || value);
      localStorage.setItem("tariklab.boardworld.v3", value);
    }, old);
    await surface.waitForFunction((count) => window.staleWrites >= count, i + 1);
    assert.deepEqual(
      await h.inspect(),
      upgraded,
      "actual stale v3 storage event preserves v5 memory",
    );
    assert.deepEqual(
      await surface.evaluate(() => ({
        primary: localStorage.getItem("tariklab.boardworld.v6"),
        backup: localStorage.getItem("tariklab.boardworld.v6.backup"),
      })),
      canonical,
      "stale writer preserves canonical primary and backup",
    );
  }
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual(await h.inspect(), upgraded, "reload still prefers v5");
  const syncAction = (await h.snap()).actions.find(
    (a) => a.category === "policy" && a.id.startsWith("policy:meal:") && !a.disabled,
  );
  await h.choose(syncAction.id);
  const synced = await h.inspect();
  await writer.waitForFunction(
    (revision) => window.boardworldInspect()?.revision === revision,
    synced.revision,
  );
  assert.deepEqual(
    await writer.evaluate(() => window.boardworldInspect()),
    synced,
    "current v5 cross-tab remains synchronized",
  );
  await writer.close();
  // A genuine household invitation must respect the other person's existing calendar.
  await h.drain({ stories: true });
  let invitation;
  for (let i = 0; i < 45; i++) {
    const x = await h.snap();
    invitation = x.actions.find((a) => a.id.startsWith("household:invite:") && !a.disabled);
    if (invitation) break;
    await h.choose("wait:15");
    await h.drain({ stories: true });
  }
  assert.ok(invitation, "trusted neighbor has a genuinely free invitation window");
  const beforeInvite = await h.inspect();
  await h.choose(invitation.id);
  const shared = await h.inspect();
  assert.ok(shared.life.household?.deposit > 0, "roommate funded separate escrow");
  assert.equal(
    shared.cash + shared.bank,
    beforeInvite.cash + beforeInvite.bank,
    "roommate deposit is not player spending money",
  );
  await h.tab("life");
  assert.ok(
    (await surface.locator('[data-life="household"]').textContent()).includes("Emanet depozito"),
  );
  await h.layout("active household");
  await surface.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/active-household-390.png`, fullPage: true });
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual(
    await h.inspect(),
    shared,
    "active household, escrow and chores persist exactly",
  );
  await h.choose("household:leave");
  assert.equal((await h.inspect()).life.household, null, "explicit exit closes the real contract");
  assert.ok(
    !(await h.snap()).actions.some((a) => a.id === "household:leave"),
    "same escrow cannot be refunded twice",
  );
  // Repeated local visits promote a bounded resident through the same live city mechanism.
  for (let i = 0; i < 6 && !(await h.snap()).life.secondary.length; i++) {
    await h.drain({ stories: true });
    const x = await h.snap();
    const visit = x.actions.find(
      (a) => a.id.startsWith(`visit:${x.state.location}-`) && !a.disabled,
    );
    assert.ok(visit, "a real local venue is open");
    await h.choose(visit.id);
  }
  const secondary = (await h.snap()).life.secondary[0];
  assert.ok(secondary, "local participation promotes a persistent resident");
  assert.ok((await h.snap()).life.secondary.length <= 6);
  await h.tab("people");
  await surface.locator(`.contact[data-npc="${secondary.id}"]`).click();
  const profile = surface.locator('[data-life="secondary"]');
  assert.equal(await profile.count(), 1);
  assert.ok(
    !(await profile.textContent()).match(/Banka bakiyesi|Özel birikim|Net varlık/),
    "public profile excludes private account fields",
  );
  const contactAction = (await h.snap()).actions.find(
    (a) => a.id === `life:call:${secondary.id}` && !a.disabled,
  );
  assert.ok(contactAction, "new resident supports a real phone conversation");
  const beforeCall = (await h.inspect()).revision;
  await h.choose(contactAction.id);
  assert.ok((await h.inspect()).revision > beforeCall);
  assert.ok((await h.snap()).life.secondary[0].history.length);
  await h.layout("persistent secondary contact");
  await surface.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/secondary-390.png`, fullPage: true });
  // Let the same simulation produce its next causal decision; never inject a synthetic event.
  let systemic;
  for (let i = 0; i < 12; i++) {
    await h.drain({ systemic: false, stories: true });
    systemic = (await h.snap()).emergent.events.find((e) => e.status === "active");
    if (systemic) break;
    const x = await h.snap();
    const attend = x.actions.find((a) => a.id.startsWith("calendar:attend:") && !a.disabled);
    const soon = x.state.calendar.entries.find(
      (e) => e.status === "confirmed" && e.end > x.state.time && e.start - x.state.time < 120,
    );
    if (attend) await h.choose(attend.id);
    else if (soon && x.state.city.venue !== soon.venue) {
      const visit = x.actions.find((a) => a.id === `visit:${soon.venue}` && !a.disabled);
      const travel = x.actions.find((a) => a.id === `travel:${soon.district}` && !a.disabled);
      assert.ok(visit || travel, "safe skip hands control back for the real booked journey");
      await h.choose((visit || travel).id);
    } else if (soon) await h.choose("wait:15");
    else await h.choose("calendar:next");
  }
  assert.ok(systemic, "ordinary time and existing life conditions generate a systemic event");
  await h.tab("stories");
  const card = surface.locator(`[data-systemic="${systemic.id}"]`);
  assert.ok((await card.textContent()).includes(systemic.why));
  assert.ok(await card.locator(".causal-why").count());
  await h.layout("causal event");
  const beforePreview = await h.inspect();
  await card.locator("[data-preview]").first().click();
  assert.deepEqual(await h.inspect(), beforePreview, "causal forecast is read-only");
  assert.ok(await surface.locator(".forecast-dialog").count());
  await surface.locator('[data-ui="close"]').first().click();
  await surface.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/causal-event-390.png`, fullPage: true });
  const beforeStop = await h.inspect();
  const routineAction = (await h.snap()).actions.find((a) => a.id === "schedule:run:1");
  if (routineAction.disabled) {
    await h.tab("plan");
    assert.ok(await surface.locator('[data-action="schedule:run:1"]').first().isDisabled());
    assert.match(routineAction.reason, /karar|seçim|olay/i);
    assert.deepEqual(await h.inspect(), beforeStop, "blocked retry preserves the full state");
  } else await h.choose("schedule:run:1");
  const stopped = await h.inspect();
  assert.equal(
    stopped.time,
    beforeStop.time,
    "routine does not choose or skip an active causal decision",
  );
  assert.ok(
    routineAction.disabled
      ? routineAction.reason.length
      : stopped.emergent.routine.stopReason.length,
  );
  const eventAction =
    (await h.snap()).actions.find(
      (a) => systemic.actionIds.includes(a.id) && !a.disabled && a.id.endsWith(":adapt"),
    ) || (await h.snap()).actions.find((a) => systemic.actionIds.includes(a.id) && !a.disabled);
  assert.ok(eventAction);
  const historyLength = (await h.snap()).emergent.history.length;
  await h.choose(eventAction.id);
  assert.ok(
    (await h.snap()).emergent.history.length > historyLength,
    "actual choice appends causal history",
  );
  await h.tab("log");
  assert.ok(await surface.locator('[data-emergent="history"] .causal-history li').count());
  await surface.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/causal-history-390.png`, fullPage: true });
  results.push({
    householdInvitation: true,
    separateEscrow: true,
    householdSaveReload: true,
    explicitExit: true,
    secondaryPromotion: true,
    secondaryPhone: true,
    generatedCausalEvent: systemic.family,
    causalHistory: true,
    routineDecisionStop: true,
  });
  await h.tab("life");
  await page.screenshot({ path: `${output}/v3-migration.png`, fullPage: true });
  results.push({
    v3MigrationDay: 91,
    immutableOriginal: true,
    staleV3Events: 2,
    canonicalPreserved: true,
    currentV4Sync: true,
  });
  await context.close();
  assert.deepEqual(errors, [], "no console or asset errors");
  writeFileSync(
    `${output}/result.json`,
    JSON.stringify(
      {
        ok: true,
        origin,
        results,
        errors,
        performance: {
          rawBytes: assetReport.reduce((n, x) => n + x.bytes, 0),
          gzipBytes: assetReport.reduce((n, x) => n + x.gzipBytes, 0),
          assets: assetReport,
          timings,
          caveat:
            "Click/change synchronous handler samples; excludes paint/network. Expanded v4 flow differs from separately repeated baseline Living City flow.",
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
    JSON.stringify({ message: error.message, stack: error.stack, results, errors }, null, 2),
  );
  throw error;
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
}
