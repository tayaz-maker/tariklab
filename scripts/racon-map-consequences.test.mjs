import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGame } from "./racon-harness.mjs";
const w = {};
for (const f of ["network.js", "map-model.js"])
  new Function("window", readFileSync(`public/games/racon/${f}`, "utf8"))(w);
const Ag = w.RaconAg;
function world() {
  const ids = Object.keys(Ag.NAMES);
  return {
    week: 1,
    kasa: 20000,
    dosya: 10,
    streetHome: ids[0],
    men: [{ durum: "hazir" }],
    people: [],
    calendar: [],
    flags: {},
    streets: ids.map((id, i) => ({
      id,
      ad: Ag.NAMES[id],
      sahip: i < 2 ? "sen" : i === 3 ? "rakip" : "bos",
      heat: 20,
      sadakatMahalle: 50,
      terorMahalle: 20,
      yatirim: 0,
      komsular: [ids[(i + 5) % 6], ids[(i + 1) % 6]],
    })),
  };
}
const st = (s, id) => s.streets.find((s) => s.id === id);
function tick(s) {
  s.week++;
  Ag.weekly(s);
}
test("focused withdrawal pays once, selects only a real neighbour and arrives after two closures", () => {
  const s = world(),
    before = Ag.preview(s, "st_aksem", "cekil", "st_fevzi");
  assert.equal(before.cost, 250);
  assert.equal(before.spread.length, 1);
  assert.equal(before.spread[0].first, 2);
  assert.equal(Ag.start(s, "st_aksem", "cekil", null, "st_macar"), false);
  assert.ok(Ag.start(s, "st_aksem", "cekil", null, "st_fevzi"));
  assert.equal(s.kasa, 19750);
  assert.equal(Ag.start(s, "st_aksem", "cekil", null, "st_fevzi"), false);
  assert.deepEqual(
    s.ag.flow.queue.map((p) => p.to),
    ["st_fevzi"],
  );
  tick(s);
  assert.equal(st(s, "st_fevzi").heat, 20);
  tick(s);
  assert.equal(st(s, "st_fevzi").heat, 16);
  tick(s);
  assert.equal(st(s, "st_fevzi").heat, 16);
  assert.match(s.ag.flow.history[0].text, /Kırık Avlu.*baskı -4/);
});
test("friendly, open and rival paths differ; in-flight delay survives control changes and reload", () => {
  const s = world();
  assert.equal(Ag.delay(s, "st_fevzi", "st_aksem"), 1);
  assert.equal(Ag.delay(s, "st_fevzi", "st_fener"), 2);
  assert.equal(Ag.delay(s, "st_carsamba", "st_macar"), 3);
  Ag.start(s, "st_carsamba", "iliski", null, "st_macar");
  tick(s);
  tick(s);
  tick(s);
  assert.equal(s.ag.flow.queue[0].left, 3);
  st(s, "st_macar").sahip = "sen";
  s.ag = Ag.normalize(JSON.parse(JSON.stringify(s.ag)));
  tick(s);
  tick(s);
  assert.equal(st(s, "st_macar").sadakatMahalle, 50);
  tick(s);
  assert.equal(st(s, "st_macar").sadakatMahalle, 54);
});
test("simultaneous incoming pressure cannot change trust mitigation by queue order", () => {
  const a = world();
  Ag.start(a, "st_fevzi", "koru");
  tick(a);
  st(a, "st_aksem").heat = 59;
  a.ag.flow.queue.push({
    id: 2,
    from: "st_carsamba",
    to: "st_aksem",
    kind: "iliski",
    phase: "end",
    left: 1,
    focus: true,
  });
  const b = structuredClone(a);
  b.ag.flow.queue.reverse();
  tick(a);
  tick(b);
  assert.deepEqual(a.streets, b.streets);
  assert.equal(st(a, "st_aksem").sadakatMahalle, 54);
  assert.equal(st(a, "st_aksem").heat, 60);
});
test("receiver pressure halves positive trust; local money/favour never replicates", () => {
  const s = world();
  st(s, "st_fener").heat = 70;
  Ag.start(s, "st_fevzi", "yatirim", null, "st_fener");
  for (let i = 0; i < 6; i++) tick(s);
  assert.equal(st(s, "st_fener").sadakatMahalle, 52);
  assert.equal(st(s, "st_fener").yatirim, 0);
  assert.equal(s.kasa, 14750);
  assert.match(s.ag.flow.history[0].text, /yarım güven/);
});
test("rival capture cancels unfinished investment and emits no invented completion wave", () => {
  const s = world();
  Ag.start(s, "st_fevzi", "yatirim");
  tick(s);
  st(s, "st_fevzi").sahip = "rakip";
  tick(s);
  assert.equal(s.ag.orders.length, 0);
  assert.equal(s.ag.flow.queue.length, 0);
  assert.equal(st(s, "st_fevzi").yatirim, 0);
});
test("forecast matches network plus passive heat closure exactly and leaves input untouched", () => {
  const s = world();
  Ag.start(s, "st_fevzi", "koru");
  tick(s);
  const before = JSON.stringify(s),
    f = Ag.forecast(s);
  assert.equal(JSON.stringify(s), before);
  const copy = structuredClone(s);
  copy.streets.forEach((st) => (st.heat = Math.max(0, Math.min(100, st.heat + Ag.heatStep(st)))));
  tick(copy);
  for (const n of f.streets) {
    assert.equal(n.heat, st(copy, n.id).heat);
    assert.equal(n.trust, st(copy, n.id).sadakatMahalle);
  }
});
test("pure map has matching geometry, control/favour/opportunity/resource/orders/packets and plan", () => {
  const s = world();
  s.people = [{ streetId: "st_fevzi", favor: 2 }];
  Ag.start(s, "st_aksem", "cekil");
  const before = JSON.stringify(s);
  const m = w.RaconMapModel.model(s, {
    selected: "st_fevzi",
    kind: "yatirim",
    target: "st_fener",
    layer: "favor",
  });
  assert.equal(JSON.stringify(s), before);
  assert.equal(m.nodes.length, 6);
  assert.equal(m.links.length, 6);
  assert.equal(m.nodes[0].favor, 2);
  assert.ok(m.nodes.find((n) => n.id === "st_fener").influence);
  assert.equal(m.nodes.find((n) => n.id === "st_aksem").signal.karar.kind, "cekil");
  assert.equal(m.links.flatMap((l) => l.packets).length, 2);
  assert.equal(m.plan.cost, 5250);
  assert.ok(
    m.nodes.every((n) =>
      n.shape.every((p) => p[0] >= 0 && p[0] <= m.width && p[1] >= 0 && p[1] <= m.height),
    ),
  );
});
test("old v1 slots keep their contract; queue, direction and arrival history round-trip", () => {
  const g = loadGame();
  g.ev(
    'blank("Save");enterPlay();S.kasa=20000;S.cleanKasa=20000;S.dirtyKasa=0;UI.agTarget="st_fener";act("ag",{id:"st_fevzi",kind:"yatirim"});',
  );
  for (let i = 0; i < 4; i++) g.ev("S.week++;agHafta();");
  const before = g.ev("JSON.stringify(S.ag)");
  g.ev("writeSave();S=loadSave();");
  assert.equal(g.ev("JSON.stringify(S.ag)"), before);
  assert.equal(g.ev("S.ag.flow.queue[0].to"), "st_fener");
  assert.equal(g.ev("S.ag.flow.queue[0].focus"), true);
  g.ev("S.week++;agHafta();S.week++;agHafta();writeSave();S=loadSave();");
  assert.equal(g.ev("S.ag.flow.queue.length"), 0);
  assert.equal(g.ev("S.ag.flow.history.length"), 1);
});
test("queue sanitizer rejects forged effects, paths, inherited kinds, duplicates and invalid counters", () => {
  const s = world();
  s.ag = {
    orders: [],
    log: [],
    flow: {
      version: 1,
      queue: [
        { id: 1, from: "st_fevzi", to: "st_macar", kind: "yatirim", phase: "end", left: 1 },
        { id: 2, from: "st_fevzi", to: "st_aksem", kind: "constructor", phase: "end", left: 1 },
        { id: 3, from: "st_fevzi", to: "st_aksem", kind: "yatirim", phase: "__proto__", left: 1 },
        {
          id: 4,
          from: "st_fevzi",
          to: "st_aksem",
          kind: "yatirim",
          phase: "end",
          left: 1,
          fx: { yatirim: 9999 },
        },
      ],
    },
  };
  Ag.ensure(s);
  assert.equal(s.ag.flow.queue.length, 1);
  assert.equal(s.ag.flow.queue[0].fx, undefined);
  tick(s);
  assert.equal(st(s, "st_aksem").yatirim, 0);
});
test("300 closures remain bounded and deterministic after reload at every step", () => {
  const a = world();
  let b = structuredClone(a),
    max = 0;
  for (let t = 0; t < 300; t++) {
    for (const s of [a, b]) {
      s.kasa = 20000;
      const id = Object.keys(Ag.NAMES)[t % 6],
        kind = Ag.KIND[t % 4];
      Ag.start(s, id, kind);
      tick(s);
    }
    b = JSON.parse(JSON.stringify(b));
    b.ag = Ag.normalize(b.ag);
    assert.deepEqual(a, b);
    max = Math.max(max, a.ag.flow?.queue.length || 0);
    for (const s of a.streets)
      assert.ok(s.heat >= 0 && s.heat <= 100 && s.sadakatMahalle >= 0 && s.sadakatMahalle <= 100);
  }
  assert.ok(max < 72);
  assert.ok(a.ag.flow.history.length <= 12);
  assert.ok(a.ag.log.length <= 12);
});

test("live order file consequences survive recalculation and slot reload", () => {
  for (const [kind, weeks, amount] of [
    ["koru", 3, 2],
    ["cekil", 2, -3],
  ]) {
    const g = loadGame();
    g.ev(
      'blank("Dosya");enterPlay();S.kasa=20000;S.cleanKasa=20000;S.dirtyKasa=0;S.streets[1].sahip="sen";filePressure(12,"baseline");',
    );
    const before = g.ev("S.dosya");
    g.ev(`act("ag",{id:"st_aksem",kind:"${kind}"});`);
    for (let i = 0; i < weeks; i++) g.ev("S.week++;agHafta();");
    g.ev("recalcDosya();writeSave();S=loadSave();recalcDosya();");
    assert.equal(
      g.ev("S.dosya"),
      before + amount,
      `${kind}: delayed file effect remains in the real evidence model`,
    );
  }
});
