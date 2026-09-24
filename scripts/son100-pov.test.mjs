// Son 100 Gün single-seat POV game: content, arc, honest previews, endings, saves.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as G from "../public/games/son-100-gun/pov.js";
import {
  CARDS,
  SCENARIOS,
  ROUTINES,
  ENDINGS,
  EPILOGUE,
} from "../public/games/son-100-gun/pov-data.js";
import { play, pick } from "./son100-pov-policies.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const KEYS = new Set([...G.STATS, ...G.PEOPLE, "people", "target"]);
const TOKENS =
  /\{(kin|friend|young|target)(\.(dat|acc))?\}|\{(job|Job|work|Work|asset|Asset|left)\}/g;
const pairs = [];
const pair = (v, where) => {
  assert.ok(
    v && typeof v.tr === "string" && typeof v.en === "string" && v.tr && v.en,
    `${where}: TR/EN`,
  );
  pairs.push([v, where]);
};

test("every card, option and outcome is bilingual with known effect keys and tokens", () => {
  for (const c of CARDS) {
    pair(c.title, `${c.id}.title`);
    pair(c.text, `${c.id}.text`);
    if (c.lapse) pair(c.lapse.text, `${c.id}.lapse`);
    assert.ok(c.options.length >= 2, `${c.id} needs a real choice`);
    for (const o of c.options) {
      const at = `${c.id}:${o.id}`;
      pair(o.label, `${at}.label`);
      pair(o.intent, `${at}.intent`);
      if (o.risk) {
        assert.ok(o.risk.p > 0 && o.risk.p < 1, `${at} odds`);
        pair(o.risk.winText, `${at}.win`);
        pair(o.risk.loseText, `${at}.lose`);
      } else pair(o.result, `${at}.result`);
      for (const fx of [o.fx, o.risk?.win, o.risk?.lose, ...(o.later || []).map((l) => l.fx)])
        for (const k of Object.keys(fx || {})) assert.ok(KEYS.has(k), `${at}: unknown key ${k}`);
      for (const l of o.later || []) pair(l.text, `${at}.later`);
      if (Object.keys(o.fx || {}).includes("target") || JSON.stringify(o).includes("{target"))
        assert.ok(c.target, `${at} uses target without a target rule`);
    }
  }
  for (const [v, where] of pairs)
    for (const l of ["tr", "en"]) {
      const rest = v[l].replace(TOKENS, "");
      assert.doesNotMatch(rest, /[{}]/, `${where}.${l}: unknown token`);
    }
  for (const e of Object.values(ENDINGS)) {
    pair(e.title, "ending");
    pair(e.text, "ending");
  }
  for (const e of Object.values(EPILOGUE)) pair(e, "epilogue");
  for (const r of Object.values(ROUTINES)) {
    pair(r.name, "routine");
    pair(r.each, "routine");
  }
  for (const sc of SCENARIOS) {
    for (const k of G.PEOPLE) {
      const p = sc.people[k];
      assert.ok(p.name && p.dat && p.acc, `${sc.id}.${k} Turkish case forms`);
      pair(p.role, `${sc.id}.${k}.role`);
    }
    assert.ok(
      CARDS.some((c) => c.scen?.includes(sc.id)),
      `${sc.id} has a card of its own`,
    );
  }
});

test("arc: beginning, a rhythm on day 15, one breaking point on day 57, last days, then an ending", () => {
  assert.equal(G.CALENDAR.length, 15);
  assert.equal(G.CALENDAR[G.RHYTHM_TURN], 15);
  assert.equal(G.CALENDAR[G.BREAK_TURN], 57);
  assert.deepEqual([...new Set(G.CALENDAR.map(G.phaseOf))], ["start", "routine", "break", "end"]);
  const kinds = new Set(CARDS.filter((c) => c.forced === "break").map((c) => c.breakKind));
  assert.deepEqual([...kinds].sort(), ["body", "meaning", "money", "people"]);
  for (const sc of SCENARIOS)
    for (let seed = 1; seed <= 12; seed += 1) {
      const s = G.createGame(sc.id, seed);
      assert.deepEqual(s.hand.map((h) => h.id).sort(), ["doctor", "job", "tell"]);
      while (!s.ending) {
        if (s.turn === G.RHYTHM_TURN)
          assert.deepEqual(
            s.hand.map((h) => h.id),
            ["rhythm"],
          );
        else if (s.turn === G.BREAK_TURN) {
          assert.equal(s.hand.length, 1);
          assert.equal(G.card(s.hand[0].id).breakKind, G.breakKind(s));
        } else assert.ok(s.hand.length >= 2, `${sc.id}/${seed}: thin hand on day ${s.day}`);
        const [c, o] = pick(s, "random", () => ((seed * 7 + s.turn * 13) % 10) / 10);
        assert.ok(G.choose(s, c, o));
      }
      assert.ok(s.ending.day === 100 || s.ending.early);
      assert.equal(s.hand.length, 0);
      assert.equal(G.choose(s, "tell", "kin"), null, "no decisions after the ending");
    }
});

test("one decision per period: no button spam, no replays of the same card inside its cooldown", () => {
  const s = G.createGame("usta", 3);
  const before = JSON.stringify(s);
  assert.equal(G.choose(s, "trip", "go"), null, "a card not in hand cannot be played");
  assert.equal(G.choose(s, "tell", "nope"), null);
  assert.equal(JSON.stringify(s), before, "a refused move changes nothing");
  const day = s.day;
  assert.ok(G.choose(s, "tell", "kin"));
  assert.ok(s.day > day, "each decision closes a period of days");
  assert.ok(!s.hand.some((h) => h.id === "tell"), "a once card does not come back");
  const g = play("ogretmen", 5, "first");
  const turnsOf = {};
  for (const l of g.log) (turnsOf[l.card] ||= []).push(l.turn);
  for (const [id, turns] of Object.entries(turnsOf)) {
    const c = G.card(id);
    if (c.once && !c.options.some((o) => o.keep)) assert.equal(turns.length, 1, id);
    if (c.cd)
      for (let i = 1; i < turns.length; i += 1) assert.ok(turns[i] - turns[i - 1] >= c.cd, id);
  }
});

test("previews are honest: certain cost, odds, carried effects, passed-over costs and the period close", () => {
  let checked = 0;
  for (const sc of SCENARIOS)
    for (let seed = 1; seed <= 20; seed += 1) {
      const s = G.createGame(sc.id, seed);
      while (!s.ending) {
        const [c, o] = pick(
          s,
          seed % 2 ? "random" : "greedy",
          () => ((seed * 31 + s.turn * 17) % 97) / 97,
        );
        const p = G.preview(s, c, o);
        const opt = G.card(c).options.find((x) => x.id === o);
        const safe = [s.body, s.peace, s.mark, ...Object.values(s.people)].every(
          (v) => v > 20 && v < 80,
        );
        const pendingDue = s.pending.some((x) => x.due <= s.turn + 1);
        const turn = s.turn;
        const log = G.choose(s, c, o);
        assert.deepEqual(
          log.lapsed.map((l) => l.fx),
          p.lapses.map((l) => l.fx),
        );
        assert.equal(Boolean(log.outcome), Boolean(p.risk));
        if (p.risk && log.outcome) assert.equal(opt.risk.p, p.risk.p);
        for (const l of p.later)
          if (l.in > 1 && !s.ending)
            assert.ok(
              s.pending.some((x) => x.from === c && x.due === turn + l.in),
              `${c}:${o} later is queued`,
            );
        const ownDue = p.later.some((l) => l.in <= 1);
        if (!safe) continue;
        const expect = { ...p.now };
        if (log.outcome)
          for (const [k, v] of Object.entries(p.risk[log.outcome]))
            expect[k] = (expect[k] || 0) + v;
        for (const k of Object.keys(expect)) if (!expect[k]) delete expect[k];
        assert.deepEqual(log.choiceFx, expect, `${sc.id}/${seed} ${c}:${o} decision effect`);
        const riskChangesClose = log.outcome === "win" && opt.risk.flag;
        const lapseFree = !log.lapsed.length;
        if (!pendingDue && !ownDue && !riskChangesClose && lapseFree && s.money >= 0 && !s.ending) {
          assert.deepEqual(log.close.fx, p.close.fx, `${sc.id}/${seed} ${c}:${o} period close`);
          checked += 1;
        }
      }
    }
  assert.ok(checked > 40, `period-close preview checked ${checked} times`);
});

test("at least two meaningful endings; each focus reaches its own; no route clears every axis", () => {
  const endings = new Set();
  const focus = { warm: "door", careful: "mark", still: "still" };
  for (const sc of SCENARIOS) {
    for (const [policy, want] of Object.entries(focus)) {
      let hits = 0;
      for (let seed = 1; seed <= 20; seed += 1) {
        const s = play(sc.id, seed, policy);
        endings.add(s.ending.id);
        if (s.ending.id === want) hits += 1;
      }
      assert.ok(hits >= 16, `${sc.id}/${policy} reached ${want} only ${hits}/20`);
    }
    for (const policy of ["warm", "careful", "still", "greedy", "random", "first", "last"])
      for (let seed = 1; seed <= 20; seed += 1) {
        const s = play(sc.id, seed, policy);
        endings.add(s.ending.id);
        const sco = Object.values(s.ending.scores);
        assert.ok(
          sco.filter((v) => v >= G.ENDING_BAR).length < 3,
          `${sc.id}/${policy}/${seed} cleared every axis`,
        );
      }
  }
  assert.deepEqual([...endings].sort(), ["door", "mark", "still", "unfinished"]);
});

test("pressing the same button every period does not earn an ending", () => {
  for (const sc of SCENARIOS)
    for (const policy of ["first", "last"]) {
      let earned = 0;
      for (let seed = 1; seed <= 30; seed += 1)
        if (play(sc.id, seed, policy).ending.id !== "unfinished") earned += 1;
      assert.ok(earned / 30 < 0.5, `${sc.id}/${policy} earned an ending ${earned}/30`);
    }
});

test("trade-offs are real: each focus pays on another axis, and careless strain can end the days early", () => {
  for (const sc of SCENARIOS) {
    const warm = play(sc.id, 4, "warm");
    const mark = play(sc.id, 4, "careful");
    const still = play(sc.id, 4, "still");
    assert.ok(warm.ending.scores.mark < mark.ending.scores.mark);
    assert.ok(mark.ending.scores.door < warm.ending.scores.door);
    assert.ok(still.ending.scores.still > warm.ending.scores.still);
    assert.ok(still.money < mark.money, "stillness costs savings");
  }
  let early = 0;
  for (let seed = 1; seed <= 20; seed += 1) if (play("usta", seed, "mark").ending.early) early += 1;
  assert.ok(early > 0, "ignoring the body must be able to end the hundred days early");
});

test("irreversible choices stick, and the second opinion keeps the decision open", () => {
  const s = G.createGame("ogretmen", 11);
  assert.ok(G.choose(s, "job", "quit"));
  assert.ok(s.flags.includes("quit"));
  assert.ok(G.card("job").options.find((o) => o.id === "quit").irreversible);
  const t = G.createGame("ogretmen", 11);
  assert.ok(G.choose(t, "doctor", "second"));
  assert.ok(
    t.hand.some((h) => h.id === "doctor"),
    "second opinion keeps the treatment talk open",
  );
  while (t.turn < G.RHYTHM_TURN) G.choose(t, t.hand[0].id, G.card(t.hand[0].id).options[0].id);
  const blockedWork = G.createGame("usta", 2);
  G.choose(blockedWork, "job", "quit");
  while (blockedWork.turn < G.RHYTHM_TURN) {
    const h = blockedWork.hand[0];
    G.choose(blockedWork, h.id, G.card(h.id).options.find((o) => !G.blocked(blockedWork, o)).id);
  }
  const work = G.card("rhythm").options.find((o) => o.id === "work");
  assert.equal(G.blocked(blockedWork, work), "noflag", "a quit job cannot become the rhythm");
  assert.equal(G.choose(blockedWork, "rhythm", "work"), null);
});

test("saves: new namespace, replay-based restore, tamper and version safety", () => {
  assert.equal(G.SAVE_PREFIX, "tariklab.son100.pov.v1");
  assert.ok(
    !G.SAVE_PREFIX.startsWith("tariklab.nextwave"),
    "old next-wave saves are never overwritten",
  );
  const s = play("cevirmen", 9, "greedy");
  const back = G.restore(G.serialize(s));
  assert.deepEqual(back, s);
  const mid = G.createGame("usta", 21);
  for (let i = 0; i < 6; i += 1) {
    const [c, o] = pick(mid, "warm");
    G.choose(mid, c, o);
  }
  assert.deepEqual(G.restore(JSON.parse(G.serialize(mid))), mid);
  const raw = JSON.parse(G.serialize(mid));
  raw.took.splice(2, 0, ["gathering", "all"]);
  const cut = G.restore(raw);
  assert.equal(cut.took.length, 2, "replay stops at the first invalid step");
  assert.equal(G.restore({ ...raw, v: 2 }), null);
  assert.equal(G.restore({ ...raw, scenario: "nobody" }), null);
  assert.equal(G.restore("not json"), null);
  const saved = JSON.parse(G.serialize(mid));
  assert.deepEqual(
    Object.keys(saved).sort(),
    ["scenario", "seed", "took", "v"],
    "no stats are trusted from storage",
  );
  const a = G.restore({ v: 1, scenario: "usta", seed: 5, took: [] });
  const b = G.createGame("usta", 5);
  assert.deepEqual(a, b, "deterministic from the seed");
});

test("page wiring: new app, shared language, embedded chrome rules, silent and red-free", () => {
  const html = read("public/games/son-100-gun/index.html");
  assert.match(html, /\.\/pov-app\.js/);
  assert.match(html, /\.\/pov\.css/);
  assert.match(html, /\/i18n\/tlab-i18n\.js/);
  assert.doesNotMatch(html, /\.\/app\.js/);
  const app = read("public/games/son-100-gun/pov-app.js");
  for (const sel of [
    "slot-card",
    'id="menu-new"',
    "data-scenario",
    'id="confirm-start"',
    "save-menu",
    "save-popover",
  ])
    assert.ok(app.includes(sel), `play-shell contract: ${sel}`);
  assert.match(app, /tariklab\.language/);
  assert.match(app, /raw === "pl" \? "en"/, "Polish falls back to English honestly");
  for (const f of ["pov.js", "pov-data.js", "pov-app.js", "pov.css"]) {
    const src = read(`public/games/son-100-gun/${f}`);
    assert.doesNotMatch(src, /AudioContext|new Audio|\.mp3|\.ogg|\.wav|speechSynthesis/, f);
    assert.doesNotMatch(src, /url\(|\.png|\.jpe?g|\.webp/, `${f} loads an image`);
  }
  const css = read("public/games/son-100-gun/pov.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /\bred\b|crimson|#f00\b|#ff0000|#c0392b|#e74c3c/i, "no alarm red");
  for (const stage of ["ogle", "ikindi", "aksam", "gece"])
    assert.match(css, new RegExp(`data-light="${stage}"`));
  const data = read("public/games/son-100-gun/pov-data.js");
  assert.match(data, /Original text written for\s*\/\/ TarikLab/);
});
