// Racon Manager: neighbourhood network decisions, map signals and save safety.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGame } from "./racon-harness.mjs";

const w = {};
new Function("window", readFileSync("public/games/racon/network.js", "utf8"))(w);
const Ag = w.RaconAg;

function world() {
  const ids = ["st_fevzi", "st_aksem", "st_carsamba", "st_macar", "st_draman", "st_fener"];
  return {
    week: 5,
    kasa: 20000,
    dosya: 10,
    streetHome: "st_fevzi",
    flags: { lastTouch: {} },
    men: [{ durum: "hazir" }, { durum: "hazir" }, { durum: "hazir" }],
    streets: ids.map((id, i) => ({
      id,
      ad: id,
      sahip: i < 2 ? "sen" : i === 3 ? "rakip" : "bos",
      heat: 20,
      terorMahalle: 20,
      sadakatMahalle: 50,
      saygiPuan: 0,
      komsular: [ids[(i + 5) % 6], ids[(i + 1) % 6]],
    })),
  };
}
function api(log = []) {
  return {
    pay: (n) => log.push(["pay", n]),
    addRep: (k, d) => log.push(["rep", k, d]),
    esnafRel: (sid, d) => log.push(["rel", sid, d]),
    esnafFavor: (sid, d) => log.push(["favor", sid, d]),
    inbox: () => {},
    income: (n) => log.push(["income", n]),
  };
}
const st = (S, id) => S.streets.find((s) => s.id === id);

test("four decisions each have a distinct now, weekly and end effect", () => {
  assert.deepEqual(Ag.KIND, ["koru", "yatirim", "cekil", "iliski"]);
  const shapes = new Set();
  for (const k of Ag.KIND) {
    const o = Ag.ORDERS[k];
    assert.ok(o.weeks >= 2, `${k} has a long tail`);
    assert.notDeepEqual(o.now, o.end, `${k}: short and long effects differ`);
    shapes.add(JSON.stringify([o.now, o.weekly, o.end]));
  }
  assert.equal(shapes.size, 4);
});

test("eligibility: control, home street, rival street, capacity, one decision per street, cash", () => {
  const S = world();
  assert.match(Ag.reason(S, "st_carsamba", "koru"), /Yalnız senin/);
  assert.match(Ag.reason(S, "st_macar", "yatirim"), /Rakip sokağa/);
  assert.match(Ag.reason(S, "st_fevzi", "cekil"), /Ev sokağından/);
  assert.equal(Ag.reason(S, "st_aksem", "cekil"), "");
  assert.equal(Ag.reason(S, "st_macar", "iliski"), "");
  assert.ok(Ag.start(S, "st_aksem", "koru", api()));
  assert.match(Ag.reason(S, "st_aksem", "iliski"), /süren bir karar/);
  assert.ok(Ag.start(S, "st_carsamba", "iliski", api()));
  assert.equal(Ag.capacity(S), 2);
  assert.match(Ag.reason(S, "st_draman", "iliski"), /en fazla 2/);
  const poor = world();
  poor.kasa = 100;
  assert.match(Ag.reason(poor, "st_fevzi", "yatirim"), /Kasada/);
  assert.equal(Ag.start(poor, "st_fevzi", "yatirim", api()), false);
});

test("protect: order now, heat each week, file pressure at the end; rivals cannot target it", () => {
  const S = world();
  const log = [];
  Ag.start(S, "st_aksem", "koru", api(log));
  assert.deepEqual(log[0], ["pay", 2500]);
  assert.equal(st(S, "st_aksem").sadakatMahalle, 53);
  assert.ok(Ag.protectedFromRival(S, "st_aksem"));
  for (let i = 0; i < 3; i += 1) Ag.weekly(S, api());
  assert.equal(st(S, "st_aksem").heat, 26);
  assert.equal(st(S, "st_aksem").terorMahalle, 11);
  assert.equal(st(S, "st_fevzi").heat, 23, "owned neighbour warms with the patrol");
  assert.equal(S.dosya, 12, "the police remember the patrols");
  assert.equal(Ag.active(S, "st_aksem"), null);
  assert.equal(Ag.protectedFromRival(S, "st_aksem"), false);
});

test("invest: nothing for four weeks, then lasting income and slower heat; lost to a rival", () => {
  const S = world();
  Ag.start(S, "st_fevzi", "yatirim", api());
  assert.equal(st(S, "st_fevzi").heat, 18);
  for (let i = 0; i < 3; i += 1) Ag.weekly(S, api());
  assert.equal(st(S, "st_fevzi").yatirim ?? 0, 0, "no visible return before the end");
  const log = [];
  Ag.weekly(S, api(log));
  assert.equal(st(S, "st_fevzi").yatirim, 1);
  assert.equal(st(S, "st_fevzi").sadakatMahalle, 60);
  assert.equal(st(S, "st_fene"), undefined);
  assert.equal(st(S, "st_fener").sadakatMahalle, 52, "neighbours feel the investment");
  assert.deepEqual(log.at(-1), ["income", 600]);
  assert.equal(Ag.heatStep(st(S, "st_fevzi")), 1);
  assert.equal(Ag.heatStep({ sahip: "sen", yatirim: 0 }), 2);
  const T = world();
  Ag.start(T, "st_aksem", "yatirim", api());
  st(T, "st_aksem").sahip = "rakip";
  Ag.weekly(T, api());
  assert.equal(Ag.active(T, "st_aksem"), null);
  assert.equal(st(T, "st_aksem").yatirim ?? 0, 0, "capital burns when the street is lost");
});

test("withdraw: pressure drops now, the file eases two weeks later, the street is left open", () => {
  const S = world();
  const log = [];
  Ag.start(S, "st_aksem", "cekil", api(log));
  const a = st(S, "st_aksem");
  assert.equal(a.sahip, "bos");
  assert.equal(a.heat, 12);
  assert.equal(a.terorMahalle, 14);
  assert.equal(a.sadakatMahalle, 45);
  assert.deepEqual(
    log.find((x) => x[0] === "rep"),
    ["rep", "saygi", -1],
  );
  assert.equal(st(S, "st_fevzi").heat, 18);
  Ag.weekly(S, api());
  assert.equal(S.dosya, 10);
  Ag.weekly(S, api());
  assert.equal(S.dosya, 7);
});

test("relation: slow loyalty, favour at the end, a rival street can fall open", () => {
  const S = world();
  const log = [];
  st(S, "st_macar").sadakatMahalle = 55;
  Ag.start(S, "st_macar", "iliski", api(log));
  assert.deepEqual(
    log.find((x) => x[0] === "rel"),
    ["rel", "st_macar", 6],
  );
  for (let i = 0; i < 3; i += 1) Ag.weekly(S, api(log));
  assert.equal(st(S, "st_macar").sadakatMahalle, 61);
  assert.equal(st(S, "st_macar").sahip, "bos", "the neighbourhood turned away from the rival");
  assert.deepEqual(
    log.find((x) => x[0] === "favor"),
    ["favor", "st_macar", 1],
  );
  assert.equal(S.flags.lastTouch.st_macar, 5);
});

test("previews state the exact effects they will apply", () => {
  const S = world();
  for (const k of Ag.KIND) {
    const target = k === "cekil" ? "st_aksem" : k === "koru" ? "st_aksem" : "st_fevzi";
    const p = Ag.preview(S, target, k);
    const o = Ag.ORDERS[k];
    assert.deepEqual(
      [p.now, p.weekly, p.end, p.cost, p.weeks],
      [o.now, o.weekly, o.end, o.cost, o.weeks],
    );
    assert.ok(p.niyet && p.extra !== undefined);
  }
});

test("map signals: control, threat band, rival neighbours, badges only for real openings", () => {
  const S = world();
  const home = Ag.signals(S, st(S, "st_fevzi"), {});
  assert.equal(home.kontrol, "sen");
  assert.equal(home.tehdit, "düşük");
  assert.equal(home.rozet, false);
  const car = Ag.signals(S, st(S, "st_carsamba"), { touch: 2 });
  assert.equal(car.rozet, true);
  assert.match(car.firsat[0], /Tutulabilir/);
  st(S, "st_draman").sahip = "sen";
  const dr = Ag.signals(S, st(S, "st_draman"), { randevu: true });
  assert.equal(dr.rakipKomsu, 1);
  assert.ok(dr.uyari.includes("Rakip randevu verdi"));
  assert.equal(dr.tehditPuan, 53, "heat/terror + open appointment + one rival neighbour");
  assert.equal(dr.tehdit, "orta");
  const kinds = Object.fromEntries(Ag.links(S).map((l) => [[l.a, l.b].sort().join("|"), l.kind]));
  assert.equal(kinds["st_aksem|st_fevzi"], "hat");
  assert.equal(kinds["st_draman|st_macar"], "sinir");
  assert.equal(Ag.links(S).length, 6);
});

test("saves: unknown or malformed network data is dropped, not trusted", () => {
  const n = Ag.normalize({
    orders: [
      { street: "st_fevzi", kind: "koru", from: 3, left: 2 },
      { street: "st_aksem", kind: "hack", left: 3 },
      { street: 5, kind: "iliski", left: 1 },
      { street: "st_draman", kind: "yatirim", left: 0 },
    ],
    log: [{ week: 2, text: "ok" }, { text: 3 }],
  });
  assert.deepEqual(n.orders, [{ street: "st_fevzi", kind: "koru", from: 3, left: 2 }]);
  assert.deepEqual(n.log, [{ week: 2, text: "ok" }]);
  assert.deepEqual(Ag.normalize(null), { orders: [], log: [] });
});

function game(seed = 4242) {
  const g = loadGame();
  g.win.__raconSeedSabit = seed;
  g.ev(`blank("Kabul");enterPlay();S.seed=${seed};UI.fastJob=true;`);
  return g;
}

test("in game: a decision is paid once, runs through the week and survives a reload", () => {
  const g = game();
  g.ev('S.kasa=20000;S.cleanKasa=20000;S.dirtyKasa=0;S.screen="harita";');
  const kasa = g.ev("S.kasa");
  g.ev('act("ag",{id:"st_fevzi",kind:"yatirim"});act("ag",{id:"st_fevzi",kind:"yatirim"});');
  assert.equal(g.ev("S.kasa"), kasa - 5000, "a repeat press is refused, not charged twice");
  assert.equal(g.ev("S.ag.orders.length"), 1);
  for (let i = 0; i < 7; i += 1) g.ev('act("ilerlet",{});if(UI.modal) act("threat-yes",{});');
  assert.equal(g.ev("S.ag.orders[0]&&S.ag.orders[0].left"), 3);
  g.ev("writeSave();S=loadSave();enterPlay();");
  assert.equal(g.ev("S.ag.orders[0].kind"), "yatirim");
  assert.equal(g.ev('streetBy("st_fevzi").yatirim'), 0);
  const html = g.ev('S.screen="harita";UI.streetId="st_fevzi";screenHtml()');
  assert.equal((html.match(/class="ag-node /g) || []).length, 6);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Yatırım<\/b> sürüyor · 3 hafta kaldı/);
  assert.match(html, /gerçek konum ya da ölçek değil/);
  assert.deepEqual(g.win.__raconTest(), []);
});

test("in game: an old save without network data opens with an empty network", () => {
  const g = game();
  const out = g.ev(
    'migrate({kind:"racon_v1",week:3,day:2,kasa:5000,men:[],streets:[{id:"st_fevzi",ad:"Fevzi Paşa",sahip:"sen"}]})',
  );
  assert.deepEqual(out.ag, { orders: [], log: [] });
  assert.equal(out.streets[0].yatirim, 0);
});

test("the map is a schematic: no real coordinates, no map tiles, no third-party map art", () => {
  const src = readFileSync("public/games/racon/network.js", "utf8");
  assert.doesNotMatch(
    src,
    /latitude|longitude|\blng\b|geojson|openstreetmap|mapbox|leaflet|tile\.|google/i,
  );
  const html = readFileSync("public/games/racon/index.html", "utf8");
  assert.match(html, /<script src="network\.js"><\/script>/);
  assert.doesNotMatch(html, /openstreetmap|mapbox|leaflet|tile\.|googleapis\.com\/maps/i);
});
