import assert from "node:assert/strict";
import test from "node:test";
import { apply, createCoast, deserialize, legal, serialize } from "../public/games/esik/sim.js";

test("incomplete v1 stair saves are rejected before legal moves dereference ramps", () => {
  const record = JSON.parse(serialize(apply(createCoast(3), "bagla:merdiven")));
  delete record.state.ramps;
  assert.equal(deserialize(JSON.stringify(record)), null);
});

test("v1 validation rejects malformed consumer fields without mutating the source", () => {
  const mutations = [
    (s) => { s.line = ["missing"]; },
    (s) => { s.line = ["rampa", "rampa"]; },
    (s) => { s.ramps = ["rihtim"]; },
    (s) => { s.ramps = ["yokus"]; },
    (s) => { s.pending = null; },
    (s) => { s.pending = [{ tag: "rush", risk: "5" }]; },
    (s) => { s.pending = [{ tag: "ramp", access: -1 }]; },
    (s) => { s.fault = { id: "missing", reason: "stair" }; },
    (s) => { s.log = [null]; },
    (s) => { s.log = [{ k: "bagla", id: "missing" }]; },
    (s) => { s.log = [{ k: "period", n: 90 }]; },
    (s) => { s.phase = "unknown"; },
    (s) => { s.phase = "end"; },
    (s) => { s.ending = "invented"; },
    (s) => { s.version = 2; },
    (s) => { s.seed = -1; },
    (s) => { s.period = 0; },
    (s) => { s.resource = "9"; },
    (s) => { s.trust = 101; },
    (s) => { s.risk = null; },
    (s) => { s.access = 1.5; },
    (s) => { s.built = 10; },
  ];
  for (const mutate of mutations) {
    const record = JSON.parse(serialize(createCoast(3)));
    mutate(record.state);
    const raw = JSON.stringify(record);
    assert.equal(deserialize(raw), null, mutate.toString());
    assert.equal(JSON.stringify(record), raw);
  }
  for (const raw of [null, "", "null", "[]", "{", " ".repeat(65537)]) assert.equal(deserialize(raw), null);
});

test("reachable v1 decisions and all four endings round-trip with identical next moves", () => {
  const endings = new Set();
  const verify = (state) => {
    const raw = serialize(state);
    const restored = deserialize(raw);
    assert.deepEqual(restored, state);
    assert.equal(serialize(restored), raw);
    assert.deepEqual(legal(restored), legal(state));
    for (const move of legal(state)) assert.deepEqual(apply(restored, move), apply(state, move));
    if (state.ending) endings.add(state.ending);
  };
  for (const moves of [
    ["bagla:rampa", "bagla:merdiven", "rampa:merdiven", "kapat", "bagla:iskele", "bagla:rihtim", "kapat", "bagla:tunel", "kapat", "bagla:yokus", "kapat", "rampa:yokus", "kapat", "bagla:kopru", "kapat"],
    ["bagla:rampa", "bagla:merdiven", "rampa:merdiven", "kapat", "bagla:iskele", "kapat", "bagla:yokus", "rampa:yokus", "kapat", "bekle", "bekle", "bekle"],
  ]) {
    let state = createCoast(4294967295);
    verify(state);
    for (const move of moves) { state = apply(state, move); verify(state); }
  }
  let random = 7321;
  for (let seed = 1; seed <= 500; seed++) {
    let state = createCoast(seed);
    verify(state);
    while (state.phase !== "end") {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      const moves = legal(state);
      state = apply(state, moves[random % moves.length]);
      verify(state);
    }
  }
  assert.deepEqual([...endings].sort(), ["kopuk", "mahalle", "surekli", "yorgun"]);
});
