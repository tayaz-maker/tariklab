// Coastal rhythm-network prototype: terrain grammar, routing, preview
// fidelity, agreements, saves and balance.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as S from "../public/games/proto-transit/sim.js";
import {
  AGREEMENTS,
  CORRIDORS,
  DISTRICT_IDS,
  DISTRICTS,
  MODES,
  WINDOWS,
} from "../public/games/proto-transit/data.js";

const K = (a, b) => S.keyOf(a, b);
const score = (r) => r.coverage + 0.5 * r.access - r.fragility * 0.5;
function greedy(s) {
  for (let k = 0; k < 12; k++) {
    let best = null,
      bv = score(S.previewDay(s));
    for (const c of CORRIDORS) {
      const key = K(c.a, c.b);
      const acts = [...c.modes.map((m) => ["b", m]), ["u", "freq"], ["u", "night"], ["u", "ramp"]];
      for (const [kind, x] of acts) {
        const t = structuredClone(s);
        if (!(kind === "b" ? S.build(t, key, x) : S.upgrade(t, key, x))) continue;
        const v = score(S.previewDay(t));
        if (v > bv + 0.01) {
          bv = v;
          best = [kind, key, x];
        }
      }
    }
    if (!best) break;
    if (best[0] === "b") S.build(s, best[1], best[2]);
    else S.upgrade(s, best[1], best[2]);
  }
  if (s.offer) S.answerOffer(s, true);
}
const play = (seed, bot) => {
  const s = S.createGame({ seed });
  while (!s.ended) {
    bot(s);
    S.runToday(s);
    S.nextDay(s);
  }
  return s;
};

test("map grammar: every corridor joins real districts; ferries cross water, lifts climb", () => {
  assert.equal(DISTRICT_IDS.length, 10);
  for (const c of CORRIDORS) {
    assert.ok(DISTRICTS[c.a] && DISTRICTS[c.b] && c.a !== c.b);
    for (const m of c.modes) assert.ok(MODES[m]);
    if (c.modes.includes("lift"))
      assert.notEqual(DISTRICTS[c.a].level, DISTRICTS[c.b].level, `${c.a}-${c.b} lift on the flat`);
  }
  const s = S.createGame({ seed: 1 });
  assert.equal(S.canBuild(s, K("liman", "sahil"), "tram").ok, false, "no tram across the bay");
  assert.equal(S.canBuild(s, K("bayir", "yukari"), "tram").ok, false, "no tram up the slope");
  assert.equal(S.canBuild(s, K("liman", "sahil"), "ferry").ok, true);
  assert.equal(WINDOWS.length, 4);
});

test("build points, upgrades and same-day undo", () => {
  const s = S.createGame({ seed: 2 });
  const k = K("liman", "rihtim");
  assert.ok(S.build(s, k, "tram"));
  assert.equal(s.points, S.START_POINTS - MODES.tram.cost);
  assert.equal(S.build(s, k, "tram"), false, "one line per corridor");
  assert.ok(S.upgrade(s, k, "freq"));
  assert.equal(S.unbuild(s, k), false, "upgraded lines cannot be undone");
  const b = K("carsi", "dere");
  assert.ok(S.build(s, b, "bridge"));
  assert.equal(S.canUpgrade(s, b, "night").ok, false, "footbridges are always open");
  assert.ok(S.unbuild(s, b));
  s.points = 0;
  assert.match(S.canBuild(s, b, "bridge").reason[1], /points/);
});

test("forecast equals the day that runs and never mutates the state", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const s = S.createGame({ seed });
    for (let d = 0; d < 3; d++) {
      greedy(s);
      const snap = JSON.stringify(s);
      const p = S.previewDay(s);
      assert.equal(JSON.stringify(s), snap);
      assert.deepEqual(S.runToday(s), p);
      S.nextDay(s);
    }
  }
});

test("night runs only on night service; stairs halve care and health", () => {
  const s = S.createGame({ seed: 3 });
  const k = K("kampus", "bayir");
  S.build(s, K("tersane", "kampus"), "tram");
  S.build(s, k, "tram");
  assert.equal(S.reachable(s, "night", "tersane", "bayir"), false);
  S.upgrade(s, k, "night");
  S.upgrade(s, K("tersane", "kampus"), "night");
  assert.equal(S.reachable(s, "night", "tersane", "bayir"), true);
  const stairs = S.createGame({ seed: 3 });
  stairs.points = 40;
  S.build(stairs, K("rihtim", "carsi"), "tram");
  S.build(stairs, K("carsi", "dere"), "bridge");
  S.build(stairs, K("dere", "bayir"), "tram");
  S.build(stairs, K("bayir", "tepe"), "lift");
  const before = S.previewDay(stairs).access;
  S.upgrade(stairs, K("carsi", "dere"), "ramp");
  assert.ok(S.previewDay(stairs).access > before, "a ramp should raise accessibility");
});

test("wind halves ferry capacity in the commute windows", () => {
  const s = S.createGame({ seed: 5 });
  s.points = 40;
  S.build(s, K("liman", "sahil"), "ferry");
  const calm = structuredClone(s),
    windy = structuredClone(s);
  calm.wind[0] = false;
  windy.wind[0] = true;
  const m = (x) => S.previewDay(x).windows[0].cap[K("liman", "sahil")];
  assert.equal(m(windy), m(calm) * S.WIND_FERRY);
});

test("agreements come due, pay out when kept and bite when broken", () => {
  for (const a of AGREEMENTS)
    assert.ok(a.tr[0] && a.tr[1] && a.en[0] && a.en[1] && DISTRICTS[a.district]);
  const s = S.createGame({ seed: 7 });
  s.offer = "night-lift";
  assert.ok(S.answerOffer(s, true));
  s.points = 40;
  S.build(s, K("bayir", "yukari"), "lift");
  S.upgrade(s, K("bayir", "yukari"), "night");
  assert.equal(s.agreements[0].due, 3, "an offer taken on day 1 is due at the end of day 3");
  for (let d = 1; d < 3; d++) {
    assert.deepEqual(S.runToday(s).agreements, []);
    S.nextDay(s);
  }
  const r = S.runToday(s);
  assert.deepEqual(r.agreements, [{ id: "night-lift", kept: true }]);
  assert.equal(r.pointsNext, S.DAILY_POINTS + S.KEPT_BONUS);
  const b = S.createGame({ seed: 7 });
  b.offer = "morning-ferry";
  S.answerOffer(b, true);
  for (let d = 1; d < 3; d++) {
    S.runToday(b);
    S.nextDay(b);
  }
  const f0 = b.fragility.sahil;
  const rb = S.runToday(b);
  assert.deepEqual(rb.agreements, [{ id: "morning-ferry", kept: false }]);
  assert.ok(rb.fragAfter.sahil >= Math.min(100, f0 + 30 - 8), `${f0} -> ${rb.fragAfter.sahil}`);
  const d = S.createGame({ seed: 7 });
  d.offer = "market-day";
  const before = d.fragility.carsi;
  S.answerOffer(d, false);
  assert.equal(d.fragility.carsi, before + 5);
});

test("districts cut off at full fragility and three end the run", () => {
  const s = play(4, () => {});
  assert.equal(s.ended, true);
  assert.ok(s.broken.length >= S.MAX_BROKEN);
  assert.equal(S.verdict(s).id, "cut");
  assert.ok(s.history.length < 6 || s.broken.length >= 3);
});

test("saves: round trip and hostile values", () => {
  const s = S.createGame({ seed: 9 });
  greedy(s);
  const back = S.normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back, s);
  assert.equal(S.normalize(null), null);
  const bad = S.normalize({
    v: 1,
    seed: 9,
    day: 99,
    points: 1e9,
    phase: "report",
    links: {
      "liman-sahil": { mode: "tram", freq: 9 },
      "bayir-yukari": { mode: "lift", freq: 9, night: true, ramp: true },
    },
    broken: ["nowhere", "sahil", "sahil"],
    agreements: [{ id: "fake", due: 2 }],
  });
  assert.equal(bad.day, 6);
  assert.equal(bad.points, 60);
  assert.equal(bad.phase, "plan");
  assert.deepEqual(Object.keys(bad.links), ["bayir-yukari"]);
  assert.equal(bad.links["bayir-yukari"].freq, 3);
  assert.equal(bad.links["bayir-yukari"].ramp, false);
  assert.deepEqual(bad.broken, ["sahil"]);
  assert.deepEqual(bad.agreements, []);
});

test("balance: nothing and single-mode play fail; planned play can find the rhythm but is not guaranteed", () => {
  const N = 16;
  const tally = (bot) => {
    const t = {};
    for (let seed = 1; seed <= N; seed++) {
      const v = S.verdict(play(seed, bot)).id;
      t[v] = (t[v] || 0) + 1;
    }
    return t;
  };
  assert.equal(tally(() => {}).cut, N);
  const tramOnly = tally((s) => {
    for (const c of CORRIDORS) if (c.modes.includes("tram")) S.build(s, K(c.a, c.b), "tram");
  });
  assert.equal(tramOnly.rhythm || 0, 0, "trams alone should not solve the city");
  const planned = tally(greedy);
  assert.ok((planned.rhythm || 0) >= N * 0.4, JSON.stringify(planned));
  assert.ok((planned.rhythm || 0) < N, JSON.stringify(planned));
  const modes = new Set();
  const s = play(3, greedy);
  for (const l of Object.values(s.links)) modes.add(l.mode);
  assert.ok(modes.size >= 3, `planned play uses only ${[...modes]}`);
});

test("prototype stays unlisted, unnamed and silent", () => {
  const html = readFileSync(
    new URL("../public/games/proto-transit/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(html, /og:|twitter:|rel="icon"/);
  for (const f of ["../src/lib/games.ts", "../public/sitemap.xml"])
    assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), "utf8"), /proto-transit/);
  for (const f of ["app.js", "sim.js", "data.js"]) {
    const src = readFileSync(
      new URL(`../public/games/proto-transit/${f}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(src, /AudioContext|new Audio|\.mp3|\.ogg|\.wav/);
    assert.doesNotMatch(src, /metro/i, "never framed as a metro game");
  }
});
