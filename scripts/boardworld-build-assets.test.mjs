import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { packGameAssets } from "./boardworld-build-assets.mjs";
import * as sourceEngine from "../public/games/tc-sim-boardworld/engine.mjs";
import { chooseLanguage } from "../public/games/tc-sim-boardworld/i18n.mjs";
import { renderDistrictPulse } from "../public/games/tc-sim-boardworld/living-ui.mjs";

test("production packing preserves every translation, template precedence and deterministic gameplay", async () => {
  const directory = await mkdtemp(join(tmpdir(), "boardworld-pack-"));
  try {
    const report = await packGameAssets({ targetDir: directory });
    assert.ok(report.after.gzipBytes < report.before.gzipBytes * 0.94);
    assert.ok(report.after.initialTrGzipBytes < report.before.initialTrGzipBytes * 0.9);
    assert.deepEqual(
      report.after.assets.map((a) => a.file),
      report.before.assets.map((a) => a.file),
    );
    const load = async (dir, file) =>
      (await import(pathToFileURL(resolve(dir, file)).href)).default;
    const source = resolve("public/games/tc-sim-boardworld");
    const originalKeys = await load(source, "locale-keys.mjs"),
      packedKeys = await load(directory, "locale-keys.mjs");
    assert.deepEqual(
      packedKeys,
      originalKeys,
      "old cached key modules and template precedence remain compatible",
    );
    for (const language of ["en", "pl"]) {
      const original = await load(source, `locale-${language}.mjs`),
        packed = await load(directory, `locale-${language}.mjs`);
      const byKey = new Map(packedKeys.map((key, index) => [key, packed[index]]));
      assert.deepEqual(packed, original, "an old tab can load a new language without index drift");
      originalKeys.forEach((key, index) =>
        assert.equal(byKey.get(key), original[index], `${language}: ${key}`),
      );
    }
    const html = await readFile(join(directory, "index.html"), "utf8");
    assert.equal((html.match(/rel="stylesheet"/g) || []).length, 1);
    const engine = await import(pathToFileURL(join(directory, "engine.mjs")).href);
    assert.deepEqual(
      Object.keys(engine).sort(),
      Object.keys(sourceEngine).sort(),
      "public module API survives minification",
    );
    for (const scenario of ["graduate", "restart", "newcomer"]) {
      const options = {
        name: "Deniz",
        scenario,
        education: "highschool",
        trait: "balanced",
        seed: 613,
      };
      let original = sourceEngine.createGame(options),
        packed = engine.createGame(options);
      assert.deepEqual(packed, original);
      for (let turn = 0; turn < 12; turn++) {
        const available = sourceEngine.getActions(original).filter((a) => !a.disabled);
        const action =
          available.find((a) => a.category === "event") ||
          available.find((a) => a.id === "wait:15") ||
          available[0];
        assert.ok(action);
        const a = sourceEngine.resolveAction(original, action.id),
          b = engine.resolveAction(packed, action.id);
        assert.equal(a.ok, true);
        assert.equal(b.ok, true);
        assert.deepEqual(b.state, a.state, action.id);
        original = a.state;
        packed = b.state;
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("packing refuses to overwrite readable game sources", async () => {
  const source = resolve("public/games/tc-sim-boardworld");
  await assert.rejects(
    packGameAssets({ sourceDir: source, targetDir: source }),
    /never overwritten/,
  );
});

test("map signals derive only from public supply and confirmed commitments in all three languages", async () => {
  const market = {
    id: "kadikoy",
    foodStock: 40,
    materialStock: 12,
    foodPricePct: 96,
    materialPricePct: 105,
    effects: { serviceDelay: 15, jobOpenings: 2 },
  };
  const entries = [
    { district: "kadikoy", status: "counter", end: 200 },
    { district: "sisli", status: "confirmed", end: 200 },
  ];
  for (const lang of ["tr", "en", "pl"]) {
    await chooseLanguage(lang);
    const html = renderDistrictPulse(market, entries, 100);
    assert.ok(html.includes("96%") && html.includes("105%"));
    assert.match(html, /attention/);
    assert.ok(
      !/onaylı|confirmed|Potwierdzone/.test(html),
      "counter offers do not become obligations",
    );
    const booked = renderDistrictPulse(
      market,
      [...entries, { district: "kadikoy", status: "confirmed", end: 200 }],
      100,
    );
    assert.match(booked, /commitment/);
    const exhausted = renderDistrictPulse({ ...market, foodStock: 0 }, entries, 100);
    assert.ok(/tükendi|sold out|Brak/.test(exhausted));
  }
  assert.equal(renderDistrictPulse(null), "");
  await chooseLanguage("tr");
});
