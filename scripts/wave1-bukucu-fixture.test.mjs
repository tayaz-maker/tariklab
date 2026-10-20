import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { loadStrategy } from "./strategy-harness.mjs";

const runner = readFileSync(new URL("./bukucu-qa.mjs", import.meta.url), "utf8");
const gameFile = new URL("../public/games/bukucu/index.html", import.meta.url);
const SLOT = "tariklab::bukucu:1";
const ACTIVE = "tariklab::bukucu:active";
const MIGRATED = "tariklab::bukucu:legacy-migrated";
const clone = (value) => JSON.parse(JSON.stringify(value));

// Execute the runner's actual helpers without launching its full browser suite.
// The page bridge uses the real game's storage migration and bootState functions.
const resume = vm.runInNewContext(
  `(${runner.slice(runner.indexOf("async function resume("), runner.indexOf("const snap ="))})`,
);
const snap = vm.runInNewContext(
  runner.slice(runner.indexOf("const snap ="), runner.indexOf("const tap =")) + "snap;",
);
const blank = vm.runInNewContext(
  runner.slice(runner.indexOf("const blank ="), runner.indexOf("const tiles =")) + "blank;",
);

function fixturePage() {
  const game = loadStrategy(gameFile);
  const reload = () => game.ev("migrateBukucuSlots(); S = null; view = 'menu'; paintMenu();");
  game.context.location.reload = reload;
  game.doc.querySelector = (selector) => {
    if (selector === '#menu button[data-act="cont"]' && game.ev("loadRaw()")) {
      return {
        disabled: false,
        click: () => game.ev("bootState(JSON.parse(loadRaw()))"),
      };
    }
    return null;
  };
  const page = {
    async evaluate(fn, arg) {
      return vm.runInContext(`(${fn.toString()})(${JSON.stringify(arg) ?? "undefined"})`, game.context);
    },
    async reload() { reload(); },
    async waitForTimeout() {},
    async waitForSelector(selector) {
      assert.ok(game.doc.querySelector(selector), "Continue must exist for the seeded fixture");
    },
  };
  return { game, page };
}

test("QA resume loads slot 1 after fresh boot has already consumed legacy migration", async () => {
  const { game, page } = fixturePage();
  assert.equal(game.store.get(MIGRATED), "1");
  assert.equal(game.store.has(SLOT), false);
  const expected = blank({ cash: [321, 987], pos: [1, 0], wait: "buy", focus: 1 });
  await resume(page, expected);
  assert.ok(game.ev("S"), "resume must load a game, not silently leave the menu open");
  assert.deepEqual(clone(game.ev("S.cash")), clone(expected.cash));
  assert.equal(game.store.get(MIGRATED), "1", "normal fixtures must not reset legacy migration");
});

test("QA resume selects slot 1 without overwriting another active slot", async () => {
  const { game, page } = fixturePage();
  const otherSlot = JSON.stringify(blank({ cash: [888, 999] }));
  game.store.set("tariklab::bukucu:3", otherSlot);
  game.store.set(ACTIVE, "3");
  const expected = blank({ cash: [321, 987], pos: [1, 0], wait: "buy", focus: 1 });

  await resume(page, expected);

  const loaded = game.ev("S");
  assert.ok(loaded, "resume must load a game, not silently leave the menu open");
  assert.deepEqual(clone(loaded.cash), clone(expected.cash));
  assert.deepEqual(clone(loaded.pos), clone(expected.pos));
  assert.equal(loaded.wait, "buy");
  assert.equal(game.store.get(ACTIVE), "1");
  assert.equal(game.store.get(MIGRATED), "1", "normal fixtures must not reset legacy migration");
  assert.equal(game.store.get("tariklab::bukucu:3"), otherSlot, "other slots stay intact");
  assert.deepEqual(JSON.parse(game.store.get(SLOT)).cash, clone(expected.cash));
});

test("QA snapshot reads the canonical slot even when the legacy mirror differs", async () => {
  const { game, page } = fixturePage();
  const expected = blank({ cash: [765, 432], turn: 1 });
  game.store.set(SLOT, JSON.stringify(expected));
  game.store.set("smb.v1", JSON.stringify(blank({ cash: [1, 2] })));

  const snapshot = await snap(page);

  assert.deepEqual(clone(snapshot.S), clone(expected));
});

test("QA resume fails explicitly when Continue is unavailable", async () => {
  const { game, page } = fixturePage();
  game.doc.querySelector = () => null;
  await assert.rejects(resume(page, blank()), /Continue|Devam/);
});
