import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGame } from "./racon-harness.mjs";
const w = {};
new Function("window", readFileSync("public/games/racon/network.js", "utf8"))(w);
const Ag = w.RaconAg;
test("repro: inherited Object keys are not street orders", () => {
  for (const kind of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
    assert.deepEqual(
      Ag.normalize({ orders: [{ street: "st_fevzi", kind, left: 2, from: 1 }] }).orders,
      [],
    );
    const S = { streets: [{ id: "st_fevzi" }], kasa: 20000 };
    assert.equal(Ag.preview(S, "st_fevzi", kind), null);
    assert.equal(Ag.start(S, "st_fevzi", kind), false);
    assert.equal(S.kasa, 20000);
  }
});
test("malformed order duration, duplicate streets and oversized counters are rejected", () => {
  for (const left of [0.1, -1, Infinity, 1e9, "2"]) {
    assert.equal(
      Ag.normalize({ orders: [{ street: "st_fevzi", kind: "koru", left }] }).orders.length,
      0,
    );
  }
  const order = { street: "st_fevzi", kind: "koru", left: 2, from: 1 };
  assert.equal(Ag.normalize({ orders: [order, order] }).orders.length, 1);
});
test("slot save migration discards inherited kinds and preserves a real active order", () => {
  const g = loadGame();
  g.ev(
    'blank("Repro");enterPlay();S.ag={orders:[{street:"st_fevzi",kind:"__proto__",left:2},{street:"st_aksem",kind:"iliski",left:2,from:1}],log:[]};writeSave();S=loadSave();',
  );
  assert.deepEqual(g.ev("S.ag.orders.map(x=>x.kind)"), ["iliski"]);
  assert.doesNotThrow(() => g.ev('S.screen="harita";screenHtml()'));
});
