import test from "node:test";
import assert from "node:assert/strict";
import {
  createTown,
  validateTown,
  normalizeTown,
  applyTownAction,
  advanceTown,
  actionInfo,
  population,
  indicators,
  endingFor,
  eventEligible,
  refreshTown,
  economy,
} from "../public/games/son-kasaba/sim.js";
import {
  BUILDINGS,
  NPCS,
  GROUPS,
  INVESTORS,
  EVENTS,
  ENDINGS,
  IDENTITIES,
} from "../public/games/son-kasaba/data.js";
import { townPanel, NAV, help } from "../public/games/son-kasaba/presentation.js";
const copy = (s) => JSON.parse(JSON.stringify(s));
test("canonical town content is complete and bilingual with distinct state-driven event chains", () => {
  assert.equal(BUILDINGS.length, 13);
  assert.equal(NPCS.length, 12);
  assert.equal(GROUPS.length, 9);
  assert.equal(INVESTORS.length, 7);
  assert.ok(EVENTS.length >= 45);
  assert.equal(Object.keys(ENDINGS).length, 7);
  assert.equal(new Set(EVENTS.map((e) => e.id)).size, EVENTS.length);
  assert.equal(new Set(EVENTS.map((e) => e.text[0])).size, EVENTS.length);
  for (const e of EVENTS) {
    assert.ok(e.title[0] && e.title[1] && e.text[0] !== e.text[1]);
    assert.ok(e.choices.every((c) => Object.keys(c.effects).length));
    assert.ok(e.choices[0].delay > 0);
    assert.ok(e.choices[0].text.every((x) => x.length > 15));
  }
});
test("field capacity, stale/double tick, repeated loans, investor and event transactions cannot duplicate", () => {
  const s = createTown();
  const p = s.budget;
  assert.equal(applyTownAction(s, "civic:loan@1"), true);
  assert.equal(s.budget, p + 30000);
  const after = copy(s);
  assert.equal(applyTownAction(s, "civic:loan@1"), false);
  assert.deepEqual(s, after);
  applyTownAction(s, "civic:road@1");
  applyTownAction(s, "civic:water@1");
  assert.equal(applyTownAction(s, "talk:cem@1"), true);
  assert.ok(s.capacityUsed > 3);
  const capped = copy(s);
  assert.equal(applyTownAction(s, "talk:cem@1"), false);
  assert.deepEqual(s, capped);
  assert.equal(applyTownAction(s, "advance@1"), true);
  const next = copy(s);
  assert.equal(applyTownAction(s, "advance@1"), false);
  assert.equal(applyTownAction(s, "repair:clinic@1"), false);
  assert.deepEqual(s, next);
});
test("invalid actions and insufficient budget never partially mutate a town", () => {
  const s = createTown();
  s.budget = 0;
  for (const a of [
    "repair:school",
    "talk:ghost",
    "event:road:ghost",
    "investor:hotel:accept",
    "coalition:young:young",
    "civic:unknown",
  ]) {
    const before = copy(s);
    assert.equal(applyTownAction(s, a), false, a);
    assert.deepEqual(s, before, a);
  }
});
test("fully restored infrastructure cannot consume budget and capacity for no benefit", () => {
  const s = createTown();
  s.metrics.water = 100;
  const before = copy(s);
  assert.ok(actionInfo(s, "civic:water").reason);
  assert.equal(applyTownAction(s, "civic:water"), false);
  assert.deepEqual(s, before);
  s.metrics.water = 99;
  assert.equal(applyTownAction(s, "civic:water"), true);
  assert.equal(s.metrics.water, 100);
});
test("road → supply → price → household migration is a mechanical chain", () => {
  const broken = createTown(),
    repaired = copy(broken);
  broken.metrics.road = 10;
  repaired.metrics.road = 90;
  for (let i = 0; i < 4; i++) {
    advanceTown(broken);
    advanceTown(repaired);
  }
  assert.ok(broken.metrics.supply < repaired.metrics.supply);
  assert.ok(broken.metrics.prices > repaired.metrics.prices);
  assert.ok(population(broken) < population(repaired));
  assert.ok(broken.history.some((r) => r.type === "chain"));
});
test("school closure drives teacher departure and family migration, repairs permit return", () => {
  const s = createTown(),
    good = copy(s);
  s.buildings.find((b) => b.id === "school").open = false;
  advanceTown(s);
  advanceTown(good);
  assert.equal(s.npcs.find((n) => n.id === "elif").present, false);
  assert.equal(indicators(s).school, 0);
  advanceTown(s);
  advanceTown(good);
  assert.ok(
    s.cohorts.find((c) => c.id === "families").count <
      good.cohorts.find((c) => c.id === "families").count,
  );
  s.budget = 50000;
  applyTownAction(s, "repair:school");
  advanceTown(s);
  applyTownAction(s, "toggle:school");
  assert.equal(s.npcs.find((n) => n.id === "elif").present, true);
});
test("healthcare loss drives retiree departure and trust damage", () => {
  const s = createTown(),
    good = copy(s);
  for (const id of ["clinic", "pharmacy"]) s.buildings.find((b) => b.id === id).open = false;
  s.metrics.health = 0;
  s.metrics.supply = 0;
  for (let i = 0; i < 6; i++) {
    advanceTown(s);
    advanceTown(good);
  }
  assert.ok(
    s.cohorts.find((c) => c.id === "retired").count <
      good.cohorts.find((c) => c.id === "retired").count,
  );
  assert.ok(indicators(s).health < indicators(good).health);
});
test("each event's action and decline are real, state-gated and delayed effects apply once after save", () => {
  for (const d of EVENTS) {
    const s = createTown();
    s.month = d.month;
    s.completedMonths = d.month - 1;
    s.budget = 300000;
    s.events = [{ id: d.id, status: "open", opened: s.month, expires: s.month + 3 }];
    s.seenEvents = [d.id];
    const before = copy(s);
    assert.equal(applyTownAction(s, `event:${d.id}:act`), true, d.id);
    assert.notDeepEqual(
      [s.metrics, s.budget, s.debt],
      [before.metrics, before.budget, before.debt],
      d.id,
    );
    assert.equal(s.pending.length, 1);
    const p = copy(s);
    assert.equal(applyTownAction(s, `event:${d.id}:act`), false);
    assert.deepEqual(s, p);
    let restored = normalizeTown("son-kasaba", copy(s));
    assert.ok(restored, d.id);
    for (let i = 0; i < d.choices[0].delay + 1; i++) advanceTown(restored);
    assert.equal(
      restored.history.filter((r) => r.type === "callback" && r.text[0] === d.choices[0].text[0])
        .length,
      1,
      d.id,
    );
    const declined = copy(before);
    applyTownAction(declined, `event:${d.id}:decline`);
    assert.notDeepEqual(declined.metrics, s.metrics, d.id);
  }
  const s = createTown();
  assert.equal(
    eventEligible(
      s,
      EVENTS.find((e) => e.id === "town-charter"),
    ),
    false,
  );
});
test("investor accept, negotiate and reject have irreversible trade-offs and no grant repeat", () => {
  for (const choice of ["accept", "negotiate", "reject"]) {
    const s = createTown();
    s.month = 10;
    s.completedMonths = 9;
    for (const key of ["trust", "reputation", "services", "water", "energy", "health", "school"])
      s.metrics[key] = 80;
    for (const building of s.buildings) {
      building.open = true;
      building.condition = 80;
    }
    refreshTown(s);
    const before = s.budget;
    assert.equal(applyTownAction(s, `investor:mine:${choice}`), true);
    if (choice === "accept") {
      assert.equal(s.budget, before + 160000);
      assert.ok(s.metrics.company > 0 && s.metrics.pollution > 20);
      assert.equal(s.buildings.find((b) => b.id === "factory").open, true);
    }
    if (choice === "negotiate") {
      assert.equal(s.budget, before - 5000);
      assert.equal(s.investors.find((i) => i.id === "mine").negotiated, true);
      advanceTown(s);
      assert.equal(applyTownAction(s, "investor:mine:accept"), true);
      assert.equal(s.investors.find((i) => i.id === "mine").status, "accepted");
    }
    const saved = copy(s);
    assert.equal(applyTownAction(s, `investor:mine:${choice}`), false);
    assert.deepEqual(s, saved);
  }
});
test("NPC memory, connected people and three-month coalitions affect town outcomes", () => {
  const s = createTown();
  applyTownAction(s, "talk:cem");
  const n = s.npcs.find((n) => n.id === "cem");
  assert.ok(n.memory.length && n.trust > 45);
  assert.ok(s.npcs.find((n) => n.id === "baran").trust > 45);
  const other = copy(s);
  applyTownAction(s, "coalition:workers:green");
  advanceTown(s);
  advanceTown(other);
  assert.ok(s.buildings[0].condition > other.buildings[0].condition);
  assert.equal(s.coalitions.length, 1);
});
test("all seven finals are deterministic and reachable through valid final-month fixtures", () => {
  const presets = {
    reborn: (s) => {
      for (const k of [
        "trust",
        "health",
        "school",
        "services",
        "water",
        "energy",
        "jobs",
        "social",
      ])
        s.metrics[k] = 85;
      for (const b of s.buildings) {
        b.open = true;
        b.condition = 90;
      }
    },
    soulless: (s) => {
      s.budget = 400000;
      s.metrics.localIdentity = 20;
    },
    quiet: (s) => {
      s.cohorts.find((c) => c.id === "young").count = 10;
      s.cohorts.find((c) => c.id === "educated").count = 10;
    },
    ghost: (s) => {
      s.cohorts.forEach((c) => (c.count = 15));
    },
    sold: (s) => {
      s.metrics.company = 70;
    },
    resistant: (s) => {
      s.metrics.trust = 50;
      s.metrics.localIdentity = 80;
    },
    divided: (s) => {
      s.metrics.inequality = 80;
    },
  };
  for (const [id, prepare] of Object.entries(presets)) {
    const s = createTown();
    s.month = 24;
    s.completedMonths = 23;
    s.events = [];
    s.pending = [];
    prepare(s);
    assert.ok(validateTown(s), id);
    advanceTown(s);
    assert.equal(s.ending.id, id);
    assert.deepEqual(s.ending, endingFor(s));
    const end = copy(s);
    assert.equal(applyTownAction(s, "advance@24"), false);
    assert.deepEqual(s, end);
    assert.ok(normalizeTown("son-kasaba", copy(s)), id);
  }
});
test("corrupt, partial, cross-game and nonfinite saves reject without a new town; pending and slots roundtrip", () => {
  assert.equal(normalizeTown("son-kasaba", null), null);
  for (const mutate of [
    (s) => {
      s.meta.id = "hayat";
    },
    (s) => {
      delete s.cohorts;
    },
    (s) => {
      s.metrics.water = null;
    },
    (s) => {
      s.debt = Infinity;
    },
    (s) => {
      s.pending = [{}];
    },
    (s) => {
      s.npcs[0] = null;
    },
    (s) => {
      s.used = ["a", "a"];
    },
    (s) => {
      s.report = {};
    },
    (s) => {
      advanceTown(s);
      s.report.cohorts[0].id = "ghost";
    },
    (s) => {
      advanceTown(s);
      delete s.report.before.budget;
    },
  ]) {
    const s = createTown();
    mutate(s);
    assert.equal(normalizeTown("son-kasaba", s), null);
  }
  const s = createTown();
  applyTownAction(s, "event:road:act");
  const a = normalizeTown("son-kasaba", copy(s)),
    b = normalizeTown("son-kasaba", copy(s));
  advanceTown(a);
  assert.notDeepEqual(a, b);
  assert.equal(b.month, 1);
  assert.equal(b.pending.length, 1);
});
test("all management panels and complete bilingual help render without mutating simulation", () => {
  const s = createTown();
  for (const lang of ["tr", "en"]) {
    globalThis.window = { tlabI18n: { getLang: () => lang, phrase: (x) => x } };
    try {
      for (const [screen] of NAV) {
        s.ui.screen = screen;
        const before = copy(s);
        const html = townPanel(s);
        assert.ok(html.length > 60, screen);
        assert.deepEqual(s, before);
        assert.doesNotMatch(html, /undefined|NaN|\[object Object\]/);
      }
      assert.ok(help().length > 500);
    } finally {
      delete globalThis.window;
    }
  }
});
test("100 varied 24-month campaigns remain bounded, serialized, deterministic and finish", () => {
  const endings = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const s = createTown({ context: seed % 2 ? "industry" : "rural" });
    let r = seed;
    for (let m = 0; m < 24; m++) {
      for (let a = 0; a < 3; a++) {
        r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
        const candidates = [
          "civic:road",
          "civic:water",
          "civic:energy",
          "civic:support",
          "civic:festival",
          "repair:school",
          "repair:fuel",
          "repair:clinic",
          "civic:cleanup",
          ...s.events.filter((e) => e.status === "open").map((e) => `event:${e.id}:act`),
          ...s.investors
            .filter((i) => i.status === "offered")
            .map((i) => `investor:${i.id}:${seed % 3 ? "accept" : "negotiate"}`),
        ];
        const valid = candidates.filter((c) => !actionInfo(s, c).reason);
        if (valid.length) applyTownAction(s, valid[r % valid.length]);
      }
      const twin = copy(s);
      advanceTown(s);
      advanceTown(twin);
      assert.deepEqual(s, twin);
      assert.ok(validateTown(s), `${seed}/${m}`);
      assert.ok(Object.hasOwn(IDENTITIES, s.identity));
      assert.ok(Number.isFinite(economy(s).totalIncome));
    }
    assert.equal(s.completedMonths, 24);
    assert.equal(s.ended, true);
    assert.ok(JSON.stringify(s).length < 100000);
    endings.add(s.ending.id);
  }
  assert.ok(endings.size >= 2);
});
