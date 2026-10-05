import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGame } from "./racon-harness.mjs";
const w = {};
for (const file of ["network.js", "map-model.js", "outcome-moment.js"])
  new Function("window", readFileSync(`public/games/racon/${file}`, "utf8"))(w);
const { RaconAg: Ag, RaconOutcome: Outcome, RaconMapModel: MapModel } = w;
function world() {
  const ids = Object.keys(Ag.NAMES);
  return { week: 2, kasa: 20000, dosya: 10, saygi: 15, streetHome: ids[0],
    men: [{ durum: "hazir" }, { durum: "hazir" }, { durum: "hazir" }], people: [], flags: {}, calendar: [],
    streets: ids.map((id, i) => ({ id, ad: Ag.NAMES[id], sahip: i < 2 ? "sen" : i === 3 ? "rakip" : "bos",
      heat: 20, sadakatMahalle: 50, terorMahalle: 20, yatirim: 0, komsular: [ids[(i + 5) % 6], ids[(i + 1) % 6]] })) };
}
function accept(s, kind, target) {
  const before = Outcome.snapshot(s), order = { street: "st_aksem", kind, target };
  assert.equal(Ag.start(s, order.street, kind, null, target), true);
  const after = Outcome.snapshot(s);
  return { before, after, order, model: Outcome.buildOutcomeMoment(before, after, order) };
}
function freeze(value) { if (value && typeof value === "object") { Object.freeze(value); Object.values(value).forEach(freeze); } return value; }

test("all four accepted commitments report the actual paid cost and active duration without completion awards", () => {
  for (const [kind, cost, left] of [["koru",2500,3],["yatirim",5000,4],["cekil",0,2],["iliski",800,3]]) {
    const s = world(), { model } = accept(s, kind);
    assert.ok(model);
    assert.equal(model.cashDelta, cost ? -cost : 0);
    assert.equal(model.cost, cost);
    assert.equal(model.pending.left, left);
    assert.match(model.pending.text, /sonuç bekliyor/);
    assert.ok(!model.changes.some((c) => c.key === "investment" || c.key === "favor"));
    assert.equal(model.cost, 20000 - s.kasa);
  }
});

test("receipts measure clipped trust and pressure deltas, not the configured nominal effects", () => {
  const s = world(); s.streets[1].sadakatMahalle = 99;
  const protect = accept(s,"koru").model;
  assert.equal(protect.changes.find((c) => c.key === "trust").delta, 1);
  const investment = world(); investment.streets[1].heat = 1;
  const invest = accept(investment,"yatirim").model;
  assert.equal(invest.changes.find((c) => c.key === "pressure").delta, -1);
  assert.equal(invest.pending.sent.length, 0);
  assert.match(invest.pending.note, /henüz oluşmadı/);
});

test("focused withdrawal shows its real surcharge, loss of control and actual queued arrival delay", () => {
  const s = world(), { model } = accept(s,"cekil","st_fevzi");
  assert.equal(model.cost, 250);
  assert.deepEqual(model.changes.find((c) => c.key === "control"), { key:"control",label:"Kontrol",before:"sen",after:"bos",text:"Sende → Boş" });
  assert.equal(model.changes.find((c) => c.key === "pressure").delta, -8);
  assert.deepEqual(model.pending.sent.map((p) => [p.to,p.left]), [["st_fevzi",2]]);
  assert.equal(model.changes.some((c) => c.key === "dosya"), false);
});

test("projection is immutable, deterministic, and rejects old, rejected and mismatched orders", () => {
  const s = world(), stateBefore = JSON.stringify(s);
  const snap = Outcome.snapshot(freeze(structuredClone(s)));
  assert.equal(JSON.stringify(s), stateBefore);
  assert.equal(snap.orders.length, 0);
  const { before,after,order,model } = accept(s,"yatirim");
  freeze(before); freeze(after); freeze(order);
  assert.deepEqual(Outcome.buildOutcomeMoment(before,after,order),model);
  assert.equal(Outcome.buildOutcomeMoment(after,after,order),null);
  assert.equal(Outcome.buildOutcomeMoment(before,after,{...order,kind:"koru"}),null);
  assert.equal(Outcome.buildOutcomeMoment(before,after,{...order,target:"st_fevzi"}),null);
  assert.equal(Outcome.buildOutcomeMoment(before,after,{...order,kind:"constructor"}),null);
  assert.equal(Ag.start(s,"st_aksem","yatirim"),false);
  assert.equal(Outcome.buildOutcomeMoment(after,Outcome.snapshot(s),order),null);
});

test("live action observes real esnaf relationship, emits once and adds nothing to saved game data", () => {
  const game = loadGame();
  new Function("window", readFileSync("public/games/racon/outcome-moment.js","utf8"))(game.win);
  const emitted = [], build = game.win.RaconOutcome.buildOutcomeMoment;
  game.win.RaconOutcome.buildOutcomeMoment = (...args) => { const m = build(...args); emitted.push(m); return m; };
  game.ev('blank("Karar");enterPlay();S.kasa=20000;S.cleanKasa=20000;S.dirtyKasa=0;S.screen="harita";act("ag",{id:"st_fevzi",kind:"iliski"});');
  assert.equal(emitted.length,1);
  assert.equal(emitted[0].cost,800);
  assert.equal(emitted[0].changes.find((c) => c.key === "relationship").delta,6);
  assert.equal(emitted[0].pending.sent.length,0);
  game.ev('act("ag",{id:"st_fevzi",kind:"iliski"});render();writeSave();S=loadSave();render();');
  assert.equal(emitted.length,1);
  assert.doesNotMatch(game.ev('JSON.stringify(dumpSave())'),/racon-order|rc-receipt|outcomeMoment/);
  assert.equal(game.ev('S.ag.orders.length'),1);
});

test("state-derived map marks are pure, bounded, responsive and shared geometry", () => {
  const s = world(), original = JSON.stringify(s);
  const low = MapModel.model(s,{narrow:false});
  s.streets[1].sadakatMahalle = 90; s.streets[1].heat = 85; Ag.start(s,"st_aksem","koru");
  const high = MapModel.model(s,{narrow:false}), reduced = MapModel.model(s,{narrow:false,reduced:true}), mobile = MapModel.model(s,{narrow:true});
  assert.equal(JSON.stringify(world()),original);
  const node = high.nodes[1];
  assert.notDeepEqual(low.nodes[1].marks,node.marks);
  assert.ok(node.marks.length <= 10);
  assert.ok(reduced.nodes[1].marks.length < node.marks.length);
  assert.ok(mobile.nodes[1].marks.length <= node.marks.length);
  for (const m of [high,reduced,mobile]) for (const n of m.nodes) {
    assert.ok(n.marks.length <= (m.narrow || m.reduced ? 5 : 10));
    assert.deepEqual(n.marks,MapModel.streetMarks(n.signal,{x:n.x,y:n.y,half:n.half,narrow:m.narrow,reduced:m===reduced}));
  }
  const frozen = freeze(structuredClone(s));
  assert.deepEqual(MapModel.model(frozen,{narrow:false}).nodes.map((n) => n.marks),high.nodes.map((n) => n.marks));
});
