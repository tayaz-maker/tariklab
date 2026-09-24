// SON KÖY: crisis, investment and upkeep share one loop through the maintenance
// backlog. Quick patches relieve today and cost tomorrow; full repairs cost now
// and work the backlog down. The plan never suggests handled or finished work.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createTown,
  applyTownAction,
  actionInfo,
  normalizeTown,
  validateTown,
  economy,
  triage,
  maintenanceForecast,
  ensureMaintenance,
  backlogCost,
  PATCHES,
  FULL_REPAIR_RELIEF,
  BACKLOG_BREAKDOWN,
  BACKLOG_CRITICAL,
  BACKLOG_FREE,
  MAINTENANCE_START,
} from "../public/games/son-kasaba/sim.js";
import { townPanel, NAV } from "../public/games/son-kasaba/presentation.js";

const rich = () => {
  const s = createTown();
  s.budget = 10_000_000;
  return s;
};
const close = (s) => assert.equal(applyTownAction(s, `advance@${s.month}`), true);

test("a new town starts with a modest backlog inside the free band", () => {
  const s = createTown();
  assert.equal(s.maintenance.backlog, MAINTENANCE_START);
  assert.ok(MAINTENANCE_START < BACKLOG_FREE);
  assert.equal(economy(s).costs.backlog, 0);
  assert.equal(validateTown(s), true);
});

test("quick patch: relief now, a return later and a bigger backlog", () => {
  const s = rich();
  s.metrics.road = 40;
  const p = PATCHES.road;
  const a = actionInfo(s, "patch:road");
  assert.equal(a.reason, null);
  assert.equal(a.effort, 1);
  assert.ok(a.cost < actionInfo(s, "civic:road").cost / 2, "a patch is the cheap option");
  assert.equal(applyTownAction(s, "patch:road@1"), true);
  assert.equal(s.metrics.road, 40 + p.now);
  assert.equal(s.maintenance.backlog, MAINTENANCE_START + p.backlog);
  assert.deepEqual(s.maintenance.patches, [{ id: "road", at: 1 + p.after, amount: p.back }]);
  assert.equal(applyTownAction(s, "patch:road@1"), false, "one patch per street per month");
  let roadBeforeReturn = null;
  for (let i = 0; i < p.after; i += 1) {
    if (s.month === p.after) roadBeforeReturn = s.metrics.road;
    close(s);
  }
  assert.equal(s.maintenance.patches.length, 0, "the patch came back and is gone");
  assert.ok(s.history.some((h) => /Yama geri döndü/.test(JSON.stringify(h))));
  assert.ok(roadBeforeReturn !== null);
});

test("full repair costs more now and works the backlog down", () => {
  const s = rich();
  s.maintenance.backlog = 30;
  applyTownAction(s, "civic:road@1");
  assert.equal(s.maintenance.backlog, 30 - FULL_REPAIR_RELIEF.road);
  const t = rich();
  t.maintenance.backlog = 30;
  const before = t.buildings.find((b) => b.id === "clinic").condition;
  applyTownAction(t, "repair:clinic@1");
  assert.equal(t.maintenance.backlog, 26);
  assert.equal(t.buildings.find((b) => b.id === "clinic").condition, before + 30);
});

test("short-term relief vs long-term health: patching every month loses to repairing", () => {
  const run = (plan) => {
    const s = rich();
    for (let m = 1; m <= 12; m += 1) {
      for (const cmd of plan(s)) applyTownAction(s, `${cmd}@${s.month}`);
      close(s);
    }
    return s;
  };
  const patcher = run(() => ["patch:road", "patch:water", "patch:energy"]);
  const repairer = run((s) =>
    ["road", "water", "energy"].filter((k) => s.metrics[k] < 70).map((k) => `civic:${k}`),
  );
  assert.ok(
    patcher.maintenance.backlog > repairer.maintenance.backlog + 20,
    "patching builds the backlog",
  );
  assert.ok(
    economy(patcher).costs.backlog > economy(repairer).costs.backlog,
    "and the backlog is billed monthly",
  );
  const infra = (s) => s.metrics.road + s.metrics.water + s.metrics.energy;
  assert.ok(infra(repairer) > infra(patcher), "a year of patches leaves weaker lines");
  const first = rich();
  first.metrics.road = 40;
  assert.ok(
    actionInfo(first, "patch:road").cost < actionInfo(first, "civic:road").cost,
    "but today the patch is cheaper",
  );
});

test("crisis: past the threshold a breakdown hits the weakest line, at most every three months", () => {
  const s = rich();
  s.maintenance.backlog = BACKLOG_BREAKDOWN + 5;
  s.metrics.road = 60;
  s.metrics.water = 30;
  s.metrics.energy = 60;
  close(s);
  assert.ok(s.metrics.water <= 30 - 2 - 12, "the weakest line took the hit");
  assert.equal(s.maintenance.lastBreak, 1);
  const water = s.metrics.water;
  close(s);
  assert.ok(s.metrics.water >= water - 2, "no second breakdown the next month");
  assert.equal(s.chains["maintenance-debt"].stage, "risk");
  const c = rich();
  c.maintenance.backlog = BACKLOG_CRITICAL + 5;
  const worst = c.buildings.filter((b) => b.open).sort((a, b) => a.condition - b.condition)[0];
  const before = worst.condition;
  close(c);
  assert.ok(c.buildings.find((b) => b.id === worst.id).condition <= before - 15);
  assert.equal(c.chains["maintenance-debt"].stage, "crisis");
});

test("investment adds load: accepted investors grow the backlog", () => {
  const s = rich();
  const base = maintenanceForecast(s).growth;
  s.investors[0].status = "accepted";
  s.investors[1].status = "accepted";
  assert.equal(maintenanceForecast(s).growth, base + 1);
});

test("the plan never suggests handled or finished work, and flags the backlog when it matters", () => {
  const s = rich();
  s.metrics.road = 20;
  s.maintenance.backlog = BACKLOG_BREAKDOWN;
  let q = triage(s);
  assert.ok(q.urgent.some((x) => x.kind === "backlog" && x.screen === "services"));
  assert.ok(q.urgent.some((x) => x.id === "road"));
  applyTownAction(s, "civic:road@1");
  q = triage(s);
  assert.equal(
    q.urgent.some((x) => x.id === "road"),
    false,
    "handled this month",
  );
  s.metrics.road = 100;
  s.metrics.water = 100;
  s.metrics.energy = 100;
  for (const id of ["road", "water", "energy"])
    assert.ok(actionInfo(s, `patch:${id}`).reason, "no patch on a finished line");
  s.maintenance.backlog = 5;
  assert.equal(
    triage(s).urgent.some((x) => x.kind === "backlog"),
    false,
  );
  assert.equal(
    triage(s).invest.some((x) => x.kind === "backlog"),
    false,
  );
});

test("saves: old towns get a backlog; bad backlog data is clamped, not trusted", () => {
  const s = createTown();
  delete s.maintenance;
  const n = normalizeTown("son-kasaba", JSON.parse(JSON.stringify(s)));
  assert.deepEqual(n.maintenance, { backlog: MAINTENANCE_START, patches: [], lastBreak: 0 });
  assert.equal(validateTown(n), true);
  const bad = createTown();
  bad.maintenance = {
    backlog: 900,
    patches: [{ id: "road", at: 3, amount: -99 }, { id: "moon", at: 2, amount: -1 }, "x"],
    extra: 1,
  };
  ensureMaintenance(bad);
  assert.equal(bad.maintenance.backlog, 100);
  assert.deepEqual(bad.maintenance.patches, [{ id: "road", at: 3, amount: -20 }]);
  assert.equal("extra" in bad.maintenance, false);
  assert.equal(backlogCost(BACKLOG_FREE), 0);
  assert.ok(backlogCost(BACKLOG_FREE + 10) > 0);
});

test("UI: the plan shows the backlog once; the header does not grow; every screen renders", () => {
  globalThis.window = { tlabI18n: { getLang: () => "tr", phrase: (x) => x } };
  const s = rich();
  s.ui.screen = "center";
  const center = townPanel(s);
  assert.equal((center.match(/month-plan__backlog/g) || []).length, 1);
  s.ui.screen = "services";
  const services = townPanel(s);
  assert.match(services, /data-command="patch:road"/);
  assert.match(services, /bakım borcu −6|backlog −6/);
  for (const [screen] of NAV) {
    s.ui.screen = screen;
    assert.doesNotMatch(townPanel(s), /undefined|NaN|\[object Object\]/, screen);
  }
  const app = readFileSync(new URL("../public/games/son-kasaba/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /backlog|bakım borcu/i, "the command bar stays as it was");
  delete globalThis.window;
});
