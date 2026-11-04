// A/B diagnostic only: modifies one HTTP response in a private headless context.
// Does NOT change served files, the frozen candidate, or acceptance evidence.
import { chromium } from "playwright";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
assert.equal(process.platform, "darwin");
const compact = process.env.SE_COMPACT_ATLAS_DIR;
const root = compact
  ? "artifacts/social-engine/render-memory-compact-experiment"
  : "artifacts/social-engine/render-memory-experiment";
await mkdir(root, { recursive: true });
const manifest = JSON.parse(await readFile("public/games/social-engine/build-manifest.json"));
const code = await readFile("public/games/social-engine/" + manifest.entry, "utf8");
const needle = "antialias:!0,autoDensity:!0";
assert.equal(code.split(needle).length, 2, "Only the authored renderer option may change");
const report = {
  scope:
    "EXPERIMENT_ONLY; private-response MSAA/atlas overrides, not a published or acceptance-tested candidate",
  compactAtlas: compact || null,
  startedAt: new Date().toISOString(),
  originalAppSha256: createHash("sha256").update(code).digest("hex"),
  samples: [],
};
for (const [index, antialias] of (compact
  ? [false, false]
  : [true, false, false, true]
).entries()) {
  const label = `${index + 1}-${antialias ? "AA" : "no-AA"}`;
  const server = await chromium.launchServer({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  let browser;
  try {
    browser = await chromium.connect(server.wsEndpoint());
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    if (!antialias)
      await context.route("**/" + manifest.entry, (r) =>
        r.fulfill({
          contentType: "text/javascript",
          body: code.replace(needle, "antialias:!1,autoDensity:!0"),
        }),
      );
    if (compact) {
      const atlasAsset = manifest.playableAssets.find((a) => a.file.endsWith(".json"));
      const atlas = JSON.parse(await readFile("public/games/social-engine/" + atlasAsset.file));
      const packed = JSON.parse(await readFile(compact + "/atlas.json"));
      for (const group of ["buildings", "actors"]) {
        const body = await readFile(compact + "/" + packed[group].image);
        packed[group].image = atlas[group].image;
        await context.route("**/" + atlas[group].image, (r) =>
          r.fulfill({ contentType: "image/png", body }),
        );
      }
      await context.route("**/" + atlasAsset.file, (r) =>
        r.fulfill({ contentType: "application/json", body: JSON.stringify(packed) }),
      );
    }
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:8097/games/social-engine/index.html?qa=1");
    await page.locator("[name=name]").fill("Bellek Ölçümü");
    await page.getByRole("button", { name: "Hikâyene başla" }).click();
    await page.waitForFunction(() => window.__socialEngine?.projection()?.population === 1100);
    await page.evaluate(() => window.__socialEngine.pause(true));
    const step = (n) => page.evaluate((n) => window.__socialEngine.step(n), n);
    const command = (type, args) =>
      page.evaluate(({ type, args }) => window.__socialEngine.command(type, args), { type, args });
    const initial = await page.evaluate(() => window.__socialEngine.state());
    await step(1000 - initial.tick);
    assert.equal((await command("MOVE_TO", { x: 6.5, y: 13.7 })).ok, true);
    await step(1000);
    for (let cycle = 0; cycle < 10; cycle++) {
      assert.equal((await command("ENTER", { buildingId: "b-home" })).ok, true);
      await step(1);
      await page.waitForTimeout(100);
      assert.equal((await command("EXIT", {})).ok, true);
      await step(1);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(30000);
    const cdp = await context.newCDPSession(page);
    await cdp.send("HeapProfiler.collectGarbage");
    const metrics = await page.evaluate(() => window.__socialEngine.metrics());
    const state = await page.evaluate(() => window.__socialEngine.state());
    const rows = execFileSync("ps", ["-axo", "pid=,ppid=,comm="], { encoding: "utf8" })
      .split("\n")
      .map((s) => s.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/))
      .filter(Boolean)
      .map((m) => ({ pid: Number(m[1]), parent: Number(m[2]), command: m[3] }));
    const owned = new Set([server.process().pid]);
    for (let i = 0; i < 10; i++) for (const p of rows) if (owned.has(p.parent)) owned.add(p.pid);
    const pids = rows
      .filter((p) => owned.has(p.pid) && p.command.includes("Google Chrome"))
      .map((p) => p.pid);
    assert.ok(pids.length > 0);
    const result = spawnSync(
      "/usr/bin/footprint",
      [
        "--noCategories",
        "-j",
        `${root}/${label}.raw.json`,
        ...pids.flatMap((p) => ["-p", String(p)]),
      ],
      { timeout: 45000, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    const footprint = JSON.parse(await readFile(`${root}/${label}.raw.json`));
    await page.screenshot({ path: `${root}/${label}.png` });
    const sample = {
      label,
      antialias,
      tick: state.tick,
      player: state.player.location,
      headless: true,
      viewport: { width: 1920, height: 1080, dpr: 1 },
      errors,
      totalFootprintMiB: footprint["total footprint"] / 1048576,
      processes: footprint.processes.map((p) => ({ name: p.name, MiB: p.footprint / 1048576 })),
      renderer: metrics.renderer,
      measuredAt: new Date().toISOString(),
    };
    assert.deepEqual(errors, []);
    report.samples.push(sample);
    console.log(JSON.stringify({ label, MiB: sample.totalFootprintMiB, tick: state.tick }));
  } catch (e) {
    report.samples.push({ label, antialias, status: "FAIL", reason: e.message });
    process.exitCode = 1;
  } finally {
    await browser?.close();
    await server.close();
  }
  await writeFile(`${root}/results.json`, JSON.stringify(report, null, 2) + "\n");
}
report.finishedAt = new Date().toISOString();
await writeFile(`${root}/results.json`, JSON.stringify(report, null, 2) + "\n");
