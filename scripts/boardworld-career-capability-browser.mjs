// Prepared compatibility scenario. All tested reads and writes run through the
// production persistence API with Chromium's own IndexedDB and Web Locks.
/* global engine, persistence, act, save, oldState, oldToken, newState, newToken */
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {chromium} from "playwright";
import {createStaticGameServer} from "./static-game-server.mjs";

const reference = "c055514627db537c79f4c92481d38109606deaa6";
const slot = "tariklab.boardworld.v7.living-depth";
const careerSlot = slot + ".careers";
const firstCareer = process.argv[3] ?? "finance";
assert.ok(["finance", "health"].includes(firstCareer));
const worldSlot = "tariklab.boardworld.v7.living-world-3";
const archiveRoot = mkdtempSync(join(tmpdir(), "bw-depth-reference-"));
const archive = spawnSync("git", ["archive", reference, "public/games/tc-sim-boardworld"], {maxBuffer: 8e6});
assert.equal(archive.status, 0, archive.stderr.toString());
assert.equal(spawnSync("tar", ["-x", "-C", archiveRoot], {input: archive.stdout}).status, 0);
const server = createStaticGameServer(process.argv[2] || "public");
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const context = await browser.newContext();
const old = await context.newPage();
const current = await context.newPage();
const prefix = "/games/tc-sim-boardworld/";

async function initialize(page, modules) {
  await page.evaluate(async (modules) => {
    if (typeof indexedDB?.open !== "function" || typeof navigator.locks?.request !== "function")
      throw Error("Native IndexedDB and Web Locks are required");
    window.engine = await import(modules + "engine.mjs");
    window.persistence = await import(modules + "persistence.mjs");
    await engine.loadExpansionRuntime();
    window.act = (state, id) => {
      const result = engine.resolveAction(state, id);
      if (!result.ok) throw Error(`${id}: ${result.message}`);
      return result.state;
    };
    window.save = async (state, token) => {
      const result = await persistence.saveExpansionLocked(state, undefined, token);
      if (!result.ok) throw Error(result.message);
      return result.token;
    };
  }, modules);
}

async function snapshot(page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("tariklab.boardworld.v6.transactions", 1);
    const db = await new Promise((done, fail) => {
      request.onsuccess = () => done(request.result);
      request.onerror = () => fail(request.error);
    });
    try {
      const read = db.transaction("state").objectStore("state").get("head");
      return await new Promise((done, fail) => {
        read.onsuccess = () => done(read.result);
        read.onerror = () => fail(read.error);
      });
    } finally {
      db.close();
    }
  });
}

async function corruptCareerPrimary(page, key, invalidBytes) {
  await page.evaluate(({key, invalidBytes}) => navigator.locks.request("tariklab.boardworld.v6.transaction", async () => {
    const request = indexedDB.open("tariklab.boardworld.v6.transactions", 1);
    const db = await new Promise((done, fail) => {
      request.onsuccess = () => done(request.result);
      request.onerror = () => fail(request.error);
    });
    try {
      const tx = db.transaction("state", "readwrite");
      const state = tx.objectStore("state");
      const read = state.get("head");
      read.onsuccess = () => {
        const head = read.result, slots = new Map(head.slots);
        slots.set(key, invalidBytes);
        state.put({...head, generation: head.generation + 1, slots: [...slots]}, "head");
      };
      await new Promise((done, fail) => {
        tx.oncomplete = done;
        tx.onabort = () => fail(tx.error);
      });
    } finally {
      db.close();
    }
  }), {key, invalidBytes});
}

try {
  await context.route(origin + "/test-harness", (route) =>
    route.fulfill({body: "<!doctype html><title>Career save isolation</title>", contentType: "text/html"}));
  await context.route(origin + "/frozen-depth/**", async (route) => {
    const file = new URL(route.request().url()).pathname.slice("/frozen-depth/".length);
    assert.match(file, /^[\w.-]+\.mjs$/);
    await route.fulfill({
      body: readFileSync(join(archiveRoot, "public/games/tc-sim-boardworld", file)),
      contentType: "text/javascript",
    });
  });
  await old.goto(origin + "/test-harness");
  await initialize(old, "/frozen-depth/");
  const convention = await old.evaluate(async () => {
    let state = engine.createGame({seed: 49, startingDistrict: "izmir:bornova", lifePath: "freeform"});
    // Existing finance training and minimum skills are prepared to isolate the storage transition.
    Object.assign(state.player.skills, {communication: 40, knowledge: 40});
    state.expansion.institutions.qualifications.push({course: "finance", day: 1});
    state = act(state, "district:visit:izmir:bornova:work");
    const initial = await persistence.loadExpansionLocked();
    let token = await save(state, initial.token);
    state = act(state, "wait:15");
    token = await save(state, token);
    state = act(state, "district:apply:customer-service");
    token = await save(state, token);
    state = act(state, "wait:15");
    window.oldToken = await save(state, token);
    window.oldState = state;
    return {state, token: window.oldToken};
  });
  assert.equal(convention.token.key, slot);
  assert.equal(convention.state.expansion.districts.job.role, "customer-service");
  const before = await snapshot(old);
  const predecessor = new Map(before.slots);
  for (const key of [slot, slot + ".backup", worldSlot, worldSlot + ".backup"])
    assert.ok(predecessor.get(key), `predecessor slot ${key} is present`);

  await current.goto(origin + "/test-harness");
  await initialize(current, prefix);
  const prepared = await current.evaluate(async (career) => {
    const previous = await persistence.loadExpansionLocked();
    const resigned = act(previous.state, "district:quit");
    const state = career === "finance" ? act(resigned, "district:apply:finance")
      : act(act(resigned, "district:visit:izmir:bornova:institution"), "institution:school:health-support");
    return {state, expectedToken: previous.token, source: previous.state};
  }, firstCareer);
  await current.reload();
  const promoted = await current.evaluate(async ({modulePath, incoming}) => {
    const core = await import(modulePath + "engine.mjs");
    const io = await import(modulePath + "persistence.mjs");
    const coldTier = core.expansionSaveTier(incoming.state);
    const result = await io.saveExpansionLocked(incoming.state, undefined, incoming.expectedToken);
    if (!result.ok) throw Error(result.message);
    window.newState = incoming.state;
    window.newToken = result.token;
    return {...incoming, token: result.token, coldTier};
  }, {modulePath: prefix, incoming: prepared});
  assert.equal(promoted.coldTier, 0, "the expansion was unavailable before the first write");
  await initialize(current, prefix);
  assert.deepEqual(promoted.source, convention.state);
  assert.equal(promoted.token.key, careerSlot);
  if (firstCareer === "finance") assert.equal(promoted.state.expansion.districts.job.role, "finance");
  else assert.equal(promoted.state.expansion.institutions.program.course, "health-support");
  const after = await snapshot(current);
  const adopted = new Map(after.slots);
  assert.equal(after.generation, before.generation + 1, "the slot pair is one durable transaction");
  assert.equal(adopted.get(careerSlot), promoted.token.primary);
  assert.equal(adopted.get(careerSlot + ".backup"), convention.token.primary);
  for (const [key, bytes] of predecessor) assert.equal(adopted.get(key), bytes, key);

  const oldStale = await old.evaluate(async (newBytes) => ({
    readsNew: !!persistence.importGame(newBytes).state,
    write: await persistence.saveExpansionLocked(oldState, undefined, oldToken),
  }), promoted.token.primary);
  assert.deepEqual([oldStale.readsNew, oldStale.write.conflict], [false, true]);
  assert.deepEqual(await snapshot(current), after, "stale old writer cannot mutate either pair");

  await old.reload();
  await initialize(old, "/frozen-depth/");
  const oldBranch = await old.evaluate(async () => {
    const previous = await persistence.loadExpansionLocked();
    return {state: previous.state, token: await save(act(previous.state, "wait:15"), previous.token)};
  });
  assert.deepEqual(oldBranch.state, convention.state);
  assert.equal(oldBranch.token.key, slot);
  const afterOld = new Map((await snapshot(current)).slots);
  assert.equal(afterOld.get(slot), oldBranch.token.primary);
  assert.equal(afterOld.get(careerSlot), promoted.token.primary);
  assert.equal(afterOld.get(careerSlot + ".backup"), promoted.token.backup);
  assert.equal(afterOld.get(worldSlot), predecessor.get(worldSlot));
  assert.equal(afterOld.get(worldSlot + ".backup"), predecessor.get(worldSlot + ".backup"));
  const newStale = await current.evaluate(() => persistence.saveExpansionLocked(newState, undefined, newToken));
  assert.equal(newStale.conflict, true);

  await current.reload();
  await initialize(current, prefix);
  const reloaded = await current.evaluate(async (career) => {
    const previous = await persistence.loadExpansionLocked();
    const resigned = act(previous.state, career === "finance" ? "district:quit" : "institution:withdraw");
    const token = await save(resigned, previous.token);
    return {state: previous.state, token};
  }, firstCareer);
  assert.deepEqual(reloaded.state, promoted.state);
  assert.equal(reloaded.token.key, careerSlot, "leaving a career or course keeps the promoted slot");
  const previousHealth = await snapshot(current);
  await old.evaluate(async () => {
    const previous = await persistence.loadExpansionLocked();
    window.oldState = previous.state;
    window.oldToken = previous.token;
  });
  const enrolled = await current.evaluate(async () => {
    const previous = await persistence.loadExpansionLocked();
    const atOffice = previous.state.expansion.districts.place.venueId === "izmir:bornova:institution" ? previous.state
      : act(previous.state, "district:visit:izmir:bornova:institution");
    const state = act(atOffice, "institution:school:health-support");
    return {state, token: await save(state, previous.token)};
  });
  assert.equal(enrolled.state.expansion.institutions.program.course, "health-support");
  assert.equal(enrolled.token.key, careerSlot, "registration reuses the shared career slot");
  const healthHead = await snapshot(current);
  const healthSlots = new Map(healthHead.slots);
  assert.equal(healthHead.generation, previousHealth.generation + 1);
  assert.equal(healthSlots.get(careerSlot + ".backup"), new Map(previousHealth.slots).get(careerSlot));
  for (const [key, bytes] of previousHealth.slots)
    if (![careerSlot, careerSlot + ".backup"].includes(key)) assert.equal(healthSlots.get(key), bytes, key);
  const healthStale = await old.evaluate(async (healthBytes) => ({
    readsHealth: !!persistence.importGame(healthBytes).state,
    write: await persistence.saveExpansionLocked(oldState, undefined, oldToken),
  }), enrolled.token.primary);
  assert.deepEqual([healthStale.readsHealth, healthStale.write.conflict], [false, true]);
  assert.deepEqual(await snapshot(current), healthHead);
  await old.reload();
  await initialize(old, "/frozen-depth/");
  const afterEnrollment = await old.evaluate(async () => {
    const previous = await persistence.loadExpansionLocked();
    return save(act(previous.state, "wait:15"), previous.token);
  });
  assert.equal(afterEnrollment.key, slot);
  const afterEnrollmentSlots = new Map((await snapshot(current)).slots);
  assert.equal(afterEnrollmentSlots.get(careerSlot), enrolled.token.primary);
  assert.equal(afterEnrollmentSlots.get(careerSlot + ".backup"), enrolled.token.backup);
  await current.reload();
  await initialize(current, prefix);
  const resumedHealth = await current.evaluate(() => persistence.loadExpansionLocked());
  assert.deepEqual(resumedHealth.state, enrolled.state);

  // A cold UI must recognize the portable header before the simulation is loaded.
  const portableContext = await browser.newContext();
  try {
    const portable = await portableContext.newPage();
    const requests = [];
    portable.on("request", request => {
      const path = new URL(request.url()).pathname;
      if (/\/expansion(?:[.-]|$)/.test(path)) requests.push(path);
    });
    await portable.route(origin + "/test-harness", route =>
      route.fulfill({body: "<!doctype html><title>Cold Gold import</title>", contentType: "text/html"}));
    await portable.goto(origin + "/test-harness");
    const gold = await portable.evaluate(async (modulePath) => {
      const engine = await import(modulePath + "engine.mjs"), io = await import(modulePath + "persistence.mjs");
      const previous = await io.loadGameLocked();
      const saved = await io.saveGameLocked(engine.createGame({name: "Cold Gold"}), undefined, previous.token);
      if (!saved.ok) throw Error(saved.message);
      return saved.token.primary;
    }, prefix);
    await portable.goto(origin + prefix + "index.html");
    await portable.waitForFunction(() => window.boardworldInspect?.()?.version === 6);
    assert.deepEqual(requests, [], "the cold start did not request the expansion");
    await portable.locator("#import-file").setInputFiles({name: "career.json",
      mimeType: "application/json", buffer: Buffer.from(enrolled.token.primary)});
    await portable.waitForFunction(() => window.boardworldInspect?.()?.expansion?.institutions?.program?.course === "health-support");
    assert.deepEqual(await portable.evaluate(() => window.boardworldInspect()), enrolled.state);
    assert.ok(requests.some(path => path.endsWith("/expansion.mjs")));
    const slots = new Map((await snapshot(portable)).slots);
    assert.equal(slots.get(careerSlot), enrolled.token.primary);
    assert.equal(slots.get("tariklab.boardworld.v6"), gold);
  } finally {
    await portableContext.close();
  }

  // Prepare a real accepted career backup, then simulate damaged primary bytes.
  const rolling = await current.evaluate(async () => {
    const previous = await persistence.loadExpansionLocked();
    return save(act(previous.state, "wait:15"), previous.token);
  });
  assert.equal(rolling.backup, enrolled.token.primary);
  await corruptCareerPrimary(current, careerSlot, "damaged career primary");
  const damaged = await snapshot(current);
  await current.goto(origin + prefix + "index.html");
  await current.waitForFunction(() => window.boardworldInspect?.()?.expansion?.institutions?.program?.course === "health-support");
  assert.deepEqual(await current.evaluate(() => window.boardworldInspect()), enrolled.state);
  assert.match(await current.locator(".save-state").textContent(), /Sağlam yedek açıldı/);
  assert.deepEqual(await snapshot(current), damaged, "recovery preserves the authoritative slot pair");

  const result = {ok: true, reference, firstCareer, chromium: browser.version(), generation: after.generation,
    olderPairsPreservedOnPromotion: [slot, worldSlot], staleWritersRejected: true,
    resumedOldBranchIsolated: true, promotedStateReloaded: true, slotStickyAfterResignation: true,
    sharedCareerSlot: careerSlot, healthCourseReloaded: true, coldSavePromotion: true,
    coldPortableImport: true, coldCareerBackupRecovery: true};
  const out = resolve(process.env.RUNNER_TEMP || "work", "screenshots/boardworld-career-save", firstCareer);
  mkdirSync(out, {recursive: true});
  writeFileSync(resolve(out, "result.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
  rmSync(archiveRoot, {recursive: true, force: true});
}
