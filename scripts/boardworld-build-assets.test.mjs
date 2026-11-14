import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
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
      report.after.assets.map((a) => a.file).filter((f) => !/^(?:bw|expansion)-runtime-/.test(f)),
      report.before.assets.map((a) => a.file),
    );
    assert.equal(report.after.assets.filter((a) => a.file.startsWith("bw-runtime-")).length, 1);
    assert.equal(
      report.after.assets.filter((a) => a.file.startsWith("expansion-runtime-")).length,
      1,
    );
    assert.equal(
      report.after.gzipBytes,
      report.after.goldGzipBytes + report.after.expansionGzipBytes,
    );
    // Traverse static ESM imports and re-exports starting at the HTML entry. A
    // dynamic import is deliberately not traversed: it is the opt-in boundary.
    const visited = new Set();
    async function visit(file) {
      if (visited.has(file)) return;
      visited.add(file);
      const text = await readFile(join(directory, file), "utf8");
      const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      for (const node of ast.statements) {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const specifier = node.moduleSpecifier.text;
          if (specifier.startsWith("./")) await visit(specifier.slice(2));
        }
      }
    }
    await visit("app.mjs");
    assert.ok(
      ![...visited].some((file) => file.startsWith("expansion")),
      `Initial graph: ${[...visited]}`,
    );
    await visit("expansion-preview.mjs");
    assert.ok(
      !visited.has(report.modules.expansionRuntime),
      "The opt-in preview must not load simulation",
    );
    const runtime = report.modules.runtime;
    const runtimeText = await readFile(join(directory, runtime), "utf8");
    assert.match(runtimeText, /import\(["']\.\/expansion\.mjs["']\)/);
    assert.match(runtimeText, /import\(["']\.\/expansion-ui\.mjs["']\)/);
    assert.ok(
      report.after.initialTrGzipBytes <= 205874,
      `Gold initial TR gzip: ${report.after.initialTrGzipBytes}`,
    );
    const load = async (dir, file) =>
      (await import(pathToFileURL(resolve(dir, file)).href)).default;
    const source = resolve("public/games/tc-sim-boardworld");
    for (const { file } of report.before.assets.filter(
      (a) => a.file.endsWith(".mjs") && a.file !== "app.mjs",
    )) {
      const original = await import(pathToFileURL(resolve(source, file)).href);
      const built = await import(pathToFileURL(resolve(directory, file)).href);
      assert.deepEqual(Object.keys(built), Object.keys(original), `${file} public API`);
      const content = (value) =>
        JSON.stringify(value, (_, item) => (typeof item === "function" ? "[function]" : item));
      for (const key of Object.keys(original))
        if (typeof original[key] !== "function")
          assert.equal(content(built[key]), content(original[key]), `${file}:${key} content`);
    }
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
    await Promise.all([sourceEngine.loadExpansionRuntime(), engine.loadExpansionRuntime()]);
    let original = sourceEngine.expandGame(sourceEngine.createGame({ name: "Deniz", seed: 613 }));
    let packed = engine.expandGame(engine.createGame({ name: "Deniz", seed: 613 }));
    for (let turn = 0; turn < 36; turn++) {
      assert.deepEqual(packed, original, `Deferred expansion replay turn ${turn}`);
      const available = sourceEngine.getActions(original).filter((action) => !action.disabled);
      const action =
        available.find((a) => a.category === "event") ||
        available.find((a) => a.id === "wait:15") ||
        available[0];
      assert.ok(action);
      const a = sourceEngine.resolveAction(original, action.id);
      const b = engine.resolveAction(packed, action.id);
      assert.equal(a.ok, true);
      assert.equal(b.ok, true);
      original = a.state;
      packed = b.state;
    }
    assert.deepEqual(packed, original);
    // A cached core must never attach an expansion imported against another
    // core instance after a deployment, even when both expose the same schema.
    const mixedDirectory = join(directory, "mixed");
    await mkdir(mixedDirectory);
    await copyFile(join(directory, runtime), join(mixedDirectory, runtime));
    await copyFile(join(directory, "engine.mjs"), join(mixedDirectory, "engine.mjs"));
    await writeFile(
      join(mixedDirectory, "expansion.mjs"),
      `export * from ${JSON.stringify(pathToFileURL(join(directory, "expansion.mjs")).href)};`,
    );
    const mixed = await import(pathToFileURL(join(mixedDirectory, "engine.mjs")).href);
    const gold = mixed.createGame({ seed: 613 });
    const bytes = JSON.stringify(gold);
    await assert.rejects(mixed.loadExpansionRuntime(), /Reload Boardworld/);
    assert.equal(JSON.stringify(gold), bytes);
    assert.ok(mixed.validateState(gold));
    assert.ok(
      report.after.goldGzipBytes <= 301836,
      `Gold aggregate gzip: ${report.after.goldGzipBytes}`,
    );
    assert.ok(
      report.after.expansionGzipBytes <= 40217,
      `Expansion gzip: ${report.after.expansionGzipBytes}`,
    );
    assert.ok(report.after.gzipBytes <= 342048, `Combined gzip: ${report.after.gzipBytes}`);
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
