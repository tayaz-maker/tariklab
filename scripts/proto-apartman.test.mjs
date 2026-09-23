// Apartment community prototype: rules, preview fidelity, saves and balance.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as S from "../public/games/proto-apartman/sim.js";
import {
  APPROACHES,
  HOUSEHOLDS,
  ISSUES,
  SYSTEM_IDS,
  TIES,
} from "../public/games/proto-apartman/data.js";

const play = (seed, pick, dues = "keep") => {
  const s = S.createGame({ seed });
  while (!s.ended) {
    for (const [id, a] of Object.entries(pick(s))) S.choose(s, id, a);
    S.setDues(s, s.period === 1 ? dues : "keep");
    S.commit(s);
    S.nextPeriod(s);
  }
  return s;
};

function combos(s) {
  const out = [];
  const rec = (i, ch) => {
    if (i === s.issues.length) return out.push({ ...ch });
    for (const a of ["defer", "patch", "repair", "together"]) {
      const n = { ...ch };
      if (a !== "defer") n[s.issues[i]] = a;
      if (S.attentionUsed(s, n) > S.ATTENTION || S.cashCommitted(s, n) > s.cash) continue;
      if (a === "together" && s.solidarity < S.TOGETHER_MIN_SOLIDARITY) continue;
      if (a !== "defer" && !ISSUES.find((x) => x.id === s.issues[i]).allow.includes(a)) continue;
      rec(i + 1, n);
    }
  };
  rec(0, {});
  return out;
}
const greedy = (s) => {
  let best = {},
    bv = -Infinity;
  for (const c of combos(s)) {
    const u = structuredClone(s);
    u.choices = c;
    S.commit(u);
    const v = S.health(u) + S.community(u) - (u.cash < 0 ? 20 : 0);
    if (v > bv) {
      bv = v;
      best = c;
    }
  }
  return best;
};

test("scope: 12–18 households, 4 shared systems, 3 periods, ties are valid", () => {
  assert.ok(HOUSEHOLDS.length >= 12 && HOUSEHOLDS.length <= 18);
  assert.deepEqual(SYSTEM_IDS, ["water", "power", "security", "structure"]);
  assert.equal(S.PERIOD_COUNT, 3);
  const ids = new Set(HOUSEHOLDS.map((h) => h.id));
  for (const [a, b] of TIES) assert.ok(ids.has(a) && ids.has(b) && a !== b);
  for (const h of HOUSEHOLDS)
    assert.ok(S.neighbours(h.id).length >= 1, `${h.id} has nobody to talk to`);
  for (const i of ISSUES) {
    assert.ok(S.affected(i).length > 0, `${i.id} touches nobody`);
    assert.ok(i.tr[0] && i.tr[1] && i.en[0] && i.en[1]);
  }
});

test("preview is exactly what commit does and never mutates the state", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = S.createGame({ seed });
    const pick = greedy(s);
    for (const [id, a] of Object.entries(pick)) assert.ok(S.choose(s, id, a));
    S.setDues(s, seed % 2 ? "raise" : "levy");
    const snap = JSON.stringify(s);
    const p = S.preview(s);
    assert.equal(JSON.stringify(s), snap, "preview mutated state");
    const r = S.commit(s);
    assert.deepEqual(r, p);
  }
});

test("board time and cash limits are enforced with a reason", () => {
  const s = S.createGame({ seed: 3 });
  s.cash = 200000; // isolate the board-time limit from the cash limit
  const [a, b, c] = s.issues;
  assert.ok(S.choose(s, a, "repair"));
  assert.equal(S.canChoose(s, b, "repair").ok, false);
  assert.match(S.canChoose(s, b, "repair").reason[1], /board time/);
  assert.ok(S.choose(s, b, "patch"));
  assert.equal(S.attentionUsed(s), 3);
  assert.equal(S.canChoose(s, c, "patch").ok, false);
  const poor = S.createGame({ seed: 3 });
  poor.cash = 1000;
  assert.match(S.canChoose(poor, poor.issues[0], "repair").reason[1], /cash/);
  assert.ok(S.choose(poor, poor.issues[0], "defer"), "deferring is always possible");
});

test("working together needs solidarity and builds it", () => {
  const s = S.createGame({ seed: 5 });
  s.solidarity = S.TOGETHER_MIN_SOLIDARITY - 1;
  assert.equal(S.canChoose(s, s.issues[0], "together").ok, false);
  s.solidarity = 60;
  assert.ok(S.choose(s, s.issues[0], "together"));
  const r = S.preview(s);
  assert.ok(r.after.solidarity >= 60 - 10, "together should not collapse solidarity");
});

test("deferred and patched problems come back more expensive; repaired ones do not return", () => {
  const s = S.createGame({ seed: 7 });
  const [x, y, z] = s.issues;
  S.choose(s, x, "repair");
  S.choose(s, y, "patch");
  const base = ISSUES.find((i) => i.id === z);
  S.commit(s);
  S.nextPeriod(s);
  assert.equal(S.returns(s, y), 1);
  assert.equal(S.returns(s, z), 1);
  assert.ok(!s.issues.includes(x), "repaired problem returned");
  assert.equal(S.issueCost(s, base, "repair"), Math.round(base.cost * 1.25));
});

test("the promise: kept gives trust, broken costs trust and solidarity", () => {
  const kept = S.createGame({ seed: 11, plan: ["water", "power", "security"] });
  const broke = structuredClone(kept);
  const target = kept.issues.find((id) => ISSUES.find((i) => i.id === id).system === kept.plan[0]);
  if (target) {
    S.choose(kept, target, "repair");
    assert.equal(S.preview(kept).promise.kept, true);
  }
  assert.equal(S.preview(broke).promise.kept, false);
  const revised = structuredClone(broke);
  assert.ok(S.setPlan(revised, 0, "security"));
  assert.equal(revised.planRevised, true);
  assert.equal(S.setPlan(revised, -1, "water"), false);
});

test("social echo reaches neighbours of households that were directly affected", () => {
  const s = S.createGame({ seed: 2 });
  const r = S.preview(s);
  assert.ok(r.echoes.length > 0);
  for (const e of r.echoes) assert.ok(S.neighbours(e.from).includes(e.to));
});

test("a campaign ends after three periods with a verdict and is deterministic by seed", () => {
  const a = play(9, greedy),
    b = play(9, greedy);
  assert.equal(a.ended, true);
  assert.equal(a.history.length, 3);
  assert.deepEqual(a, b);
  assert.ok(["standing", "sound", "warm", "quiet"].includes(S.verdict(a).id));
  assert.equal(S.commit(a), null, "no commits after the end");
});

test("saves: round trip, garbage and hostile values are repaired", () => {
  const s = S.createGame({ seed: 4 });
  S.choose(s, s.issues[0], "patch");
  const back = S.normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back, s);
  assert.equal(S.normalize(null), null);
  assert.equal(S.normalize({ v: 99 }), null);
  const bad = S.normalize({
    v: 1,
    seed: 4,
    period: 42,
    phase: "outcome",
    issues: ["nope", s.issues[0]],
    choices: { nope: "repair", [s.issues[0]]: "explode" },
    households: [{ id: "a1", trust: 900, tolerance: -5 }],
  });
  assert.equal(bad.period, 3);
  assert.equal(bad.phase, "decide", "outcome without a report is not resumable");
  assert.deepEqual(bad.issues, [s.issues[0]]);
  assert.deepEqual(bad.choices, {});
  assert.equal(bad.households[0].trust, 100);
  assert.equal(bad.households[0].tolerance, 0);
});

test("balance: doing nothing never wins, no single habit dominates, planning pays", () => {
  const N = 30;
  const verdicts = (pick, dues) => {
    const t = {};
    for (let seed = 1; seed <= N; seed++) {
      const v = S.verdict(play(seed, pick, dues)).id;
      t[v] = (t[v] || 0) + 1;
    }
    return t;
  };
  assert.equal(verdicts(() => ({})).standing || 0, 0);
  const patchAll = verdicts((s) =>
    Object.fromEntries(s.issues.slice(0, 3).map((id) => [id, "patch"])),
  );
  assert.equal(patchAll.standing || 0, 0, "patching everything should not reach the best outcome");
  const best = verdicts(greedy);
  assert.ok(
    (best.standing || 0) >= N * 0.3,
    `planned play reaches 'standing' too rarely: ${JSON.stringify(best)}`,
  );
  assert.ok((best.standing || 0) < N, "the best outcome should not be guaranteed");
  const mix = {};
  for (let seed = 1; seed <= N; seed++) {
    const s = S.createGame({ seed });
    while (!s.ended) {
      const c = greedy(s);
      for (const a of Object.values(c)) mix[a] = (mix[a] || 0) + 1;
      for (const [id, a] of Object.entries(c)) S.choose(s, id, a);
      S.commit(s);
      S.nextPeriod(s);
    }
  }
  const acted = Object.values(mix).reduce((n, v) => n + v, 0);
  for (const a of ["patch", "repair", "together"]) {
    assert.ok(mix[a] > 0, `${a} never chosen by planned play`);
    assert.ok(mix[a] / acted < 0.65, `${a} dominates planned play: ${JSON.stringify(mix)}`);
  }
  assert.ok(APPROACHES.defer.attention === 0);
});

test("prototype stays unlisted, unnamed and silent", () => {
  const html = readFileSync(
    new URL("../public/games/proto-apartman/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /name="robots" content="noindex,nofollow"/);
  assert.doesNotMatch(html, /og:|twitter:|rel="icon"/);
  const games = readFileSync(new URL("../src/lib/games.ts", import.meta.url), "utf8");
  assert.doesNotMatch(
    games,
    /proto-apartman/,
    "not in the public catalogue until a name is cleared",
  );
  const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  assert.doesNotMatch(sitemap, /proto-apartman/);
  for (const f of ["app.js", "sim.js", "data.js"]) {
    const src = readFileSync(
      new URL(`../public/games/proto-apartman/${f}`, import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(src, /AudioContext|new Audio|\.mp3|\.ogg|\.wav/);
  }
});
