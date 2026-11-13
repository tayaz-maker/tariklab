/** v4 integration evidence. Setup uses documented public commands/QA time, tested actions use DOM. */
import { installActionObserver, observeAction, stepRetiredWorld } from "./action-evidence.mjs";
import { waitForQATicks } from "./wait-for-qa-ticks.mjs";
import { chromium } from "playwright";
import { windowlessRendererOptions, verifySoftwareRenderer } from "./windowless-launch.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import {
  createWorld,
  applyCommand,
  validateState,
} from "../../src/games/social-engine/simulation/engine.ts";
import { encodeSave } from "../../src/games/social-engine/persistence/codec.ts";
import { BUILDINGS, hasLineOfSight } from "../../src/games/social-engine/domain/world.ts";
const base = process.env.SE_BASE || "http://127.0.0.1:8097";
const out = process.env.SE_QA_OUTPUT || "artifacts/social-engine/v4-browser";
await mkdir(out, { recursive: true });
const manifestBytes = await readFile("public/games/social-engine/build-manifest.json");
const manifest = JSON.parse(manifestBytes);
const sha = (x) => createHash("sha256").update(x).digest("hex");
const report = {
  startedAt: new Date().toISOString(),
  manifestSha256: sha(manifestBytes),
  sourceDigest: manifest.sourceDigest,
  setupPolicy:
    "Fresh isolated browser storage. Movement/time setup uses public commands and QA STEP; claimed UI actions use actual DOM/keyboard. Social checks import a validated freshly generated world; custody places one adult witness in that fixture. Family and custody fixtures are setup, not evidence of emergent behavior.",
  results: [],
  errors: [],
  loadedAssets: [],
};
await writeFile(out + "/build-manifest.json", manifestBytes);
const browser = await chromium.launch({
  ...windowlessRendererOptions(),
  headless: true,
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : chromium.executablePath()),
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
await context.addInitScript(installActionObserver);
const page = await context.newPage();
page.setDefaultTimeout(8000);
page.on("pageerror", (e) => report.errors.push(e.message));
const responses = [];
page.on("response", (r) => {
  if (r.url().includes("/games/social-engine/"))
    responses.push(
      (async () => {
        try {
          const b = await r.body();
          report.loadedAssets.push({ url: r.url(), sha256: sha(b), bytes: b.length });
        } catch {
          /* no successful body evidence */
        }
      })(),
    );
});
const state = () => page.evaluate(() => window.__socialEngine.state());
const cmd = (type, args = {}) =>
  page.evaluate(({ type, args }) => window.__socialEngine.command(type, args), { type, args });
const step = (count) => waitForQATicks(page, count);
const wait = async () => page.waitForTimeout(400);
async function fresh() {
  await page.goto(base + "/games/social-engine/index.html?qa=1");
  await page.locator("[name=name]").fill("Deniz V4 Kanıt");
  await page.getByRole("button", { name: "Hikâyene başla" }).click();
  await page.waitForFunction(() => window.__socialEngine?.projection()?.population >= 1100);
  if (process.env.SE_QA_VERIFY_SOFTWARE === "1" && !report.softwareRenderer)
    report.softwareRenderer = await verifySoftwareRenderer(page);
  await page.locator("#intro").waitFor({ state: "hidden" });
  await page.locator('[data-panel="phone"]').waitFor({ state: "visible" });
}
async function socialFixture({ witness = false } = {}) {
  const fixture = createWorld(20261103);
  if (witness) {
    const adult = fixture.npcs.find((n) => n.id === "n1");
    assert.ok(adult && adult.age >= 18);
    adult.location = { x: 22, y: 13.5, scene: "outside" };
    adult.path = [];
    adult.destination = null;
    adult.goal = "idle";
    adult.lastDecision = 100000;
    assert.ok(hasLineOfSight(fixture.npcs[0].location, adult.location, "outside"));
  }
  assert.deepEqual(validateState(fixture), []);
  const text = JSON.stringify(await encodeSave("slot-3", fixture));
  await page.evaluate(async (value) => {
    await window.__socialEngine.import("slot-3", value);
    await window.__socialEngine.load("slot-3");
  }, text);
  assert.equal((await cmd("SET_TIME_SPEED", { speed: 0.5 })).ok, true);
  return sha(text);
}
async function close() {
  if (await page.locator("#panel").isVisible()) {
    await page.keyboard.press("Escape");
    await page.locator("#panel").waitFor({ state: "hidden" });
  }
}
async function phone(tab) {
  await close();
  await page.locator('[data-panel="phone"]').click();
  await page.getByRole("dialog", { name: "Telefon", exact: true }).waitFor({ state: "visible" });
  await page.locator(`[data-tab="${tab}"]`).click();
}
async function move(point, count = 1600) {
  await close();
  assert.equal((await cmd("MOVE_TO", point)).ok, true);
  await step(count);
  const s = await state();
  assert.ok(
    Math.hypot(s.player.location.x - point.x, s.player.location.y - point.y) < 0.35,
    "setup walk arrived",
  );
}
async function building(id) {
  const b = BUILDINGS.find((b) => b.id === id);
  await move(b.door);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(
    (id) => window.__socialEngine.projection()?.player.location.scene === id,
    id,
  );
  assert.equal((await state()).player.location.scene, id, "actual E entered building");
}
async function check(id, name, fn, { reset = true } = {}) {
  const t = performance.now();
  try {
    if (reset) await fresh();
    const evidence = await fn();
    await page.screenshot({ path: `${out}/${id}.png` });
    report.results.push({ id, name, status: "PASS", duration_ms: performance.now() - t, evidence });
  } catch (e) {
    report.results.push({
      id,
      name,
      status: "FAIL",
      duration_ms: performance.now() - t,
      reason: e.stack,
    });
    await page.screenshot({ path: `${out}/${id}-failure.png` }).catch(() => {});
  }
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
}
try {
  await check(
    "travel",
    "DOM time speed and bus ticket move one authoritative player and debit fare",
    async () => {
      await move({ x: 27, y: 15.5 });
      await phone("travel");
      await page.locator("#time-speed").selectOption("2");
      await wait();
      assert.equal((await state()).mobility.speed, 2);
      await page.locator("#time-speed").selectOption("1");
      await wait();
      const before = await state();
      await page.locator('[data-ride="stop-coast"]').click();
      await wait();
      const trip = (await state()).mobility.trip;
      assert.ok(trip);
      assert.equal((await cmd("MOVE", { x: 1, y: 0 })).ok, false);
      await step(500);
      const after = await state();
      assert.equal(after.mobility.trip, null);
      assert.ok(Math.hypot(after.player.location.x - 28, after.player.location.y - 54.5) < 0.2);
      assert.equal(before.accounts.player - after.accounts.player, 2500);
      return { trip, arrival: after.player.location, fare: 2500 };
    },
  );
  await check("rental", "DOM rental fee and escrow refund preserve money", async () => {
    await move({ x: 31, y: 16 });
    await phone("travel");
    const before = await state();
    await page.locator('[data-rental="v-rental-0"]').click();
    await wait();
    let s = await state();
    assert.equal(s.mobility.rentals[0].status, "active");
    assert.equal(before.accounts.player - s.accounts.player, 75000);
    assert.equal(s.accounts["rental:v-rental-0"], 50000);
    await page.locator('[data-rental="v-rental-0"]').click();
    await wait();
    s = await state();
    assert.equal(s.mobility.rentals[0].status, "available");
    assert.equal(before.accounts.player - s.accounts.player, 25000);
    assert.equal(s.accounts["rental:v-rental-0"], 0);
    return { fee: 25000, refunded: 50000 };
  });
  await check("club", "DOM legal club membership and actual thirty-minute attendance", async () => {
    await building("b-school");
    await phone("circles");
    await page.locator('[data-social="CLUB_JOIN"]').click();
    await wait();
    assert.ok((await state()).social.club.members.find((m) => m.personId === "player"));
    await page.locator('[data-social="CLUB_SESSION"]').click();
    await wait();
    assert.ok((await state()).social.club.activity);
    await step(300);
    const s = await state();
    const member = s.social.club.members.find((m) => m.personId === "player");
    assert.equal(member.standing, 10);
    assert.equal(s.social.club.activity, null);
    return member;
  });
  await check(
    "faction",
    "DOM join and contribution transfer to owned faction treasury",
    async () => {
      const fixtureSha256 = await socialFixture();
      assert.equal((await cmd("TALK", { npcId: "n0", topic: "help" })).ok, true);
      await step(25);
      assert.equal((await cmd("TALK", { npcId: "n0", topic: "help" })).ok, true);
      await phone("circles");
      await page.locator('[data-join-faction="dock"]').click();
      await wait();
      let s = await state();
      assert.ok(
        s.social.factions.find((f) => f.id === "dock").members.find((m) => m.personId === "player"),
      );
      const before = s.accounts.player;
      await page.locator('[data-social="FACTION_DONATE"]').click();
      await wait();
      s = await state();
      assert.equal(before - s.accounts.player, 10000);
      assert.equal(s.accounts["faction:dock"], 10000);
      return { fixtureSha256, membership: s.flags.faction, treasury: s.accounts["faction:dock"] };
    },
  );
  await check(
    "combat",
    "Actual G heavy attack and Space dodge have authoritative consequences",
    async () => {
      const heavy = await observeAction(page, "ATTACK", () => page.keyboard.press("KeyG"));
      assert.equal(heavy.command.args.heavy, true, "actual KeyG selected heavy attack");
      const before = heavy.beforeState;
      assert.ok(
        heavy.state.player.stamina < before.player.stamina,
        "heavy stamina at exact action tick",
      );
      assert.ok(
        before.player.stamina - heavy.state.player.stamina >= 23.5,
        "24-point heavy cost with at most one tick of natural regeneration",
      );
      await step(8);
      let s = await state();
      const assault = s.crimes.find((c) => !before.crimes.some((old) => old.id === c.id));
      assert.ok(assault, "actual nearest target produced assault");
      const victim = s.npcs.find((n) => n.id === assault.victim),
        priorVictim = before.npcs.find((n) => n.id === assault.victim);
      assert.ok(
        priorVictim.health - victim.health >= 24,
        "heavy damage applied to actual nearest target",
      );
      assert.equal(assault.fine, 25000, "heavy strike case uses heavy consequences");
      assert.equal(
        assault.victim,
        heavy.command.args.npcId,
        "actual keyboard-selected heavy target",
      );
      const dodge = await observeAction(page, "DODGE", () => page.keyboard.press("Space"));
      s = dodge.state;
      assert.ok(s.flags.dodgeUntil > s.tick, "dodge active");
      assert.ok(s.flags.dodgeUntil <= s.tick + 6, "dodge has its bounded authoritative window");
      assert.ok(s.crimes.length > before.crimes.length);
      return {
        heavyActionTick: heavy.state.tick,
        heavyActionCursor: heavy.operation.cursor,
        heavyCommandId: heavy.command.id,
        heavyStaminaBefore: before.player.stamina,
        heavyStaminaAfter: heavy.state.player.stamina,
        victimId: victim.id,
        victimHealth: victim.health,
        stamina: s.player.stamina,
        dodgeUntil: s.flags.dodgeUntil,
        actionTick: s.tick,
        actionCursor: dodge.operation.cursor,
        commandId: dodge.command.id,
        crimeCount: s.crimes.length,
      };
    },
  );
  await check(
    "person-reach",
    "Moving NPC leaves live dialog range without stopping the world",
    async () => {
      const fixtureSha256 = await socialFixture();
      assert.equal((await cmd("RETIRE")).ok, true);
      assert.equal((await cmd("RESUME_CAREER")).ok, true);
      await step(1);
      await page.keyboard.press("KeyE");
      const dialog = page.locator('#panel [role="dialog"]');
      const share = page.locator("#share-rumor");
      await share.waitFor({ state: "visible" });
      const name = await dialog.getAttribute("aria-label");
      const before = await state();
      const npc = before.npcs.find((n) => n.name === name);
      assert.ok(npc, "dialog names actual projected NPC");
      assert.equal(await share.isEnabled(), true, "initial nearby action is available");
      await page.waitForFunction(
        () => {
          const button = document.querySelector("#share-rumor");
          return (
            button?.disabled &&
            document.querySelector("#person-reach")?.textContent?.includes("uzaklaştı")
          );
        },
        null,
        { timeout: 60000 },
      );
      const after = await state();
      const target = after.npcs.find((n) => n.id === npc.id);
      assert.ok(target && target.location.scene === after.player.location.scene);
      const distance = Math.hypot(
        target.location.x - after.player.location.x,
        target.location.y - after.player.location.y,
      );
      assert.ok(distance > 3, `actual NPC distance ${distance}`);
      assert.ok(after.tick > before.tick, "the authoritative world continued running");
      await page.evaluate(() => {
        window.__actionWire.armed = true;
        window.__actionWire.sent = [];
        document.querySelector("#share-rumor").click();
      });
      await page.waitForTimeout(300);
      const sent = await page.evaluate(() => {
        window.__actionWire.armed = false;
        return window.__actionWire.sent;
      });
      assert.equal(
        sent.filter((c) => c.type === "SHARE_RUMOR").length,
        0,
        "disabled control sends no action",
      );
      return {
        fixtureSha256,
        npcId: npc.id,
        beforeTick: before.tick,
        afterTick: after.tick,
        distance,
        status: await page.locator("#person-reach").innerText(),
      };
    },
  );
  await check("rumor", "DOM rumor preserves provenance and attenuates confidence", async () => {
    const fixtureSha256 = await socialFixture();
    // A supported game setting gives a real moving NPC enough time for a human-paced dialog.
    assert.equal((await cmd("SET_TIME_SPEED", { speed: 0.5 })).ok, true);
    assert.equal((await cmd("RETIRE")).ok, true);
    assert.equal((await cmd("RESUME_CAREER")).ok, true);
    await step(1);
    let s = await state();
    const resumedEvent = s.events
      .filter((e) => e.kind === "career_resumed" && e.actors.includes("player"))
      .at(-1);
    assert.ok(resumedEvent, "actual private career event exists");
    const event = s.social.knowledge.player.find((m) => m.eventId === resumedEvent.id);
    assert.ok(event, "player learned the exact private event");
    await page.keyboard.press("KeyE");
    const share = page.locator('#panel [role="dialog"] #share-rumor');
    await share.waitFor({ state: "visible" });
    const dialogName = await page.locator('#panel [role="dialog"]').getAttribute("aria-label");
    await page.locator("#rumor-event").selectOption(event.eventId);
    assert.equal(await share.isEnabled(), true, "live dialog reports recipient in range");
    const rumor = await observeAction(page, "SHARE_RUMOR", () =>
      page.locator("#share-rumor").click(),
    );
    assert.equal(rumor.command.args.eventId, event.eventId, "actual selected DOM rumor");
    const recipient = rumor.beforeState.npcs.find((npc) => npc.id === rumor.command.args.npcId);
    assert.ok(recipient, "actual DOM recipient exists in authority");
    const location = rumor.beforeState.player.location;
    assert.equal(
      recipient.location.scene,
      location.scene,
      "recipient in same scene at action tick",
    );
    const actionDistance = Math.hypot(
      recipient.location.x - location.x,
      recipient.location.y - location.y,
    );
    assert.ok(actionDistance <= 3, `recipient distance ${actionDistance} at action tick`);
    assert.ok(
      hasLineOfSight(location, recipient.location, location.scene),
      "line of sight at action tick",
    );
    assert.equal(
      recipient.name,
      dialogName,
      "actual command addresses the displayed person dialog",
    );
    assert.equal(
      (rumor.beforeState.social.knowledge[recipient.id] ?? []).some(
        (k) => k.eventId === event.eventId,
      ),
      false,
      "actual recipient does not already know the private career decision",
    );
    s = rumor.state;
    const learned = Object.values(s.social.knowledge)
      .flat()
      .find(
        (k) =>
          k.ownerId === rumor.command.args.npcId &&
          k.eventId === event.eventId &&
          k.sourceId === "player",
      );
    assert.ok(learned);
    assert.ok(learned.confidence < event.confidence);
    return {
      ...learned,
      fixtureSha256,
      actionDistance,
      actionTick: s.tick,
      actionCursor: rumor.operation.cursor,
      commandId: rumor.command.id,
    };
  });
  await check(
    "custody",
    "DOM police attendance creates real custody, blocks motion, resolves one fine",
    async () => {
      const fixtureSha256 = await socialFixture({ witness: true });
      assert.equal((await cmd("ATTACK", { npcId: "n0" })).ok, true);
      await step(90);
      const crime = (await state()).crimes.find(
        (c) => c.offender === "player" && c.victim === "n0",
      );
      assert.ok(crime?.witnesses.includes("n1"), "the actual assault recorded the fixture witness");
      await building("b-police");
      const before = await state();
      assert.ok(before.social.police.cases.some((c) => c.knownSuspectId === "player"));
      await page.locator('[data-action="POLICE_ATTEND"]').first().click();
      await wait();
      const detained = await state();
      assert.ok(detained.social.police.custody);
      assert.equal((await cmd("MOVE", { x: 1, y: 0 })).ok, false);
      await step(300);
      const after = await state();
      assert.equal(after.social.police.custody, null);
      assert.ok(after.social.police.cases.some((c) => c.status === "fined"));
      assert.ok(after.accounts.player < before.accounts.player);
      return {
        fixtureSha256,
        crime,
        custody: detained.social.police.custody,
        cases: after.social.police.cases,
      };
    },
  );
  await check(
    "retirement",
    "DOM retirement freezes world and explicit resume continues same career",
    async () => {
      await phone("life");
      await page.locator("[data-retirement]").click();
      const confirm = page.getByRole("button", { name: "Bu dönemi tamamla", exact: true });
      await confirm.waitFor({ state: "visible" });
      const retirement = await observeAction(page, "RETIRE", () => confirm.click());
      const retired = retirement.state;
      assert.equal(retired.progression.retired, true);
      const frozen = await stepRetiredWorld(page, 30);
      assert.equal(frozen.afterTick, retired.tick);
      const resume = page.getByRole("button", { name: "Aynı hayata dön", exact: true });
      await resume.waitFor({ state: "visible" });
      const resumed = await observeAction(page, "RESUME_CAREER", () => resume.click());
      assert.equal(resumed.beforeState.progression.retired, true);
      assert.equal(resumed.state.progression.retired, false);
      assert.equal(resumed.state.player.id, retired.player.id);
      await step(1);
      assert.ok((await state()).tick > retired.tick);
      return {
        retiredAt: retired.progression.retiredAt,
        preservedPlayer: retired.player.id,
        retiredCommandId: retirement.command.id,
        resumedCommandId: resumed.command.id,
        frozen,
      };
    },
  );
  await check(
    "family",
    "Validated marriage fixture then DOM birth and guardian change",
    async () => {
      const fixture = createWorld(20261103);
      const n = fixture.npcs[0];
      n.age = 30;
      n.location = { ...fixture.player.location, x: fixture.player.location.x + 0.5 };
      n.path = [];
      n.destination = null;
      n.goal = "idle";
      fixture.relations.push({
        from: n.id,
        to: "player",
        trust: 90,
        affection: 90,
        fear: 0,
        resentment: 0,
        lastContact: fixture.minute,
      });
      for (const type of ["ASK_DATE", "PROPOSE_MARRIAGE"])
        assert.equal(
          applyCommand(fixture, { v: 1, id: "v4-family-" + type, type, args: { npcId: n.id } }).ok,
          true,
        );
      assert.deepEqual(validateState(fixture), []);
      const envelope = await encodeSave("slot-3", fixture);
      const text = JSON.stringify(envelope);
      await writeFile(out + "/family-precondition.json", text);
      await page.evaluate(async (text) => {
        await window.__socialEngine.import("slot-3", text);
        await window.__socialEngine.load("slot-3");
      }, text);
      await wait();
      await phone("life");
      await page.locator('[data-family="REQUEST_CHILD"]').click();
      await wait();
      let s = await state();
      assert.equal(s.life.births.length, 1);
      const child = s.npcs.at(-1);
      assert.equal(child.age, 0);
      assert.equal(child.local, false);
      assert.equal(s.accounts[child.id], 0);
      await page.locator(`[id="guardian-${child.id}"]`).selectOption("municipality");
      await page.locator(`[data-guardian-child="${child.id}"]`).click();
      await wait();
      s = await state();
      assert.equal(
        s.life.guardians[child.id].includes("municipality"),
        false,
        "institutional guardianship cannot be assigned remotely",
      );
      await building("b-security");
      await phone("life");
      await page.locator(`[id="guardian-${child.id}"]`).selectOption("municipality");
      await page.locator(`[data-guardian-child="${child.id}"]`).click();
      await wait();
      s = await state();
      assert.ok(s.life.guardians[child.id].includes("municipality"));
      return { fixtureSha256: sha(text), childId: child.id, guardians: s.life.guardians[child.id] };
    },
  );
  await check(
    "SE-045",
    "Authentic TC SIM create/save/load bytes survive real SOCIAL ENGINE startup and save",
    async () => {
      await page.goto(base + "/games/tc-sim/index.html");
      const before = await page.evaluate(async () => {
        const { createNewGame } = await import("/games/tc-sim/js/state.js?v=10");
        const { saveGame, loadGame } = await import("/games/tc-sim/js/save.js?v=10");
        const s = createNewGame({
          name: "Legacy Kanıt",
          seed: 20261103,
          now: "2026-11-03T00:00:00.000Z",
        });
        const a = saveGame(localStorage, s);
        if (!a.ok) throw Error(a.message);
        const b = saveGame(localStorage, s);
        if (!b.ok) throw Error(b.message);
        const loaded = loadGame(localStorage);
        if (!loaded.ok) throw Error(loaded.message);
        return {
          keys: Object.fromEntries(
            Object.keys(localStorage)
              .filter((k) => k.startsWith("tc-sim") || k.startsWith("tariklab::tc-sim:"))
              .sort()
              .map((k) => [k, localStorage.getItem(k)]),
          ),
          name: loaded.state.player.name,
          version: loaded.state.meta.saveVersion,
        };
      });
      assert.ok(Object.keys(before.keys).length >= 3);
      await fresh();
      assert.equal(await page.evaluate(() => window.__socialEngine.save("slot-2")), true);
      const after = await page.evaluate(() =>
        Object.fromEntries(
          Object.keys(localStorage)
            .filter((k) => k.startsWith("tc-sim") || k.startsWith("tariklab::tc-sim:"))
            .sort()
            .map((k) => [k, localStorage.getItem(k)]),
        ),
      );
      assert.deepEqual(after, before.keys);
      await page.goto(base + "/games/tc-sim/index.html");
      const loaded = await page.evaluate(async () => {
        const { loadGame } = await import("/games/tc-sim/js/save.js?v=10");
        const r = loadGame(localStorage);
        return { ok: r.ok, name: r.state?.player.name, version: r.state?.meta.saveVersion };
      });
      assert.equal(loaded.ok, true);
      assert.equal(loaded.name, before.name);
      assert.equal(loaded.version, before.version);
      return {
        schema: before.version,
        name: before.name,
        keyBytesAndHashes: Object.fromEntries(
          Object.entries(before.keys).map(([k, v]) => [
            k,
            { bytes: Buffer.byteLength(v), sha256: sha(v) },
          ]),
        ),
        legacyReload: loaded,
      };
    },
  );
  await check(
    "worker-fallback",
    "An asynchronous first worker-load failure has a locked recoverable modal and local endpoint",
    async () => {
      await page.route("**/games/social-engine/worker-*.js", (route) => route.abort("failed"));
      try {
        await page.goto(base + "/games/social-engine/index.html?qa=1");
        await page.locator("[name=name]").fill("Deniz Kurtarma");
        await page.getByRole("button", { name: "Hikâyene başla" }).click();
        const modal = page.getByRole("alertdialog");
        await modal.waitFor();
        await page.keyboard.press("Escape");
        assert.equal(await modal.isVisible(), true, "fatal modal remains locked after Escape");
        assert.equal(
          await page.locator("#compatibility-mode").isEnabled(),
          true,
          "first-start fallback available without snapshot",
        );
        await page.locator("#compatibility-mode").click();
        await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
        const before = await state();
        assert.equal(before.player.name, "Deniz Kurtarma");
        assert.equal((await cmd("MOVE_TO", { x: 31, y: 16 })).ok, true);
        await step(50);
        const after = await state();
        assert.ok(after.player.location.x > before.player.location.x + 2);
        return {
          intentionalFailure: "worker script request aborted",
          population: after.npcs.length,
          profileName: after.player.name,
          location: after.player.location,
          alive: true,
        };
      } finally {
        await page.unroute("**/games/social-engine/worker-*.js");
      }
    },
    { reset: false },
  );
} finally {
  await Promise.allSettled(responses);
  report.finishedAt = new Date().toISOString();
  report.summary = {
    pass: report.results.filter((r) => r.status === "PASS").length,
    fail: report.results.filter((r) => r.status === "FAIL").length,
  };
  await context.tracing.stop({ path: out + "/trace.zip" });
  await browser.close();
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      out,
      summary: report.summary,
      failures: report.results
        .filter((r) => r.status === "FAIL")
        .map((r) => ({ id: r.id, reason: r.reason })),
    }),
  );
}
if (report.results.some((r) => r.status === "FAIL")) process.exitCode = 1;
