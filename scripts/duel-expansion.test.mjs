import { fixture, place, act, decisions } from "./duel-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pools } from "./duel-pools.mjs";
import { createDuel, dispatch, rejection } from "../public/games/duel-core/rules.js";
import { serialize, deserialize } from "../public/games/duel-core/save.js";
import { legalActions } from "../public/games/duel-core/actions.js";
import { publicView } from "../public/games/duel-core/projection.js";
import { chooseAction } from "../public/games/duel-core/ai.js";
import {
  primaryTitle,
  cardActionTitle,
  dispatchPresented,
} from "../public/games/duel-core/presentation.js";
import { primitives } from "../public/games/duel-core/effects.js";
import { locate, validateState } from "../public/games/duel-core/model.js";

for (const [theme, pool] of Object.entries(pools)) {
  test(`${theme}: old 150 definitions remain mechanics-equivalent`, () => {
    const old = JSON.parse(readFileSync(`scripts/fixtures/duel/${theme}-old-pool.json`));
    const skip = new Set(["name", "text", "hint", "rulesNote", "nameEn", "textEn"]);
    for (let i = 0; i < 150; i++) {
      const a = pool[i],
        b = old[i];
      assert.equal(a.id, b.id);
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (skip.has(key)) continue;
        assert.deepEqual(a[key], b[key], `${a.id}.${key}`);
      }
    }
  });
  test(`${theme}: pre-expansion save retains exact payload and next draw`, () => {
    const raw = readFileSync(`scripts/fixtures/duel/${theme}-old-save.json`, "utf8");
    const old = JSON.parse(readFileSync(`scripts/fixtures/duel/${theme}-old-pool.json`));
    let a = deserialize(raw, old, theme).state,
      b = deserialize(raw, pool, theme).state;
    assert.equal(serialize(a), serialize(b));
    for (let i = 0; i < 15; i++) {
      const player = a.choice?.player ?? a.pending?.responding ?? a.active;
      const action = chooseAction(publicView(a, player), legalActions(a, player));
      if (!action) break;
      a = dispatch(a, action).state;
      b = dispatch(b, action).state;
      assert.equal(serialize(a), serialize(b));
    }
  });
  test(`${theme}: 300 distinct identities and executable bilingual expansion definitions`, () => {
    assert.equal(pool.length, 300);
    assert.equal(new Set(pool.map((c) => c.id)).size, 300);
    const newCards = pool.slice(150),
      counts = Object.fromEntries(
        ["unit", "spell", "trap"].map((k) => [k, newCards.filter((c) => c.kind === k).length]),
      );
    assert.deepEqual(
      counts,
      theme === "veto-h" ? { unit: 88, spell: 37, trap: 25 } : { unit: 90, spell: 35, trap: 25 },
    );
    const inspect = (x) => {
      if (!x || typeof x !== "object") return;
      if (x.op) assert.equal(typeof primitives[x.op], "function", x.op);
      Object.values(x).forEach(inspect);
    };
    for (const [i, c] of newCards.entries()) {
      assert.equal(Number(c.id.slice(4)), i + 151);
      assert.ok(c.name.tr && c.name.en && c.text.tr && c.text.en && c.hint.tr && c.hint.en, c.id);
      assert.ok([c.attack, c.defense, c.level].every(Number.isFinite), c.id);
      assert.ok(c.effects.length || c.triggers.length || Object.keys(c.traits).length, c.id);
      inspect(c);
    }
  });
  test(`${theme}: each new activated card has a realizable legal action and deterministic resolution`, () => {
    for (const def of pool.slice(150).filter((c) => c.effects.length || c.kind === "spell")) {
      let s = createDuel(pool, theme, 72);
      s.phase = "main1";
      s.turn = 3;
      for (const p of s.players) {
        p.deck.push(...p.hand);
        p.hand = [];
      }
      let serial = 0;
      const place = (d, player, zone, slot = 0, face = "up") => {
        const uid = `test:${++serial}`;
        s.cards[uid] = {
          id: d.id,
          owner: player,
          face,
          position: "attack",
          setTurn: 1,
          summonedTurn: 1,
          positionTurn: 1,
          attacksUsed: 0,
          modifiers: [],
          used: {},
          knownTo: [true, true],
        };
        if (["units", "support"].includes(zone)) s.players[player][zone][slot] = uid;
        else s.players[player][zone].push(uid);
        return uid;
      };
      const own =
        pool.find(
          (c) => c.kind === "unit" && c.series.some((x) => def.series.includes(x)) && c.level <= 2,
        ) || pool[0];
      place(own, 0, "units", 1);
      place(own, 0, "grave");
      place(own, 0, "banished");
      place(own, 0, "deck");
      place(own, 0, "hand");
      place(own, 0, "hand");
      place(
        pool.find((c) => c.kind === "trap"),
        0,
        "grave",
      );
      const enemy = place(
        pool.find((c) => c.kind === "unit" && c.level <= 2),
        1,
        "units",
        0,
      );
      place(
        pool.find((c) => c.kind === "spell"),
        1,
        "support",
        0,
      );
      place(
        pool.find((c) => c.kind === "trap"),
        1,
        "support",
        1,
        "down",
      );
      place(pool[0], 1, "grave");
      const uid = place(
        def,
        0,
        def.kind === "unit" ? "units" : def.kind === "trap" ? "support" : "hand",
        0,
        def.kind === "trap" ? "down" : "up",
      );
      if (def.kind === "trap")
        s.pending = {
          action: {
            type: def.traits.responseTypes[0],
            player: 1,
            card: enemy,
            target: def.traits.directOnly ? null : s.players[0].units[1],
            revision: s.revision,
          },
          responding: 0,
          negated: false,
        };
      if (def.kind === "trap" && def.traits.responseKinds) {
        const spell = place(
          pool.find((c) => c.kind === "spell"),
          1,
          "hand",
        );
        s.pending.action.card = spell;
      }
      const action = legalActions(s, 0).find(
        (a) => a.card === uid && a.type === (def.kind === "trap" ? "respond" : "activate"),
      );
      assert.ok(action, `${def.id}: no legal activation in populated fixture`);
      const before = serialize(s),
        result = dispatch(s, action);
      assert.equal(result.ok, true, `${def.id}: ${result.error}`);
      s = result.state;
      for (let i = 0; (s.pending || s.choice) && i < 40; i++) {
        const p = s.choice?.player ?? s.pending?.responding ?? s.active;
        const a = chooseAction(publicView(s, p), legalActions(s, p));
        assert.ok(a, def.id);
        const loaded = deserialize(serialize(s), pool, theme);
        assert.ok(loaded.ok, def.id);
        const live = dispatch(s, a),
          restored = dispatch(loaded.state, a);
        assert.deepEqual(restored, live, def.id);
        assert.ok(live.ok, def.id);
        s = live.state;
      }
      assert.ok(!s.pending && !s.choice, `${def.id}: did not settle`);
      assert.ok(validateState(s), def.id);
      assert.notEqual(serialize(s), before, def.id);
      assert.equal(rejection(s, action), "stale-action", def.id);
      assert.ok(locate(s, uid), def.id);
    }
  });
}
test("contextual primary action vocabulary has no generic phase CTA", () => {
  for (const lang of ["tr", "en"])
    for (const theme of ["veto-h", "gett-oh"])
      for (const phase of ["draw", "standby", "main1", "battle", "main2", "end"]) {
        const label = primaryTitle({ phase, turn: 2 }, theme, lang);
        assert.ok(label);
        assert.doesNotMatch(label, /Sonraki Evre|Next Phase/i);
      }
  assert.equal(primaryTitle({ phase: "draw", turn: 1 }, "veto-h", "tr"), "Kart Çek");
  assert.equal(primaryTitle({ phase: "main1", turn: 1 }, "gett-oh", "tr"), "Turu Bitir");
  assert.equal(
    cardActionTitle({ type: "attack", target: null }, {}, {}, "gett-oh", "tr", ""),
    "Kapıya Dayan",
  );
});

test("one Draw click draws once; empty End resolves once; oversized hand stops", () => {
  let s = createDuel(pools["veto-h"], "veto-h", 901);
  const action = { type: "phase", player: 0, revision: s.revision };
  s = dispatchPresented(s, action).state;
  assert.equal(s.players[0].hand.length, 6);
  assert.equal(s.phase, "standby");
  assert.equal(dispatchPresented(s, action).error, "stale-action");
  s = dispatchPresented(s, { type: "phase", player: 0, revision: s.revision }).state;
  const end = { type: "end-main", player: 0, revision: s.revision };
  s = dispatchPresented(s, end).state;
  assert.equal(s.turn, 2);
  assert.equal(s.phase, "draw");
  assert.equal(s.active, 1);
  assert.equal(dispatchPresented(s, end).error, "stale-action");
  s.phase = "main2";
  s.active = 0;
  s.players[0].hand.push(s.players[0].deck.shift());
  s = dispatchPresented(s, { type: "end-main", player: 0, revision: s.revision }).state;
  assert.equal(s.phase, "end");
  assert.equal(s.turn, 2);
  assert.equal(s.players[0].hand.length, 7);
});

for (const [theme, pool] of Object.entries(pools)) {
  test(`${theme}: old response window and set ages preserve action rights`, () => {
    const raw = readFileSync(`scripts/fixtures/duel/${theme}-old-response.json`, "utf8");
    let s = deserialize(raw, pool, theme).state;
    assert.ok(s.pending);
    assert.equal(serialize(s), raw);
    for (let i = 0; i < 50 && !s.result; i++) {
      const p = s.choice?.player ?? s.pending?.responding ?? s.active;
      const a = chooseAction(publicView(s, p), legalActions(s, p));
      const reload = deserialize(serialize(s), pool, theme).state;
      assert.deepEqual(legalActions(reload, p), legalActions(s, p));
      const live = dispatch(s, a),
        loaded = dispatch(reload, a);
      assert.deepEqual(live, loaded);
      assert.ok(live.ok);
      s = live.state;
    }
  });
}

for (const [theme, pool] of Object.entries(pools)) {
  test(`${theme}: every new summon, flip, upkeep and destruction trigger executes its printed consequence`, () => {
    for (const def of pool.slice(150).filter((c) => c.triggers.length)) {
      let s = fixture(theme);
      const buddy = pool.find(
        (c) => c.kind === "unit" && c.series.some((x) => def.series.includes(x)) && c.level <= 2,
      );
      assert.ok(buddy, def.id);
      const grave = place(s, buddy.id, 0, "grave");
      place(s, buddy.id, 0, "deck");
      place(s, buddy.id, 0, "units", 1);
      const equip = place(s, pool.find((c) => c.subtype === "equip").id, 0, "grave");
      const trigger = def.triggers[0],
        event = trigger.event;
      const uid = place(s, def.id, 0, event === "summon" ? "hand" : "units");
      const pointsBefore = s.players[0].points;
      if (event === "summon") {
        s = decisions(act(s, { type: "summon", card: uid, slot: 0, tributes: [] }));
        assert.equal(locate(s, uid).zone, "units");
        assert.ok(
          s.players[0].hand.some((x) => s.catalog[s.cards[x].id].series.includes(def.series[0])),
          def.id,
        );
        const amount = trigger.effects
          .filter((x) => x.op === "points")
          .reduce((n, x) => n + x.amount, 0);
        assert.equal(s.players[0].points, pointsBefore + amount, def.id);
      } else if (event === "standby") {
        s.phase = "draw";
        s = decisions(act(s, { type: "phase" }));
        assert.equal(s.players[0].points, pointsBefore + trigger.effects[0].amount, def.id);
      } else if (event === "flip") {
        s.cards[uid].face = "down";
        s.cards[uid].position = "defense";
        const hidden = place(s, pool.find((c) => c.kind === "trap").id, 1, "support");
        s.cards[hidden].knownTo = [false, true];
        s = decisions(act(s, { type: "position", card: uid }));
        if (theme === "gett-oh") assert.equal(locate(s, equip).zone, "hand", def.id);
        else if (trigger.effects.some((x) => x.op === "reveal"))
          assert.equal(s.cards[hidden].knownTo[0], true, def.id);
        else
          assert.ok(
            s.players[0].units.some((x) => x && s.cards[x].position === "defense"),
            def.id,
          );
      } else if (event === "tribute") {
        const boss = place(
          s,
          pool.find((c) => c.kind === "unit" && c.deckLocation === "main" && c.level === 5).id,
          0,
          "hand",
        );
        s = decisions(act(s, { type: "summon", card: boss, slot: 0, tributes: [uid] }));
        assert.equal(s.players[0].points, pointsBefore + trigger.effects[0].amount, def.id);
      } else if (event === "destroy") {
        const strong = pool.filter((c) => c.kind === "unit").sort((a, b) => b.attack - a.attack)[0];
        const target = place(s, strong.id, 1, "units");
        s.phase = "battle";
        s = decisions(act(s, { type: "attack", card: uid, target }));
        assert.equal(locate(s, uid).zone, "grave", def.id);
        assert.equal(locate(s, grave).zone, "hand", def.id);
      } else assert.fail(`${def.id}: untested trigger ${event}`);
      assert.ok(validateState(s), def.id);
    }
  });
}

test("expansion traps retain the legacy Scandal/Tip-off/Notice search identity", () => {
  const trapSeries = { "veto-h": "Skandal", "gett-oh": "İhbar" };
  for (const [theme, pool] of Object.entries(pools))
    for (const c of pool.slice(150).filter((c) => c.kind === "trap"))
      assert.ok(c.series.includes(trapSeries[theme]), `${c.id} series=${c.series}`);
});
test("new discard clauses consume real other cards, never their resolving source", () => {
  let s = fixture("veto-h");
  const source = place(s, "SND-275", 0, "hand");
  place(s, "SND-001", 0, "hand");
  place(s, "SND-002", 0, "hand");
  const hand = s.players[0].hand.length,
    deck = s.players[0].deck.length;
  s = act(s, { type: "activate", card: source });
  assert.ok(s.choice);
  assert.equal(s.choice.count, 2);
  assert.ok(!s.choice.ids.includes(source));
  s = decisions(s);
  assert.equal(s.players[0].deck.length, deck - 2);
  assert.equal(s.players[0].hand.length, hand - 1);
  assert.equal(s.players[0].grave.length, 3);
  assert.equal(s.players[0].points, 6800);
});
test("new control and revival costs cannot be wasted into a full unit field", () => {
  const s = fixture("veto-h");
  for (let i = 0; i < 5; i++) place(s, "SND-001", 0, "units", i);
  place(s, "SND-002", 1, "units");
  const card = pools["veto-h"].find(
    (c) => Number(c.id.slice(4)) > 150 && c.effects.some((op) => op.op === "control"),
  );
  const source = place(s, card.id, 0, "hand");
  // Supply its own-family prerequisite as well, without opening a zone.
  s.cards[s.players[0].units[0]].id = pools["veto-h"].find(
    (c) => c.kind === "unit" && c.series.includes(card.series[0]),
  ).id;
  const before = serialize(s);
  assert.equal(
    rejection(s, { type: "activate", card: source, player: 0, revision: s.revision }),
    "unit-zone-required",
  );
  assert.equal(serialize(s), before);
});
