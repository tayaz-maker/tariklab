import test from "node:test";
import assert from "node:assert/strict";
import { SAVE_VERSION, createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { loadGame, migrateState, saveGame } from "../public/games/tc-sim/js/save.js";
import { applyDecision, canApplyDecision, getAvailableDecisions } from "../public/games/tc-sim/js/time.js";
import { openIcraNotice, objectIcra, recordIcraPayment, payIcra, planIcra, processIcraWeek, runHaciz, workaroundIcra } from "../public/games/tc-sim/js/icra.js";

import { processCashShortfall, CASH_ARREARS_CAP } from "../public/games/tc-sim/js/wealth.js";
import { openShop, processSemtWeek } from "../public/games/tc-sim/js/quarters.js";

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

function base() {
  const state = createNewGame({ name: "Icra", now: "2027-01-01T00:00:00.000Z", seed: 7 });
  state.finances.balance = 20000;
  state.finances.arrears = 0;
  state.time.absoluteWeek = 16;
  state.time.weekOfMonth = 2;
  state.time.year = 2027;
  state.time.month = 4;
  state.career.jobId = "market";
  state.events.active = null;
  state.events.queue = [];
  if (state.world?.scenario) state.world.scenario.pendingEvent = null;
  state.weekly = { used: 0, selectedIds: [] };
  return state;
}

function quiet(state) {
  state.events.active = null;
  state.events.queue = [];
  state.weekly = { used: 0, selectedIds: [] };
}

test("icra yazısı ödenince dosya kapanır ve temerrüt düşer", () => {
  const state = base();
  state.finances.arrears = 3000;
  const item = openIcraNotice(state, { source: "temerrut", amount: 3000 });
  assert.ok(item);
  assert.equal(SAVE_VERSION, 6);
  const ids = getAvailableDecisions(state).map((row) => row.id);
  assert.equal(ids.includes("icra-pay"), true);
  assert.equal(ids.includes("icra-installment"), true);
  const paid = applyDecision(state, "icra-pay");
  assert.equal(paid.ok, true);
  assert.match(paid.message, /kapandı/);
  assert.equal(state.finances.balance, 17000);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.equal(state.finances.arrears, 0);
  assert.equal(item.status, "resolved");
  assert.match(state.memories.at(-1).text, /İcra kapandı/);
  const storage = new MemoryStorage();
  assert.equal(saveGame(storage, state).ok, true);
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.state.meta.saveVersion, 6);
  assert.equal(loaded.state.finances.balance, 17000);
  assert.equal(loaded.state.finances.arrears, 0);
  assert.equal(loaded.state.flags.icra.banner.text.includes("kapandı"), true);
  assert.equal(validateState(loaded.state).ok, true);
  const raw = structuredClone(loaded.state);
  delete raw.flags.icra;
  const migrated = migrateState(raw);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.state.meta.saveVersion, 6);
  assert.equal(migrated.state.flags.icra.seized, "");
  assert.equal(migrated.state.flags.icra.banner, null);
});

test("yazıyı yok saymak nakitten sonra eşyayı iskontolu haciz eder", () => {
  const state = base();
  state.finances.balance = 400;
  state.wealth.durables.push({ id: "phone", price: 9000, acquiredWeek: 1 });
  const anne = state.relationships.anne;
  const item = openIcraNotice(state, { source: "esya", amount: 3000 });
  const ignored = applyDecision(state, "icra-ignore");
  assert.equal(ignored.ok, true);
  assert.match(ignored.message, /Eşya/);
  assert.equal(state.wealth.durables.some((row) => row.id === "phone"), false);
  assert.equal(state.wealth.vehicle, null);
  assert.equal(state.finances.balance, 0);
  assert.equal(state.finances.arrears, 710);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.equal(item.status, "resolved");
  assert.equal(state.flags.icra.seized, "goods");
  assert.equal(state.flags.icra.frozenWeek, state.time.absoluteWeek);
  assert.ok(state.relationships.anne < anne);
  assert.match(state.people.find((person) => person.id === "anne").memories.at(-1).text, /İcra/);
  assert.equal(canApplyDecision(state, "overtime").ok, false);
  assert.match(canApplyDecision(state, "overtime").reason, /İcra haftası/);
  quiet(state);
  assert.equal(canApplyDecision(state, "rest").ok, true);
  assert.equal(validateState(state).ok, true);
});

test("taksit peşinat ve masrafı tam TL yazar, sonraki ay taksit düşer", () => {
  const state = base();
  state.finances.balance = 5000;
  state.finances.arrears = 4000;
  state.time.weekOfMonth = 2;
  const item = openIcraNotice(state, { source: "temerrut", amount: 4000 });
  const plan = applyDecision(state, "icra-installment");
  assert.equal(plan.ok, true);
  assert.match(plan.message, /masraf 240 TL/);
  assert.equal(state.finances.balance, 3160);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.equal(item.payload.stage, "plan");
  assert.equal(item.payload.fee, 240);
  assert.equal(item.payload.owed, 2400);
  assert.equal(item.payload.installment, 600);
  assert.equal(state.finances.arrears, 2400);
  assert.equal(item.status, "pending");
  state.time.weekOfMonth = 1;
  const note = processIcraWeek(state);
  assert.match(note, /Taksit yattı/);
  assert.equal(state.finances.balance, 2560);
  assert.equal(item.payload.owed, 1800);
  assert.equal(state.finances.arrears, 1800);
  assert.equal(Number.isInteger(state.finances.balance), true);
  assert.equal(Number.isInteger(state.finances.arrears), true);
  assert.equal(validateState(state).ok, true);
});

test("D0: down payment, installment and early payoff leave no ghost arrears", () => {
  const state = base();
  state.finances.balance = 5000;
  state.finances.arrears = 4000;
  const item = openIcraNotice(state, { source: "temerrut", amount: 4000 });
  assert.ok(applyDecision(state, "icra-installment").ok);
  state.time.weekOfMonth = 1;
  processIcraWeek(state);
  assert.equal(state.finances.arrears, 1800);
  quiet(state);
  assert.ok(applyDecision(state, "icra-pay").ok);
  assert.equal(state.finances.balance, 760);
  assert.equal(state.finances.arrears, 0);
  assert.equal(item.payload.owed, 0);
  assert.equal(item.status, "resolved");
});

test("D0: enforcement retains all 300600 TL including cap overflow", () => {
  const state = base();
  state.finances.balance = 0;
  state.finances.arrears = 300000;
  const item = openIcraNotice(state, { source: "temerrut", amount: 300000 });
  assert.ok(applyDecision(state, "icra-workaround").ok);
  assert.equal(item.payload.owed, 300600);
  state.time.absoluteWeek = item.dueWeek;
  processIcraWeek(state);
  assert.equal(state.finances.arrears - state.finances.balance, 300600);
  assert.equal(item.status, "resolved");
  assert.equal(validateState(state).ok, true);
});

test("D0: installments and surcharge payoff preserve unrelated arrears", () => {
  for (const surcharge of [false, true]) {
    const state = base();
    state.finances.arrears = 4000;
    const item = openIcraNotice(state, { source: "temerrut", amount: 4000 });
    state.finances.arrears += 700;
    if (surcharge) {
      assert.ok(workaroundIcra(state).ok);
      assert.ok(payIcra(state).ok);
      assert.equal(state.finances.balance, 15400);
    } else {
      assert.ok(planIcra(state).ok);
      state.time.weekOfMonth = 1;
      for (let month = 0; month < 4; month += 1) {
        state.time.absoluteWeek += 4;
        processIcraWeek(state);
        assert.equal(state.finances.arrears, 700 + item.payload.owed);
      }
      assert.equal(state.finances.balance, 15760);
    }
    assert.equal(state.finances.arrears, 700);
    assert.equal(item.status, "resolved");
  }
});

test("D0: generic recovery collects only arrears outside the active claim", () => {
  const state = base();
  state.finances.balance = 5000;
  state.finances.arrears = 4000;
  const item = openIcraNotice(state, { source: "temerrut", amount: 4000 });
  assert.ok(planIcra(state).ok);
  assert.equal(processCashShortfall(state), null);
  assert.equal(state.finances.balance, 3160);
  state.finances.arrears += 200;
  assert.equal(processCashShortfall(state).amount, 200);
  assert.equal(state.finances.arrears, item.payload.owed);
  state.time.weekOfMonth = 1;
  processIcraWeek(state);
  assert.equal(processCashShortfall(state), null);
  assert.equal(state.finances.balance, 2360);
  assert.ok(payIcra(state).ok);
  assert.equal(state.finances.balance, 560);
  assert.equal(state.finances.arrears, 0);
});

test("D0: seizure reconciles cash, asset proceeds and unrelated arrears", () => {
  const state = base();
  state.finances.balance = 400;
  state.finances.arrears = 3700;
  state.wealth.durables.push({ id: "phone", price: 9000, acquiredWeek: 1 });
  const item = openIcraNotice(state, { source: "temerrut", amount: 3000 });
  assert.ok(runHaciz(state, item).ok);
  assert.equal(state.finances.balance, 0);
  assert.equal(state.finances.arrears, 1410); // 700 unrelated + 710 unpaid
  assert.equal(state.wealth.durables.length, 0);
  assert.equal(item.status, "resolved");
});

test("D0: ceiling transfer conserves liability across sources, retries and V5/V6 reload", () => {
  for (const source of ["temerrut", "esya"]) {
    const state = base();
    state.finances.balance = 0;
    state.finances.arrears = CASH_ARREARS_CAP;
    const amount = source === "temerrut" ? CASH_ARREARS_CAP : 600;
    const item = openIcraNotice(state, { source, amount });
    if (source === "temerrut") assert.ok(workaroundIcra(state).ok);
    assert.ok(runHaciz(state, item).ok);
    assert.equal(state.finances.arrears, CASH_ARREARS_CAP);
    assert.equal(state.finances.balance, -600);
    processIcraWeek(state);
    processCashShortfall(state);
    processCashShortfall(state);
    assert.equal(state.finances.arrears - state.finances.balance, 300600);
    for (const version of [5, 6]) {
      const raw = structuredClone(state);
      raw.meta.saveVersion = version;
      const migrated = migrateState(raw);
      assert.equal(migrated.ok, true);
      assert.equal(migrated.state.meta.saveVersion, 6);
      assert.equal(migrated.state.finances.arrears - migrated.state.finances.balance, 300600);
      const storage = new MemoryStorage();
      assert.equal(saveGame(storage, migrated.state).ok, true);
      const loaded = loadGame(storage);
      assert.equal(loaded.ok, true);
      assert.equal(loaded.state.finances.arrears - loaded.state.finances.balance, 300600);
    }
  }
});

test("D0: active legacy V5/V6 plans without sourceArrears remain payable after reload", () => {
  for (const version of [5, 6]) {
    const original = base();
    original.finances.balance = 5000;
    original.finances.arrears = 4000;
    openIcraNotice(original, { source: "temerrut", amount: 4000 });
    assert.ok(planIcra(original).ok);
    const raw = structuredClone(original);
    raw.meta.saveVersion = version;
    delete raw.openCases[0].payload.sourceArrears;
    const migrated = migrateState(raw);
    assert.equal(migrated.ok, true);
    const state = migrated.state;
    state.time.weekOfMonth = 1;
    assert.equal(processCashShortfall(state), null);
    processIcraWeek(state);
    assert.equal(state.finances.arrears, 1800);
    const storage = new MemoryStorage();
    assert.equal(saveGame(storage, state).ok, true);
    const loaded = loadGame(storage);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.state.openCases[0].payload.sourceArrears, 1800);
    assert.ok(payIcra(loaded.state).ok);
    assert.equal(loaded.state.finances.arrears, 0);
    assert.equal(loaded.state.finances.balance, 760);
    assert.equal(validateState(loaded.state).ok, true);
  }
});

test("D0: actual stall withholding reduces both claim and its source arrears", () => {
  const state = base();
  state.finances.balance = 900000;
  assert.ok(openShop(state, "ceper", "bakkal").ok);
  state.finances.arrears = 4000;
  const item = openIcraNotice(state, { source: "temerrut", amount: 4000 });
  state.time.absoluteWeek += 1;
  state.household.semt.shops[0].attentionWeek = state.time.absoluteWeek;
  const before = state.finances.balance;
  const control = structuredClone(state);
  control.openCases = [];
  processSemtWeek(control);
  const gross = control.finances.balance - before;
  assert.ok(gross > 0);
  const withheld = Math.round(gross * 0.1);
  processSemtWeek(state);
  assert.equal(state.finances.balance - before, gross - withheld);
  assert.equal(item.payload.owed, 4000 - withheld);
  assert.equal(state.finances.arrears, item.payload.owed);
  assert.ok(payIcra(state).ok);
  assert.equal(state.finances.arrears, 0);
});

test("D0: final rounded installment needs only the remaining claim", () => {
  const state = base();
  state.finances.arrears = 4001;
  const item = openIcraNotice(state, { source: "temerrut", amount: 4001 });
  assert.ok(planIcra(state).ok);
  state.time.weekOfMonth = 1;
  for (let month = 0; month < 3; month += 1) {
    state.time.absoluteWeek += 4;
    processIcraWeek(state);
  }
  assert.equal(item.payload.owed, 598);
  state.finances.balance = 598;
  state.time.absoluteWeek += 4;
  assert.match(processIcraWeek(state), /Son taksit/);
  assert.equal(state.finances.balance, 0);
  assert.equal(state.finances.arrears, 0);
  assert.equal(item.status, "resolved");
});


test("court review preserves debt, suspends enforcement and confirms only the live unpaid balance", () => {
  const state = base(); state.finances.arrears = 4000;
  const item = openIcraNotice(state, {source:"temerrut", amount:4000});
  const before = state.finances.balance;
  assert.ok(applyDecision(state,"icra-object").ok);
  assert.equal(state.weekly.used,1); assert.equal(state.finances.balance,before-300);
  assert.equal(state.finances.arrears,4000); assert.equal(item.payload.owed,4000);
  assert.equal(item.payload.stage,"court");
  const snapshot = JSON.stringify(state);
  assert.equal(objectIcra(state).ok,false); assert.equal(runHaciz(state,item).ok,false);
  assert.equal(JSON.stringify(state),snapshot);
  state.time.absoluteWeek += 1; processIcraWeek(state);
  assert.equal(item.payload.stage,"court");
  state.time.absoluteWeek += 1; processIcraWeek(state);
  assert.equal(item.payload.stage,"notice"); assert.equal(item.payload.review.status,"confirmed");
  assert.equal(item.payload.review.confirmedOwed,4000); assert.equal(state.finances.arrears,4000);
  const due = item.dueWeek; processIcraWeek(state); assert.equal(item.dueWeek,due);
  assert.equal(objectIcra(state).ok,false);
  assert.ok(planIcra(state).ok); // Existing D0 down payment/early close remains exact.
  state.time.weekOfMonth=1; processIcraWeek(state); assert.ok(payIcra(state).ok);
  assert.equal(state.finances.arrears,0); assert.equal(item.payload.owed,0);
  assert.equal(validateState(state).ok,true);
});

test("court review rejects late, unaffordable and stale requests without mutations", () => {
  for (const late of [false,true]) {
    const state=base(); state.finances.arrears=4000;
    const item=openIcraNotice(state,{source:"temerrut",amount:4000});
    if(late) state.time.absoluteWeek=item.dueWeek; else state.finances.balance=299;
    const before=JSON.stringify(state);
    assert.equal(objectIcra(state).ok,false); assert.equal(JSON.stringify(state),before);
  }
});

test("court pending V6 reload and legacy V5/V6 notices retain liabilities and do not replay costs", () => {
  for (const version of [5,6]) {
    const state=base(); state.finances.arrears=300000;
    const item=openIcraNotice(state,{source:"temerrut",amount:300000});
    assert.ok(workaroundIcra(state).ok);
    delete item.payload.sourceArrears; state.meta.saveVersion=version;
    const migration=migrateState(state); assert.ok(migration.ok);
    const active=migration.state; assert.ok(objectIcra(active).ok);
    const storage=new MemoryStorage(); assert.ok(saveGame(storage,active).ok);
    const loaded=loadGame(storage); assert.ok(loaded.ok); assert.equal(SAVE_VERSION,6);
    assert.equal(loaded.state.finances.balance,19700); assert.equal(loaded.state.finances.arrears,300000);
    assert.equal(objectIcra(loaded.state).ok,false);
    loaded.state.time.absoluteWeek+=2; processIcraWeek(loaded.state);
    const file=loaded.state.openCases.find(row=>row.type==="icra");
    assert.equal(file.payload.review.status,"confirmed");
    loaded.state.finances.balance=0; assert.ok(runHaciz(loaded.state,file).ok);
    assert.equal(loaded.state.finances.arrears,300000); assert.equal(loaded.state.finances.balance,-600);
    assert.equal(validateState(loaded.state).ok,true);
  }
});

test("payment during review settles once; partial collection cannot resurrect the original claim", () => {
  const state=base(); state.finances.arrears=4000;
  const item=openIcraNotice(state,{source:"temerrut",amount:4000});
  assert.ok(objectIcra(state).ok);
  // Same shared collection boundary used by the stall flow, not a second ledger.
  state.finances.balance-=600; recordIcraPayment(state,item,600);
  state.time.absoluteWeek+=2; processIcraWeek(state);
  assert.equal(item.payload.review.confirmedOwed,3400); assert.equal(state.finances.arrears,3400);
  assert.ok(payIcra(state).ok); assert.equal(state.finances.balance,15700);
  const other=base(); other.finances.arrears=4000;
  const file=openIcraNotice(other,{source:"temerrut",amount:4000});
  assert.ok(objectIcra(other).ok); assert.ok(payIcra(other).ok);
  assert.equal(file.payload.review.status,"settled");
  other.time.absoluteWeek+=2; processIcraWeek(other);
  assert.equal(other.finances.arrears,0); assert.equal(other.finances.balance,15700);
  assert.equal(file.payload.owed,0); assert.equal(runHaciz(other,file).ok,false);
});

test("court suspension covers actual stall withholding, which resumes after judgment", () => {
  const state=base(); state.finances.balance=900000;
  assert.ok(openShop(state,"ceper","bakkal").ok); state.finances.arrears=4000;
  const item=openIcraNotice(state,{source:"temerrut",amount:4000}); assert.ok(objectIcra(state).ok);
  state.time.absoluteWeek+=1; state.household.semt.shops[0].attentionWeek=state.time.absoluteWeek;
  const control=structuredClone(state); control.openCases=[];
  processSemtWeek(control); processSemtWeek(state);
  assert.equal(state.finances.balance,control.finances.balance);
  assert.equal(item.payload.owed,4000); assert.equal(state.finances.arrears,4000);
  state.time.absoluteWeek+=1; processIcraWeek(state);
  state.household.semt.shops[0].attentionWeek=state.time.absoluteWeek;
  const owed=item.payload.owed; processSemtWeek(state);
  assert.ok(item.payload.owed<owed); assert.equal(state.finances.arrears,item.payload.owed);
});
