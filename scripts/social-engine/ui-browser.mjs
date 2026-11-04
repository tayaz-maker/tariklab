import { decodeSaveText } from "../../src/games/social-engine/persistence/codec.ts";
import { stepWorld, canonicalState } from "../../src/games/social-engine/simulation/engine.ts";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const base = process.env.SE_BASE || "http://127.0.0.1:8097";
const out = "artifacts/social-engine/ui-browser";
await mkdir(out, { recursive: true });
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : chromium.executablePath());
const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  acceptDownloads: true,
});
await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
const page = await context.newPage(),
  errors = [],
  results = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.setDefaultTimeout(10000);
const manifestAtStart = await (
  await page.request.get(`${base}/games/social-engine/build-manifest.json`)
).json();
const state = () => page.evaluate(() => window.__socialEngine.state());
async function check(name, fn) {
  const started = performance.now();
  try {
    const detail = await fn();
    results.push({
      name,
      status: "PASS",
      duration_ms: performance.now() - started,
      ...(detail ? { detail } : {}),
    });
  } catch (error) {
    results.push({
      name,
      status: error.unverified ? "UNVERIFIED" : "FAIL",
      duration_ms: performance.now() - started,
      detail: error.message,
    });
    await page.screenshot({ path: `${out}/failure-${results.length}.png` });
  }
}
async function closeDialog() {
  const close = page.getByRole("button", { name: "Kapat", exact: true });
  if (await close.isVisible()) await close.click();
}
async function openMenu() {
  await closeDialog();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Bir nefes al" }).waitFor();
}
async function openSaves() {
  await openMenu();
  await page.getByRole("button", { name: "Kayıtlar & dışa aktarım", exact: true }).click();
  await page.getByRole("dialog", { name: "Kayıtlar", exact: true }).waitFor();
}
const slotRow = (id) => page.locator(".slot").filter({ has: page.locator(`[data-save="${id}"]`) });
try {
  await page.goto(`${base}/games/social-engine/index.html?qa=1`);
  await check(
    "invalid profile names and excessive attribute total are rejected through real form",
    async () => {
      await page.getByLabel("Karakter adı").fill("<script>");
      await page.getByRole("button", { name: "Hikâyene başla" }).click();
      assert.match(await page.locator("#form-error").innerText(), /Ad 2/);
      assert.equal(await page.locator("#intro").isVisible(), true);
      await page.getByLabel("Karakter adı").fill("Çağrı Test");
      for (const name of ["body", "mind", "social", "discipline"])
        await page.locator(`[name=${name}]`).fill("6");
      await page.getByRole("button", { name: "Hikâyene başla" }).click();
      assert.match(await page.locator("#form-error").innerText(), /toplam tam 12/);
      assert.equal(await page.evaluate(() => window.__socialEngine.projection()), null);
      for (const name of ["body", "mind", "social", "discipline"])
        await page.locator(`[name=${name}]`).fill("3");
    },
  );
  await check(
    "double submit creates one persistent player and preserves chosen profile",
    async () => {
      await page.getByLabel("Geçmiş").selectOption("graduate");
      await page.getByLabel("Görünüm").selectOption("3");
      await page.getByRole("button", { name: "Hikâyene başla" }).dblclick();
      await page.waitForFunction(() => window.__socialEngine.projection()?.population === 1100);
      const snapshot = await state();
      assert.equal(snapshot.player.name, "Çağrı Test");
      assert.equal(snapshot.player.profile.background, "graduate");
      assert.equal(snapshot.player.appearance, 3);
      assert.equal(snapshot.npcs.filter((n) => n.id === "player").length, 0);
      assert.equal(new Set(snapshot.npcs.map((n) => n.id)).size, 1100);
      assert.equal(await page.locator("#world canvas").count(), 1);
    },
  );
  await check("keyboard-only pause and menu navigation keep visible focus and resume", async () => {
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Bir nefes al" }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "close-panel");
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "resume");
    const outline = await page.locator("#resume").evaluate((el) => ({
      style: getComputedStyle(el).outlineStyle,
      width: getComputedStyle(el).outlineWidth,
    }));
    assert.notEqual(outline.style, "none");
    assert.notEqual(outline.width, "0px");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#panel").isVisible(), false);
    await page.keyboard.press("KeyP");
    await page.getByRole("dialog", { name: "Telefon", exact: true }).waitFor();
    await page.keyboard.press("Escape");
  });
  await check("HUD button keyboard focus survives periodic HUD updates", async () => {
    const map = page.locator("[data-panel=map]");
    await map.focus();
    await page.waitForTimeout(900);
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute("data-panel")),
      "map",
    );
    await page.keyboard.press("Enter");
    await page.getByRole("dialog", { name: "Mahalle haritası" }).waitFor();
    await page.keyboard.press("Escape");
  });
  await check("settings inputs allow Tab and Escape, dialog focus is contained", async () => {
    await openMenu();
    await page.getByRole("button", { name: "Erişilebilirlik & kontroller", exact: true }).click();
    const phone = page.locator("[data-key=phone]");
    await phone.focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "close-panel");
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute("data-key")),
      "phone",
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#panel").isVisible(), false);
  });
  await check("pause stops ticks and resume advances same world", async () => {
    await openMenu();
    await page.waitForTimeout(150);
    const before = await state();
    await page.waitForTimeout(650);
    assert.equal((await state()).tick, before.tick);
    await page.getByRole("button", { name: "Oyuna devam et", exact: true }).click();
    await page.waitForTimeout(400);
    assert.ok((await state()).tick > before.tick);
  });
  await check(
    "real save menu saves copies exports imports and deletes separate slots",
    async () => {
      await openSaves();
      await page.locator("[data-save=slot-1]").click();
      await page.locator("[data-load=slot-1]:not([disabled])").waitFor();
      await page.locator("[data-copy=slot-1]").click();
      await page.locator("[data-load=slot-2]:not([disabled])").waitFor();
      const downloadPromise = page.waitForEvent("download");
      await page.locator("[data-export=slot-1]").click();
      const downloaded = await downloadPromise;
      const exportPath = `${out}/ui-export.json`;
      await downloaded.saveAs(exportPath);
      const bytes = await readFile(exportPath);
      const chooserPromise = page.waitForEvent("filechooser");
      await page.locator("[data-import=slot-3]").click();
      const chooser = await chooserPromise;
      await chooser.setFiles({
        name: "social-engine.json",
        mimeType: "application/json",
        buffer: bytes,
      });
      await page.locator("[data-load=slot-3]:not([disabled])").waitFor();
      await page.locator("[data-load=slot-3]").click();
      await page.waitForFunction(() =>
        document.getElementById("panel").classList.contains("hidden"),
      );
      const loaded = await state();
      // A successful load resumes time. Compare to the actual exported snapshot,
      // plus every intervening authoritative tick (including autonomous quest escrow).
      const saved = (await decodeSaveText(bytes.toString("utf8"))).state;
      const copied = (await decodeSaveText(await page.evaluate(()=>window.__socialEngine.export("slot-2")))).state;
      const imported = (await decodeSaveText(await page.evaluate(()=>window.__socialEngine.export("slot-3")))).state;
      assert.equal(canonicalState(copied),canonicalState(saved),"copy preserves entire saved world");
      assert.equal(canonicalState(imported),canonicalState(saved),"import preserves entire saved world");
      assert.ok(loaded.tick >= saved.tick && loaded.tick - saved.tick < 1200,"unexpected restore time");
      while(saved.tick < loaded.tick) stepWorld(saved);
      assert.equal(loaded.player.name, saved.player.name);
      assert.deepEqual(loaded.accounts, saved.accounts);
      assert.deepEqual(loaded.relations, saved.relations);
      assert.deepEqual(loaded.player.inventory, saved.player.inventory);
      await openSaves();
      page.once("dialog", (dialog) => dialog.accept());
      await page.locator("[data-delete=slot-2]").click();
      await page.locator("[data-load=slot-2][disabled]").waitFor();
      assert.equal(await page.locator("[data-load=slot-1]").isEnabled(), true);
      assert.equal(await page.locator("[data-load=slot-3]").isEnabled(), true);
      assert.match(await slotRow("slot-2").innerText(), /Boş slot/);
      await closeDialog();
    },
  );
  await check("remapped inventory shortcut persists and reserved keys are rejected", async () => {
    await openMenu();
    await page.getByRole("button", { name: "Erişilebilirlik & kontroller", exact: true }).click();
    const binding = page.locator("[data-key=inventory]");
    await binding.focus();
    await page.keyboard.press("KeyW");
    assert.equal(await binding.inputValue(), "I");
    await page.keyboard.press("KeyO");
    assert.equal(await binding.inputValue(), "O");
    await page.keyboard.press("Escape");
    await page.keyboard.press("KeyO");
    await page.getByRole("dialog", { name: "Çanta & karakter", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("social-engine:settings")).inventory,
      ),
      "KeyO",
    );
  });
  await check("1280 and 1920 viewports retain reachable readable dialog controls", async () => {
    for (const size of [
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(size);
      await openSaves();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.locator("[data-import=auto]").scrollIntoViewIfNeeded();
      const box = await page.locator("[data-import=auto]").boundingBox();
      assert.ok(
        box &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= size.width &&
          box.y + box.height <= size.height,
      );
      await page.screenshot({ path: `${out}/saves-${size.width}.png` });
      await closeDialog();
    }
  });
  await check("200 percent UI scaling keeps settings and close action operable", async () => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openMenu();
    await page.getByRole("button", { name: "Erişilebilirlik & kontroller", exact: true }).click();
    await page.getByLabel("Arayüz ölçeği").selectOption("200");
    await page.locator("[data-key=phone]").scrollIntoViewIfNeeded();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.screenshot({ path: `${out}/ui-scale-200.png` });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#panel").isVisible(), false);
    await openMenu();
    await page.getByRole("button", { name: "Erişilebilirlik & kontroller", exact: true }).click();
    await page.getByLabel("Arayüz ölçeği").selectOption("100");
    await closeDialog();
    return "This is the in-game 200% UI scale; native browser 200% zoom remains separate and UNVERIFIED.";
  });
  await check(
    "actual background tab visibility pauses and resumes authoritative time",
    async () => {
      await closeDialog();
      const other = await context.newPage();
      await other.goto("about:blank");
      await other.bringToFront();
      await page.waitForTimeout(250);
      const hidden = await page.evaluate(() => document.hidden);
      if (!hidden) {
        await other.close();
        await page.bringToFront();
        throw Object.assign(
          new Error(
            "Headless browser keeps pages visible; actual tab-hidden behavior UNVERIFIED in this environment",
          ),
          { unverified: true },
        );
      }
      const before = (await state()).tick;
      await page.waitForTimeout(700);
      assert.equal((await state()).tick, before);
      await other.close();
      await page.bringToFront();
      await page.waitForTimeout(400);
      assert.ok((await state()).tick > before);
    },
  );
  await check("failed save-and-return preserves the running game", async () => {
    await openMenu();
    await page.evaluate(() => {
      window.__qaOriginalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === "revisions")
          throw new DOMException("QA quota exhaustion", "QuotaExceededError");
        return window.__qaOriginalPut.apply(this, args);
      };
    });
    try {
      await page.getByRole("button", { name: "Kaydet ve başlangıca dön", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Kayıt alınamadı" }).waitFor();
      assert.equal(await page.locator("#intro").isVisible(), false);
      assert.ok((await state()).player);
    } finally {
      await page.evaluate(() => {
        IDBObjectStore.prototype.put = window.__qaOriginalPut;
        delete window.__qaOriginalPut;
      });
    }
    await closeDialog();
  });
  // Every lifecycle action below uses visible DOM controls or physical keys. State hooks only observe.
  async function openLife() {
    await closeDialog();
    await page.keyboard.press("KeyP");
    await page.getByRole("button", { name: "Ev & eğitim", exact: true }).click();
    await page.getByRole("dialog", { name: "Ev, aile & eğitim", exact: true }).waitFor();
  }
  async function walkAndEnter(buildingId, door, name) {
    await closeDialog();
    if ((await state()).player.location.scene !== "outside") {
      // The school has nearby people; approach the visible exit rather than assume E chooses it from spawn.
      await page.keyboard.down("KeyA");
      await page.keyboard.down("KeyS");
      await page.waitForFunction(
        () => window.__socialEngine.projection()?.player.location.y >= 9.6,
        null,
        { timeout: 4000 },
      );
      await page.keyboard.up("KeyA");
      await page.keyboard.up("KeyS");
      await page.waitForTimeout(150);
      await page.keyboard.press("KeyE");
      await page.waitForFunction(
        () => window.__socialEngine.projection()?.player.location.scene === "outside",
      );
    }
    await page.keyboard.press("KeyM");
    await page.locator(`[data-go="${buildingId}"]`).click();
    await page.waitForFunction(
      ({ x, y }) => {
        const p = window.__socialEngine.projection()?.player;
        return (
          p?.location.scene === "outside" &&
          !p.path.length &&
          Math.hypot(p.location.x - x, p.location.y - y) < 0.9
        );
      },
      door,
      { timeout: 60000 },
    );
    await page.keyboard.press("KeyE");
    await page.getByRole("dialog", { name, exact: true }).waitFor();
    assert.equal((await state()).player.location.scene, buildingId);
  }
  await check(
    "real map navigation, residence reservation, funded lease and household controls share world state",
    async () => {
      await walkAndEnter("b-home", { x: 6.5, y: 13.7 }, "Yuva Apartmanı");
      await page
        .getByRole("button", { name: "Konut, ortak bütçe & sertifikalar", exact: true })
        .click();
      const before = await state();
      await page.locator('[data-property="vacant-home-0"][data-action="RESERVE_HOME"]').click();
      await page.waitForFunction(
        () =>
          window.__socialEngine.projection()?.life?.properties.find((p) => p.id === "vacant-home-0")
            ?.reservation?.householdId === "player-household",
      );
      await page.waitForTimeout(220);
      await page.locator('[data-property="vacant-home-0"][data-action="LEASE_HOME"]').click();
      await page.waitForFunction(
        () => window.__socialEngine.projection()?.player.homeId === "vacant-home-0",
      );
      const leased = await state();
      assert.equal(leased.accounts.player, before.accounts.player - 25000);
      const lease = leased.life.leases.find(
        (l) => l.householdId === "player-household" && l.status === "active",
      );
      assert.equal(leased.accounts[lease.depositAccount], 25000);
      await page.waitForTimeout(220);
      await page.locator('[data-life="HOUSEHOLD_DEPOSIT"]').click();
      await page.waitForFunction(
        () => window.__socialEngine.projection()?.life?.household.ownContribution === 10000,
      );
      await page.waitForTimeout(220);
      await page.locator('[data-life="HOUSEHOLD_WITHDRAW"]').click();
      await page.waitForFunction(
        () => window.__socialEngine.projection()?.life?.household.ownContribution === 0,
      );
      await page.waitForTimeout(220);
      assert.equal(await page.locator('[data-life="HOUSEHOLD_WITHDRAW"]').isDisabled(), true);
      assert.equal(await page.locator('[data-life="PAY_RENT_ARREARS"]').isDisabled(), true);
      assert.equal((await state()).accounts.player, leased.accounts.player);
      await page.screenshot({ path: `${out}/lifecycle-housing.png` });
    },
  );
  await check(
    "course cancellation and re-enrollment are genuine UI transitions with disclosed fees",
    async () => {
      await walkAndEnter("b-school", { x: 9, y: 49.7 }, "Ufuk Akademi");
      await page
        .getByRole("button", { name: "Konut, ortak bütçe & sertifikalar", exact: true })
        .click();
      await page.locator('[data-course="office-skills"][data-action="COURSE_ENROLL"]').click();
      await page.waitForFunction(
        () =>
          window.__socialEngine.projection()?.life?.courses.find((c) => c.id === "office-skills")
            ?.enrollment?.status === "enrolled",
      );
      await page.waitForTimeout(220);
      await page.locator('[data-course="office-skills"][data-action="COURSE_CANCEL"]').click();
      await page.getByText("Kayıt iptal edildi", { exact: false }).waitFor();
      assert.equal(
        (await state()).life.certificates.filter((c) => c.personId === "player").length,
        0,
      );
      await page.locator('[data-course="office-skills"][data-action="COURSE_ENROLL"]').click();
      await page.waitForFunction(
        () =>
          window.__socialEngine.projection()?.life?.courses.find((c) => c.id === "office-skills")
            ?.enrollment?.status === "enrolled",
      );
      const enrollments = (await state()).life.enrollments.filter(
        (e) => e.personId === "player" && e.courseId === "office-skills",
      );
      assert.deepEqual(
        enrollments.map((e) => e.status),
        ["cancelled", "enrolled"],
      );
    },
  );
  await check(
    "three actual timed attended lessons produce one certificate through live controls",
    async () => {
      for (let completed = 1; completed <= 3; completed++) {
        await openLife();
        await page.locator('[data-course="office-skills"][data-action="COURSE_ATTEND"]').click();
        await page.waitForFunction(() =>
          document.getElementById("panel").classList.contains("hidden"),
        );
        await page.waitForFunction(
          (count) =>
            window.__socialEngine.projection()?.life?.courses.find((c) => c.id === "office-skills")
              ?.enrollment?.attended === count,
          completed,
          { timeout: 45000 },
        );
        if (completed < 3) {
          await openLife();
          assert.match(
            await page.getByRole("dialog").innerText(),
            /Sonraki derse [1-9][0-9]* oyun dakikası/,
          );
          await closeDialog();
          await page.waitForFunction(
            () => {
              const v = window.__socialEngine.projection(),
                e = v.life.courses.find((c) => c.id === "office-skills").enrollment;
              return v.minute >= e.nextSessionAt;
            },
            null,
            { timeout: 20000 },
          );
        }
      }
      const world = await state();
      assert.equal(
        world.life.certificates.filter(
          (c) => c.personId === "player" && c.courseId === "office-skills",
        ).length,
        1,
      );
      await openLife();
      await page.getByText("Belge alındı", { exact: false }).waitFor();
      await page.screenshot({ path: `${out}/lifecycle-certificate.png` });
      return "No clock acceleration or command hooks: three real 30-game-minute sessions plus required intervals.";
    },
  );
  await check(
    "earned course certificate enables office job application through real building menu",
    async () => {
      await walkAndEnter("b-office", { x: 26.5, y: 31.7 }, "Kıyı Kooperatifi");
      await page.locator('[data-job="office"]').click();
      await page.waitForFunction(
        () => window.__socialEngine.projection()?.player.jobId === "office",
      );
      assert.ok(
        (await state()).businesses.find((b) => b.id === "office").employees.includes("player"),
      );
      await page.screenshot({ path: `${out}/lifecycle-office-job.png` });
      await closeDialog();
    },
  );
  // Inject one uncaught exception into the actual worker response, never into production files.
  let injected = false;
  const expectedErrors = [];
  const recoveryPage = await context.newPage();
  recoveryPage.on("pageerror", (error) => {
    if (error.message.includes("SOCIAL_ENGINE_QA_WORKER_CRASH")) expectedErrors.push(error.message);
    else errors.push(error.message);
  });
  recoveryPage.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("SOCIAL_ENGINE_QA_WORKER_CRASH"))
      errors.push(message.text());
  });
  await recoveryPage.route("**/worker-*.js", async (route) => {
    const response = await route.fetch(),
      source = await response.text();
    if (!injected) {
      injected = true;
      await route.fulfill({
        response,
        body: source + '\nsetTimeout(()=>{throw new Error("SOCIAL_ENGINE_QA_WORKER_CRASH")},1800);',
      });
    } else await route.fulfill({ response });
  });
  await check(
    "real worker uncaught exception pauses game and restart restores snapshot",
    async () => {
      await recoveryPage.goto(`${base}/games/social-engine/index.html?qa=1`);
      await recoveryPage.getByRole("button", { name: "Hikâyene başla" }).click();
      await recoveryPage
        .getByRole("alertdialog", { name: "Oyun duraklatıldı" })
        .waitFor({ timeout: 20000 });
      assert.match(
        await recoveryPage.getByRole("alertdialog").innerText(),
        /SOCIAL_ENGINE_QA_WORKER_CRASH/,
      );
      await recoveryPage
        .getByRole("button", { name: "Son sağlam noktadan devam et", exact: true })
        .click();
      await recoveryPage.waitForFunction(
        () =>
          window.__socialEngine.projection()?.population === 1100 &&
          document.getElementById("panel").classList.contains("hidden"),
      );
      const before = await recoveryPage.evaluate(() => window.__socialEngine.state());
      await recoveryPage.waitForTimeout(400);
      const after = await recoveryPage.evaluate(() => window.__socialEngine.state());
      assert.equal(before.player.name, after.player.name);
      assert.ok(after.tick > before.tick);
      assert.equal(await recoveryPage.locator("#world canvas").count(), 1);
      await recoveryPage.screenshot({ path: `${out}/worker-recovery.png` });
    },
  );
  await recoveryPage.close();
  results.push({
    name: "Native browser zoom 200%",
    status: "UNVERIFIED",
    detail:
      "In-game UI scale was exercised; native browser chrome zoom is not equivalent to device or CSS emulation.",
  });
} finally {
  const sources = {};
  for (const file of [
    "src/games/social-engine/ui/app.ts",
    "src/games/social-engine/ui/styles.css",
    "src/games/social-engine/worker/entry.ts",
    "src/games/social-engine/persistence/repository.ts",
  ])
    sources[file] = createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
  const manifestAtEnd = await (
    await page.request.get(`${base}/games/social-engine/build-manifest.json`)
  ).json();
  if (manifestAtStart.sourceDigest !== manifestAtEnd.sourceDigest)
    results.push({
      name: "Immutable build during UI run",
      status: "UNVERIFIED",
      detail:
        "Manifest changed during run; individual loaded bundle observations remain candidate evidence.",
    });
  const report = {
    manifestAtStart,
    manifestAtEnd,
    browser: browser.version(),
    base,
    build_sha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    source_status: "working tree candidate",
    sourceHashes: sources,
    results,
    consoleErrors: errors,
    status:
      results.some((r) => r.status === "FAIL") || errors.length ? "FAIL" : "PASS_WITH_UNVERIFIED",
    generatedAt: new Date().toISOString(),
  };
  await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2) + "\n");
  await context.tracing.stop({ path: `${out}/trace.zip` });
  await context.close();
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "FAIL") process.exitCode = 1;
}
