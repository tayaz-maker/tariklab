/** Boardworld 5 human-style journeys. Only real controls write simulation state. */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright";
import { createStaticGameServer } from "./static-game-server.mjs";
import { checkedUrl } from "./browser-guard.mjs";
const args = process.argv.slice(2),
  arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const output = resolve(
  process.env.RUNNER_TEMP || "../qa-society",
  "screenshots/boardworld-society",
);
mkdirSync(output, { recursive: true });
const gamePath = "/games/tc-sim-boardworld/",
  fixture = (name) => resolve("scripts/fixtures/boardworld", name + ".json");
const assets = readdirSync(resolve("public/games/tc-sim-boardworld"))
  .filter((name) => /\.(mjs|css|svg|html)$/.test(name))
  .sort();
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
  society: "stories",
};
const errors = [],
  results = [],
  assetReport = [];
let server,
  browser,
  currentPage,
  origin = arg("--base-url", "http://127.0.0.1:8080");
try {
  if (arg("--serve", null)) {
    server = createStaticGameServer(arg("--serve"));
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  checkedUrl(origin);
  for (const file of assets) {
    const response = await fetch(origin + gamePath + file);
    assert.equal(response.status, 200, file);
    const bytes = Buffer.from(await response.arrayBuffer()),
      expected = arg("--expected-root", arg("--serve", null));
    if (expected)
      assert.equal(
        digest(bytes),
        digest(readFileSync(resolve(expected, "games/tc-sim-boardworld", file))),
        `${file} exact bytes`,
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
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        (!message.location().url || message.location().url.startsWith(origin))
      )
        errors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (e) => errors.push(e.message));
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
          state = window.boardworldInspect(),
          actions = e.getActions(state);
        return {
          state,
          actions,
          society: e.getSocietyView(state),
          decision: e.getDecisionView(state, { actions, society: e.getSocietyView(state) }),
        };
      });
    const tab = (id) => surface.locator(`.game-tabs [data-tab="${id}"]`).click();
    const expose = async (button) => {
      const ancestors = await button.locator("xpath=ancestor::details[not(@open)]").all();
      for (const el of ancestors.reverse()) await el.locator(":scope > summary").click();
    };
    const choose = async (id) => {
      const before = await snap(),
        a = before.actions.find((a) => a.id === id);
      assert.ok(a && !a.disabled, `${id}: ${a?.reason || "missing"}`);
      if (a.category !== "event") await tab(categories[a.category] || "board");
      if (a.category === "travel") {
        const d = a.destination || id.split(":")[1].split("-")[0];
        if (await surface.locator(`[data-district="${d}"]`).count())
          await surface.locator(`[data-district="${d}"]`).first().click();
      }
      if (a.category === "social") {
        const npc =
          a.npcId ||
          [...Object.keys(before.state.npcs), ...before.state.life.secondary.map((n) => n.id)].find(
            (n) => id.split(":").includes(n),
          );
        if (npc) await surface.locator(`.contact[data-npc="${npc}"]`).first().click();
      }
      const match = /calendar:(?:accept|decline|cancel|attend):(.+)/.exec(id);
      if (match) {
        const e = before.state.calendar.entries.find((e) => e.id === match[1]),
          day = Math.floor(e.start / 1440) + 1;
        for (
          let i = 0;
          i < 20 && !(await surface.locator(`[data-calendar-day="${day}"]`).count());
          i++
        )
          await surface.locator('[data-calendar-week="1"]').click();
        await surface.locator(`[data-calendar-day="${day}"]`).first().click();
      }
      if (id.startsWith("policy:") && !id.startsWith("policy:day:"))
        await surface.locator(`[data-policy-field="${id.split(":")[1]}"]`).selectOption(id);
      else if (id === "flow:payments:authorized") {
        const b = surface.locator(`[data-preview="${id}"]`).first();
        await expose(b);
        await b.click();
        assert.deepEqual(await inspect(), before.state, "consent preview does not mutate");
        await surface.locator(`[data-preview-commit="${id}"]`).click();
      } else {
        const b = surface.locator(`[data-action="${id}"]`).first();
        assert.equal(await b.count(), 1, `${id} is reachable`);
        await expose(b);
        await b.click();
      }
      const after = await inspect();
      assert.ok(after.revision > before.state.revision, `${id} commits via control`);
      return after;
    };
    const drain = async () => {
      for (let i = 0; i < 50; i++) {
        const x = await snap(),
          a = x.actions.find((a) => a.category === "event" && !a.disabled);
        if (!a) return;
        await choose(a.id);
      }
      throw Error("Event queue did not drain");
    };
    const importFixture = async (name) => {
      await surface.locator("#import-file").setInputFiles(fixture(name));
      await surface.waitForFunction(() => window.boardworldInspect()?.version === 5);
      return inspect();
    };
    const layout = async (label) => {
      const b = await surface.evaluate(() => ({
        w: innerWidth,
        scroll: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(b.scroll <= b.w + 1 && b.body <= b.w + 1, `${label}: ${JSON.stringify(b)}`);
    };
    return { inspect, snap, tab, choose, drain, importFixture, layout };
  };
  for (const [width, lang] of [
    [1440, "tr"],
    [390, "en"],
    [320, "pl"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      reducedMotion: width === 320 ? "reduce" : "no-preference",
    });
    await context.addInitScript((lang) => {
      localStorage.setItem("tariklab.language", lang);
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
    }, lang);
    const page = (currentPage = await context.newPage());
    page.on("pageerror", (e) => errors.push(`${width}: ${e.message}`));
    page.on("response", (r) => {
      if (r.url().startsWith(origin + gamePath) && r.status() >= 400)
        errors.push(`${r.status()} ${r.url()}`);
    });
    let surface = await attach(page),
      h = helpers(surface);
    const trace = [];
    await surface.locator("#create-form").waitFor();
    assert.equal(await surface.locator("html").getAttribute("lang"), lang);
    const firstPaint = await surface.evaluate(
      () => performance.getEntriesByName("first-contentful-paint")[0]?.startTime || null,
    );
    await surface.locator("[name=scenario][value=restart]").check();
    await surface.locator("#character-name").fill("Deniz Kaya");
    await surface.locator("[data-testid=create-game]").click();
    await h.drain();
    if (lang !== "tr") {
      const bankLabel = await surface.locator('.cash-resource [data-tab="wallet"]').innerText();
      assert.match(bankLabel, /^Bank /, "current bank HUD uses the selected language");
      assert.ok(!bankLabel.startsWith("Banka"));
    }
    if (args.includes("--portal") && width < 600) {
      const brand = await surface.locator(".topbar .game-brand").boundingBox(),
        toolbar = await surface.locator(".topbar .top-actions").boundingBox();
      assert.ok(brand && toolbar, "embedded mobile brand and save/menu remain visible");
      assert.ok(
        toolbar.y < brand.y + brand.height && brand.y < toolbar.y + toolbar.height,
        "embedded mobile controls share the brand row in every selected language",
      );
    }
    // Career morning: an explicit day-off is visible and cannot be blindly rerun.
    await h.tab("plan");
    const weekday = Math.floor((await h.inspect()).time / 1440) % 7;
    await h.choose(`policy:day:${weekday}`);
    const blocked = await h.snap();
    assert.equal(blocked.decision.routine.code, "weekday");
    assert.equal(blocked.decision.routine.retryAllowed, false);
    assert.ok(blocked.decision.routine.actionIds.includes(`policy:day:${weekday}`));
    assert.ok(await surface.locator('[data-action="schedule:run:1"]').first().isDisabled());
    const recovery = surface.locator(
      `[data-society="routine-recovery"] [data-action="policy:day:${weekday}"]`,
    );
    const touch = await recovery.boundingBox();
    assert.ok(touch.height >= 44 && touch.width >= 44, "direct recovery has a touch target");
    await recovery.click();
    assert.equal((await h.inspect()).time, blocked.state.time, "changing policy spends no time");
    assert.notEqual((await h.snap()).decision.routine.code, "weekday");
    await h.choose("flow:payments:authorized");
    assert.equal((await h.inspect()).flow.settlements, "authorized");
    await surface.locator('.game-tabs [data-tab="plan"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await surface.locator('.game-tabs [data-tab="plan"]').getAttribute("aria-current"),
      "page",
      "keyboard opens planner",
    );
    assert.ok(await surface.locator(":focus-visible").count(), "visible keyboard focus");
    if (width === 320)
      assert.ok(
        await surface.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
      );
    await h.layout("career recovery");
    await page.screenshot({ path: resolve(output, `recovery-${width}.png`), fullPage: true });
    // Social journey: authentic 4.0 progress; real work, care and travel until a new invitation.
    await h.importFixture("v4-social-day91");
    let offer = null;
    const act = async (id) => {
      const before = await h.inspect(),
        after = await h.choose(id);
      trace.push({ id, at: before.time, end: after.time });
      return after;
    };
    const maintenance = async (x) => {
      const legal = (id) => x.actions.find((a) => a.id === id && !a.disabled),
        event = x.actions.find((a) => a.category === "event" && !a.disabled);
      if (event) {
        await act(event.id);
        return true;
      }
      if (x.state.player.hunger < 55 && legal("eat")) {
        await act("eat");
        return true;
      }
      if (x.state.player.energy < 30 && legal("rest")) {
        await act("rest");
        return true;
      }
      return false;
    };
    for (let i = 0; i < 150 && !offer; i++) {
      const x = await h.snap();
      offer = x.society.offers.find((o) => o.type === "meeting");
      if (offer) break;
      if (await maintenance(x)) continue;
      const m = x.state.time % 1440,
        legal = (id) => x.actions.find((a) => a.id === id && !a.disabled);
      if (legal("work") && m < 600) await act("work");
      else if ((m >= 1320 || m < 360) && legal("sleep")) await act("sleep");
      else await act("wait:60");
    }
    assert.ok(offer, "an NPC independently initiates a real invitation");
    await h.tab("stories");
    assert.ok(await surface.locator(`[data-offer="${offer.id}"]`).isVisible());
    const opening = await h.inspect(),
      entry = opening.calendar.entries.find((e) => e.id === offer.calendarId);
    assert.equal(entry.status, "counter", "unaccepted invitation is not a promise");
    const revision = (await h.snap()).actions.find(
      (a) => a.id.startsWith(`society:reschedule:${offer.id}:`) && !a.disabled,
    );
    assert.ok(revision);
    await act(revision.id);
    await act(`calendar:accept:${offer.calendarId}`);
    for (let i = 0; i < 150; i++) {
      const x = await h.snap(),
        e = x.state.calendar.entries.find((e) => e.id === offer.calendarId),
        legal = (id) => x.actions.find((a) => a.id === id && !a.disabled);
      if (legal(`calendar:attend:${e.id}`)) break;
      if (await maintenance(x)) continue;
      if (e.start - x.state.time > 600 && legal("work") && x.state.time % 1440 < 600)
        await act("work");
      else if (e.start - x.state.time > 600 && x.state.time % 1440 >= 1260 && legal("sleep"))
        await act("sleep");
      else if (x.state.location !== e.district) await act(`travel:${e.district}`);
      else if (x.state.city.venue !== e.venue && legal(`visit:${e.venue}`))
        await act(`visit:${e.venue}`);
      else await act(e.start - x.state.time > 60 ? "wait:60" : "wait:15");
    }
    await act(`calendar:attend:${offer.calendarId}`);
    const social = await h.snap();
    assert.equal(
      social.state.calendar.entries.find((e) => e.id === offer.calendarId).status,
      "completed",
    );
    const fact = social.society.profiles
      .find((p) => p.id === offer.npcId)
      .knownFacts.find((f) => f.id === `calendar:${offer.calendarId}`);
    assert.ok(
      fact && fact.happenedAt === social.state.time && fact.learnedAt === social.state.time,
      "actual attendance has truthful occurrence and disclosure times",
    );
    assert.ok(social.society.chronology.some((e) => e.parentId === offer.id));
    await h.tab("people");
    await surface.locator(`.contact[data-npc="${offer.npcId}"]`).click();
    await surface.locator('[data-society="profile"] > summary').click();
    assert.ok(
      (await surface.locator('[data-society="profile"]').innerText()).includes(
        String(Math.floor(fact.learnedAt / 1440) + 1),
      ),
    );
    await h.layout("social profile");
    await page.screenshot({ path: resolve(output, `social-${width}.png`), fullPage: true });
    await h.tab("log");
    await surface.locator(".society-episode > summary").first().click();
    await h.layout("causal chronology");
    await page.screenshot({ path: resolve(output, `chronology-${width}.png`), fullPage: true });
    // Entrepreneur: actual material stock and business capital settle together, then voluntary debt repayment.
    await h.importFixture("v4-active-enterprise");
    await h.tab("board");
    await surface.locator('[data-society="district"] > summary').click();
    await h.layout("district supply");
    const beforeStock = await h.inspect();
    await h.choose("business:stock:3");
    const afterStock = await h.inspect(),
      district = beforeStock.deep.business.location;
    assert.equal(
      afterStock.society.districts[district].materialStock,
      beforeStock.society.districts[district].materialStock - 3,
    );
    assert.equal(afterStock.living.enterprise.stock, beforeStock.living.enterprise.stock + 3);
    assert.ok(afterStock.living.enterprise.capital < beforeStock.living.enterprise.capital);
    await h.choose("repay:500");
    assert.equal((await h.inspect()).debt, afterStock.debt - 500);
    await h.tab("enterprise");
    await h.layout("business and supply");
    await page.screenshot({ path: resolve(output, `enterprise-${width}.png`), fullPage: true });
    const actionTimes = await surface.evaluate(() => window.boardworldQaTimings);
    assert.ok(actionTimes.length >= 20, "at least 20 real action samples");
    const saved = await h.inspect();
    await surface.locator('.top-actions [data-ui="save"]').click();
    await page.reload({ waitUntil: "networkidle" });
    surface = args.includes("--portal")
      ? await (await page.locator("iframe").elementHandle()).contentFrame()
      : page;
    h = helpers(surface);
    assert.deepEqual(await h.inspect(), saved, "save/reload preserves complete 5.0 state");
    // Every panel stays reachable in selected language; changes never touch simulation.
    for (const id of await surface
      .locator(".game-tabs [data-tab]")
      .evaluateAll((es) => es.map((e) => e.dataset.tab))) {
      await h.tab(id);
      await h.layout(`panel ${id}`);
    }
    const beforeLanguage = await h.inspect();
    await surface.evaluate(async () => {
      const m = await import("/games/tc-sim-boardworld/i18n.mjs");
      await m.chooseLanguage("en");
    });
    assert.deepEqual(await h.inspect(), beforeLanguage);
    assert.match(await surface.locator(".game-tabs [data-tab=plan]").innerText(), /Planner|Agenda/);
    await surface.evaluate(async () => {
      const m = await import("/games/tc-sim-boardworld/i18n.mjs");
      await m.chooseLanguage("pl");
    });
    assert.deepEqual(await h.inspect(), beforeLanguage);
    assert.ok(!/Ajanda/.test(await surface.locator(".game-tabs [data-tab=plan]").innerText()));
    await surface.evaluate(async (lang) => {
      const m = await import("/games/tc-sim-boardworld/i18n.mjs");
      await m.chooseLanguage(lang);
    }, lang);
    await h.tab("board");
    await surface.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: resolve(output, `board-${width}.png`), fullPage: true });
    const times = actionTimes,
      sorted = times.slice().sort((a, b) => a - b);
    results.push({
      width,
      language: lang,
      firstPaintMs: firstPaint,
      careerDirectRecovery: true,
      explicitPaymentConsent: true,
      offerId: offer.id,
      calendarId: offer.calendarId,
      attendanceAt: fact.happenedAt,
      learnedAt: fact.learnedAt,
      socialActions: trace.length,
      trace,
      stockConsumed: 3,
      debtRepaid: 500,
      saveReload: true,
      localeStateUnchanged: true,
      actionTimingCount: times.length,
      p50: sorted[Math.floor(sorted.length * 0.5)] || null,
      p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || null,
      locale: await surface.evaluate(() => window.boardworldLocaleReport()),
    });
    await context.close();
  }
  // Current5 isolation from released4 tabs, with real cross-tab storage events.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    page = (currentPage = await context.newPage()),
    surface = await attach(page, false),
    h = helpers(surface),
    bytes = readFileSync(fixture("v4-career-day91"), "utf8");
  await h.importFixture("v4-career-day91");
  assert.equal(
    await surface.evaluate(() => localStorage.getItem("tariklab.boardworld.v4.original-v4")),
    bytes,
  );
  await h.choose("flow:payments:authorized");
  const upgraded = await h.inspect(),
    canonical = await surface.evaluate(() => [
      localStorage.getItem("tariklab.boardworld.v5"),
      localStorage.getItem("tariklab.boardworld.v5.backup"),
    ]);
  await surface.evaluate(() => {
    window.stale4Events = 0;
    addEventListener("storage", (e) => {
      if (e.key === "tariklab.boardworld.v4") window.stale4Events++;
    });
  });
  const writer = await context.newPage();
  await attach(writer, false);
  for (const [i, old] of [readFileSync(fixture("v4-fresh-restart"), "utf8"), bytes].entries()) {
    await writer.evaluate((value) => {
      const prior = localStorage.getItem("tariklab.boardworld.v4");
      localStorage.setItem("tariklab.boardworld.v4.backup", prior || value);
      localStorage.setItem("tariklab.boardworld.v4", value);
    }, old);
    await surface.waitForFunction((n) => window.stale4Events >= n, i + 1);
    assert.deepEqual(await h.inspect(), upgraded);
    assert.deepEqual(
      await surface.evaluate(() => [
        localStorage.getItem("tariklab.boardworld.v5"),
        localStorage.getItem("tariklab.boardworld.v5.backup"),
      ]),
      canonical,
    );
  }
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual(await h.inspect(), upgraded);
  await h.choose("flow:payments:review");
  const current = await h.inspect();
  await writer.waitForFunction((r) => window.boardworldInspect()?.revision === r, current.revision);
  assert.deepEqual(await writer.evaluate(() => window.boardworldInspect()), current);
  await context.close();
  // A delayed older language load cannot overwrite a newer TR choice.
  const raceContext = await browser.newContext(),
    racePage = (currentPage = await raceContext.newPage());
  let releaseFetch, started;
  const start = new Promise((r) => (started = r));
  await raceContext.route("**/locale-en.mjs", async (route) => {
    started();
    await new Promise((r) => (releaseFetch = r));
    await route.continue();
  });
  const race = await attach(racePage, false);
  await race.locator("[data-game-language]").selectOption("en");
  await start;
  await race.locator("[data-game-language]").selectOption("tr");
  releaseFetch();
  await race.waitForFunction(() => window.boardworldLocaleReport()?.language === "tr");
  await racePage.waitForLoadState("networkidle");
  assert.equal(await race.locator("html").getAttribute("lang"), "tr");
  assert.equal(await race.evaluate(() => localStorage.getItem("tariklab.language")), "tr");
  await raceContext.close();
  assert.deepEqual(errors, []);
  const report = {
    ok: true,
    assets: assetReport,
    rawBytes: assetReport.reduce((n, a) => n + a.bytes, 0),
    gzipBytes: assetReport.reduce((n, a) => n + a.gzipBytes, 0),
    initialTrGzipBytes: assetReport
      .filter((a) => !a.file.startsWith("locale-"))
      .reduce((n, a) => n + a.gzipBytes, 0),
    results,
    migration: {
      source: 4,
      target: 5,
      immutableArchive: true,
      stale4Events: 2,
      current5CrossTab: true,
    },
    delayedLocaleRace: true,
    errors,
  };
  writeFileSync(resolve(output, "result.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: true,
        viewports: results.map((r) => ({
          width: r.width,
          language: r.language,
          socialActions: r.socialActions,
          offer: r.offerId,
        })),
        assets: assets.length,
        migration: report.migration,
        output,
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (currentPage && !currentPage.isClosed())
    await currentPage
      .screenshot({ path: resolve(output, "failure.png"), fullPage: true })
      .catch(() => {});
  writeFileSync(
    resolve(output, "failure.json"),
    JSON.stringify({ error: error.stack, results, errors }, null, 2),
  );
  throw error;
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
}
