// SON KÖY: one command bar (every number once), capacity as a plan with
// stretch and reserve, and an urgent-vs-investment triage.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createTown,
  applyTownAction,
  actionInfo,
  normalizeTown,
  validateTown,
  nextCapacity,
  triage,
  BASE_CAPACITY,
  STRETCH_MAX,
  RESERVE_BONUS,
} from "../public/games/son-kasaba/sim.js";

const rich = () => {
  const s = createTown();
  s.budget = 10_000_000;
  return s;
};
const NPC_TALKS = (s) => s.npcs.filter((n) => n.present).map((n) => `talk:${n.id}`);

test("capacity can be stretched up to the limit, and next month pays for it", () => {
  const s = rich();
  const moves = ["civic:road", "civic:water", "civic:energy", "civic:support", "civic:festival", ...NPC_TALKS(s)];
  for (const m of moves) applyTownAction(s, `${m}@1`);
  assert.ok(s.capacityUsed > BASE_CAPACITY, `stretched to ${s.capacityUsed}`);
  assert.ok(s.capacityUsed <= BASE_CAPACITY + STRETCH_MAX);
  const over = s.capacityUsed - BASE_CAPACITY;
  assert.equal(nextCapacity(s), BASE_CAPACITY - over);
  assert.equal(validateTown(s), true, "a stretched month is a valid save");
  const before = JSON.stringify(s);
  for (const m of NPC_TALKS(s)) applyTownAction(s, `${m}@1`);
  if (s.capacityUsed === BASE_CAPACITY + STRETCH_MAX)
    assert.equal(actionInfo(s, "civic:cleanup").reason !== null, true, "nothing past the stretch limit");
  assert.equal(applyTownAction(s, "advance@1"), true);
  assert.equal(s.capacityMax, BASE_CAPACITY - over);
  assert.equal(s.capacityUsed, 0);
  assert.equal(validateTown(s), true);
  assert.ok(s.history.some((h) => /zorlandı|stretched/.test(JSON.stringify(h))));
  void before;
});

test("leaving four or more unused earns a reserve next month", () => {
  const s = rich();
  applyTownAction(s, "civic:road@1");
  applyTownAction(s, "civic:water@1");
  assert.equal(s.capacityUsed, 4);
  assert.equal(nextCapacity(s), BASE_CAPACITY + RESERVE_BONUS);
  applyTownAction(s, "advance@1");
  assert.equal(s.capacityMax, BASE_CAPACITY + RESERVE_BONUS);
  assert.equal(validateTown(s), true);
});

test("the stretch amount on an action is exactly what goes past the plan", () => {
  const s = rich();
  s.capacityUsed = 9;
  const a = actionInfo(s, "civic:road");
  assert.equal(a.reason, null);
  assert.equal(a.effort, 2);
  assert.equal(a.stretch, 1);
  assert.equal(actionInfo({ ...s, capacityUsed: 4 }, "civic:road").stretch, 0);
});

test("ten one-point actions in a month still make a valid save (was rejected at 8)", () => {
  const s = rich();
  s.used = Array.from({ length: 11 }, (_, i) => `talk:x${i}`);
  s.capacityUsed = 11;
  assert.equal(validateTown(s), true);
});

test("old saves without capacity fields load at the base capacity", () => {
  const s = createTown();
  delete s.capacityMax;
  delete s.capacityUsed;
  const n = normalizeTown("son-kasaba", JSON.parse(JSON.stringify(s)));
  assert.equal(n.capacityMax, BASE_CAPACITY);
  assert.equal(validateTown(n), true);
});

test("triage: lapsing agenda and failing infrastructure are urgent, the rest can wait", () => {
  const s = createTown();
  const open = s.events.find((e) => e.status === "open");
  assert.ok(open);
  open.expires = s.month + 1;
  s.metrics.road = 20;
  const q = triage(s);
  assert.ok(q.urgent.some((x) => x.kind === "event" && x.id === open.id));
  assert.ok(q.urgent.some((x) => x.kind === "civic" && x.id === "road"));
  for (const x of [...q.urgent, ...q.invest]) {
    assert.ok(Array.isArray(x.label) && x.label.length === 2, "bilingual label");
    assert.ok(["center", "agenda", "services", "investors"].includes(x.screen));
  }
  open.expires = s.month + 4;
  s.metrics.road = 80;
  assert.ok(triage(s).invest.some((x) => x.id === open.id));
});

test("the command bar is the only place budget, population, debt and month are shown", () => {
  const source = readFileSync(new URL("../public/games/son-kasaba/app.js", import.meta.url), "utf8");
  // The in-game screen only; the front menu's save-slot summary is a different screen.
  const app = source.slice(source.indexOf('class="game-root town-root"'));
  assert.doesNotMatch(app, /town-totals/, "masthead no longer repeats the numbers");
  for (const re of [/number\(s\.budget\)/g, /number\(s\.debt\)/g, /number\(population\(s\)\)/g, /\$\{s\.month\}\/24/g])
    assert.equal(app.match(re)?.length, 1, String(re));
  const pres = readFileSync(new URL("../public/games/son-kasaba/presentation.js", import.meta.url), "utf8");
  assert.doesNotMatch(pres, /1 karar/, "buttons state their real capacity cost");
});

test("triage drops what was already handled this month", () => {
  const s = rich();
  s.metrics.road = 20;
  assert.ok(triage(s).urgent.some((x) => x.id === "road"));
  assert.equal(applyTownAction(s, "civic:road@1"), true);
  assert.equal(triage(s).urgent.some((x) => x.kind === "civic" && x.id === "road"), false);
});
