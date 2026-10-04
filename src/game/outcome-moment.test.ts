import assert from "node:assert/strict";
import test from "node:test";
import { hydratePlayer, makeRivals } from "./data.ts";
import { buildOutcomeMoment, createMomentGate, describeOutcomeMoment, type OutcomeSnapshot } from "./outcome-moment.ts";

const snap = (changes = {}): OutcomeSnapshot => ({ activeSlot: 1, rivals: makeRivals(), player: hydratePlayer({ name: "Test", neighborhood: "eyup", ...changes }) });
const success = (a: OutcomeSnapshot, changes = {}): OutcomeSnapshot => ({ ...a, player: { ...a.player!, jobsDone: a.player!.jobsDone + 1, cash: a.player!.cash + 1370, itibar: a.player!.itibar + 3, isi: a.player!.isi + 8, energy: a.player!.energy - 4, ...changes } });

test("actual committed contract deltas produce an immutable deterministic receipt", () => {
  const a = snap({ contractId: "c101", contractGun: 1 });
  const b = success(a, { contractId: null });
  const raw = JSON.stringify([a, b]);
  const oldRandom = Math.random;
  Math.random = () => { throw Error("presentation drew gameplay RNG"); };
  try {
    const m = buildOutcomeMoment(a, b, "j101")!;
    assert.equal(m.title, "KAYIT KAPANDI");
    assert.equal(m.cash, 1370); assert.equal(m.pressure, 8);
    assert.equal(m.reputation, 3); assert.equal(m.energy, -4);
    assert.match(m.summary, /Nakit \+1.370/);
    assert.equal(m.crew.count, 0); assert.equal(m.reactions.count, 0);
    assert.equal(m.layers.blocks.length, 7);
    assert.deepEqual(m, buildOutcomeMoment(a, b, "j101"));
    assert.equal(JSON.stringify([a, b]), raw);
    assert.equal(describeOutcomeMoment(m, true).title, "RECORD CLOSED");
  } finally { Math.random = oldRandom; }
});

test("no event on hydration, failed/blocked jobs, clock tick, unknown job or slot adoption", () => {
  const a = snap();
  for (const b of [a, { ...a, player: null }, success(a, { jobsDone: 0 }), { ...success(a), activeSlot: 2 }, success(a, { name: "Other" })]) {
    assert.equal(buildOutcomeMoment(a, b, "j101"), null);
  }
  assert.equal(buildOutcomeMoment(a, success(a), "ghost"), null);
  assert.equal(buildOutcomeMoment({ ...a, player: null }, success(a), "j101"), null);
});

test("only first job, closed contract, five-level threshold or multi-crew operation qualifies", () => {
  const a = snap({ contractId: null });
  assert.equal(buildOutcomeMoment(a, success(a), "j101")!.kind, "first");
  const regular = snap({ jobsDone: 10, level: 3, contractId: null });
  assert.equal(buildOutcomeMoment(regular, success(regular, { level: 4 }), "j101"), null);
  assert.equal(buildOutcomeMoment(regular, success(regular, { level: 5 }), "j101")!.kind, "rank");
  const one = snap({ jobsDone: 2, crew: ["gozcu"], contractId: null });
  assert.equal(buildOutcomeMoment(one, success(one, { crewBusy: { gozcu: 4 } }), "j101"), null);
});

test("crew duration and extended reaction counters are read from engine output, not forecasts", () => {
  const a = snap({ jobsDone: 10, contractId: null, crew: ["gozcu", "sofor"] });
  const b = success(a, { crewBusy: { gozcu: 8, sofor: 6 } });
  b.rivals = a.rivals.map((r, i) => ({ ...r, hospitalTicks: 0, revengeTicks: i < 2 ? 6 + i * 5 : 0 }));
  const m = buildOutcomeMoment(a, b, "j101")!;
  assert.equal(m.kind, "operation");
  assert.deepEqual(m.crew, { count: 2, ticks: 8 });
  assert.deepEqual(m.reactions, { count: 2, minTicks: 6, maxTicks: 11 });
  assert.match(m.delaySummary, /200 ₺ üstündeyse/);
});

test("no invented pressure beyond cap, no payout promise and no changed save shape", () => {
  const a = snap({ isi: 100 }); const b = success(a, { isi: 100 });
  const m = buildOutcomeMoment(a, b, "j101")!;
  assert.equal(m.pressure, 0);
  assert.match(m.delaySummary, /mevcut riskler sürüyor/);
  assert.deepEqual(Object.keys(a.player!), Object.keys(b.player!));
});

test("duplicate and burst gate does not queue or replay suppressed moments", () => {
  const a = snap(); const m = buildOutcomeMoment(a, success(a), "j101")!;
  const gate = createMomentGate();
  assert.equal(gate(null, 0), false);
  assert.equal(gate(m, 0), true);
  assert.equal(gate(m, 10000), false);
  assert.equal(gate({ ...m, id: "burst" }, 1), false);
  assert.equal(gate({ ...m, id: "burst" }, 10000), false);
  assert.equal(gate({ ...m, id: "later" }, 2500), true);
});

test("actual store action and persistence are unchanged by producing the moment", async () => {
  const values = new Map<string, string>();
  Object.assign(globalThis, {
    window: { localStorage: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) }, location: { search: "" }, addEventListener() {} },
    document: { addEventListener() {} },
  });
  const { useGame } = await import("./store.ts");
  const { ALL_MISSIONS } = await import("./data.ts");
  useGame.getState().createPlayer("Actual", "eyup");
  const mission = ALL_MISSIONS.find((m) => m.risk === "Çok Yüksek")!;
  useGame.setState({ player: hydratePlayer({ ...useGame.getState().player!, level: 100, jobsDone: 10, contractId: null, energy: 1000, cash: 100000, crew: ["gozcu", "sofor"], inventory: mission.requiredItems ?? [] }) });
  const a = useGame.getState();
  const random = Math.random; Math.random = () => 0.1;
  try { useGame.getState().doJob(mission.id); } finally { Math.random = random; }
  const b = useGame.getState();
  assert.equal(b.player!.jobsDone, 11);
  const raw = values.get("tariklab::cete:1");
  const m = buildOutcomeMoment(a, b, mission.id)!;
  assert.equal(m.kind, "operation");
  assert.equal(m.cash, b.player!.cash - a.player!.cash);
  assert.equal(m.crew.ticks, 8);
  assert.match(m.crewSummary, /80 oyun dk/);
  assert.equal(values.get("tariklab::cete:1"), raw);
});
