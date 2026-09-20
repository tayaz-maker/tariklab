import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { applyAction, create, normalize } from "../public/games/next-wave.js";
import {
  CHAINS as APARTMAN_CHAINS,
  applyApartmanEventChoice,
  coverage as apartmanCoverage,
  tickApartmanChains,
} from "../public/games/next-wave/apartman-chains.js";
import { loadGame } from "./racon-harness.mjs";

const copy = (value) => JSON.parse(JSON.stringify(value));

function finiteTree(value, path = "root") {
  if (value == null) return;
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value), `NaN/Inf at ${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => finiteTree(item, `${path}[${i}]`));
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) finiteTree(item, `${path}.${key}`);
  }
}

test("content coverage: unique ids, no filler-count cheat, targets met", () => {
  const apt = apartmanCoverage();
  assert.equal(apt.chains, 24);
  assert.ok(apt.nodes >= 90, `apartman nodes ${apt.nodes}`);
  assert.ok(apt.delayed >= 35, `apartman delayed ${apt.delayed}`);
  assert.ok(apt.memory >= 30, `apartman memory ${apt.memory}`);
  assert.ok(apt.macro >= 12, `apartman macro ${apt.macro}`);
  assert.ok(apt.politics >= 10, `apartman politics ${apt.politics}`);
  assert.ok(apt.residentLinks >= 20, `apartman resident↔resident ${apt.residentLinks}`);
  assert.ok(apt.exclusive >= 6, `apartman exclusive ${apt.exclusive}`);
  assert.equal(new Set(apt.ids).size, apt.ids.length, "duplicate apartman node ids");

  const game = loadGame();
  const cov = game.win.RaconContent.coverage();
  assert.equal(cov.npcs, 16);
  assert.equal(cov.chains, 24);
  assert.ok(cov.nodes >= 90, `racon nodes ${cov.nodes}`);
  assert.ok(cov.delayed >= 35, `racon delayed ${cov.delayed}`);
  assert.ok(cov.memory >= 30, `racon memory ${cov.memory}`);
  assert.ok(cov.identity >= 20, `racon identity ${cov.identity}`);
  assert.ok(cov.exclusive >= 12, `racon exclusive chains ${cov.exclusive}`);
  assert.deepEqual(cov.duplicateIds, []);
});

test("Apartman preserves the resident council while offering 2/4/10-block estates", () => {
  const source = fs.readFileSync(new URL("../public/games/apartman/app.js", import.meta.url), "utf8");
  const state = create("apartman");
  assert.equal(state.residents.length, 14);
  assert.match(source, /\[2,4,10\]/);
  assert.match(source, /siteScale \* 16/);
  assert.match(source, /Malik \/ kiracı dengesi/);
});

test("Wave 1 closure: all Apartman nodes have satisfiable gates and valid callbacks", () => {
  const nodeIds = new Set(APARTMAN_CHAINS.flatMap((chain) => chain.stages.map((node) => node.id)));
  const callbackIds = [];
  let reachable = 0;
  for (const chain of APARTMAN_CHAINS) {
    for (let stage = 0; stage < chain.stages.length; stage += 1) {
      const node = chain.stages[stage];
      const priorChoices = chain.stages.slice(0, stage).flatMap((item) => item.choices || []);
      if (node.requireFlag) {
        assert.ok(priorChoices.some((choice) => choice.effects?.flags?.[node.requireFlag]), `${node.id} flag gate has no producer`);
      }
      if (node.requireMemory) {
        assert.ok(priorChoices.some((choice) => (choice.effects?.remember || []).some((m) => m.who === node.requireMemory.who && m.type === node.requireMemory.type)), `${node.id} memory gate has no producer`);
      }
      for (const choice of node.choices || []) {
        const next = choice.effects?.schedule?.next;
        assert.ok(next == null || next === "done" || next === "dead" || (Number.isInteger(next) && next >= 0 && next < chain.stages.length), `${node.id}/${choice.id} invalid continuation`);
        if (choice.effects?.schedule?.id) callbackIds.push(choice.effects.schedule.id);
      }
      const state = create("apartman");
      state.activeEvent = null;
      state.eventDirector = { history: [], cooldowns: {} };
      state.week = Math.max(node.minWeek || 1, node.minPhaseWeek || 1);
      state.politics.confidence = node.maxConfidence != null ? node.maxConfidence : Math.max(58, node.minConfidence || 0);
      state.progression.investments = Math.max(state.progression.investments, node.minInvestments || 0);
      if (node.phase) state.progression.phase = node.phase;
      state.flags.chains = Object.fromEntries(APARTMAN_CHAINS.map((item) => [item.id, { stage: 0, status: item.id === chain.id ? "idle" : "dead" }]));
      state.flags.chains[chain.id].stage = stage;
      state.flags.chainFlags = {};
      if (node.requireFlag) state.flags.chainFlags[node.requireFlag] = 1;
      if (node.forbidFlag) state.flags.chainFlags[node.forbidFlag] = 0;
      if (node.requireMemory) state.residents.find((r) => r.id === node.requireMemory.who).memories.push({ id: `gate-${node.id}`, type: node.requireMemory.type, turn: state.week });
      tickApartmanChains(state);
      assert.equal(state.activeEvent?.nodeId, node.id, `${node.id} is synthetically unreachable`);
      reachable += 1;
    }
  }
  assert.equal(reachable, 95);
  assert.equal(nodeIds.size, 95);
  assert.equal(new Set(callbackIds).size, callbackIds.length, "duplicate explicit Apartman callback id");
});

test("Wave 1 closure: Apartman v1 migration is idempotent and state growth is bounded", () => {
  const legacy = create("apartman");
  legacy.meta.version = 1;
  delete legacy.politics;
  delete legacy.progression;
  delete legacy.eventDirector;
  delete legacy.delayedEffects;
  const once = normalize("apartman", copy(legacy));
  const twice = normalize("apartman", copy(once));
  assert.deepEqual(twice, once);

  const state = create("apartman");
  state.politics.electionDue = 9999;
  const sizes = [];
  for (let turn = 0; turn < 208; turn += 1) {
    if (state.activeEvent) {
      const choice = state.activeEvent.choices[turn % state.activeEvent.choices.length];
      applyAction("apartman", state, `event-choice:${state.activeEvent.chainId}:${state.activeEvent.nodeId}:${choice.id}`);
    }
    const issue = state.issues.find((item) => item.status === "acik");
    if (issue) applyAction("apartman", state, `focus:${issue.id}`);
    applyAction("apartman", state, `proposal:${["durable-maintenance", "cheap-patch", "raise-dues", "wait"][turn % 4]}`);
    applyAction("apartman", state, "advance");
    if ([52, 104, 208].includes(turn + 1)) sizes.push(JSON.stringify(state).length);
  }
  assert.equal(sizes.length, 3);
  assert.ok(state.history.length <= 80);
  assert.ok(state.eventDirector.history.length <= 40);
  assert.ok(state.delayedEffects.length <= 40);
  assert.ok(state.issues.length < 80);
  assert.ok(sizes[2] < 180_000, `Apartman save grew to ${sizes[2]} bytes`);
  assert.ok(sizes[2] < sizes[1] * 1.6, `Apartman save growth accelerated: ${sizes.join(",")}`);
});

test("Wave 1 closure: cash-constrained policies preserve distinct rational trade-offs", () => {
  const cases = [500, 2000, 4000, 8000, 12000, 50000];
  const policies = ["durable-maintenance", "cheap-patch", "raise-dues", "wait"];
  const results = [];
  for (const cash of cases) {
    for (const policy of policies) {
      const state = create("apartman");
      state.finance.cash = cash;
      state.politics.electionDue = 999;
      for (let turn = 0; turn < 52; turn += 1) {
        if (state.activeEvent) {
          const choices = state.activeEvent.choices;
          const index = policy === "durable-maintenance" ? 0 : policy === "cheap-patch" ? 1 : choices.length - 1;
          const choice = choices[index] || choices.at(-1);
          applyAction("apartman", state, `event-choice:${state.activeEvent.chainId}:${state.activeEvent.nodeId}:${choice.id}`);
        }
        const issue = state.issues.find((item) => item.status === "acik");
        if (issue) applyAction("apartman", state, `focus:${issue.id}`);
        applyAction("apartman", state, `proposal:${policy}`);
        applyAction("apartman", state, "advance");
      }
      results.push({ cash, policy, endCash: state.finance.cash, condition: state.building.condition, confidence: state.politics.confidence });
    }
  }
  for (const cash of cases) {
    const rows = results.filter((row) => row.cash === cash);
    const durable = rows.find((row) => row.policy === "durable-maintenance");
    assert.equal(Math.max(...rows.map((row) => row.condition)), durable.condition, `durable should buy best condition at cash ${cash}`);
    assert.ok(rows.some((row) => row.endCash > durable.endCash), `cheaper policy needs a liquidity use at cash ${cash}`);
    assert.ok(new Set(rows.map((row) => `${Math.round(row.condition)}:${Math.round(row.confidence)}:${Math.round(row.endCash)}`)).size >= 3);
  }
});

test("Apartman: su-kolon walks, delayed callback fires once, save/load mid-chain", () => {
  const state = create("apartman");
  state.activeEvent = null;
  state.flags.chains = {};
  for (const chain of APARTMAN_CHAINS) {
    if (chain.id !== "su-kolon") state.flags.chains[chain.id] = { stage: 0, status: "dead" };
  }
  state.week = 2;
  tickApartmanChains(state);
  assert.equal(state.activeEvent?.chainId, "su-kolon");
  assert.equal(state.activeEvent.nodeId, "su-kolon-1");
  applyAction("apartman", state, "event-choice:su-kolon:su-kolon-1:usta");
  assert.equal(state.activeEvent, null);
  const murat = state.residents.find((r) => r.id === "r2");
  assert.ok(murat.memories.some((m) => m.type === "taraf-tuttu"));
  assert.equal(state.delayedEffects.filter((e) => e.status === "pending").length, 1);
  const mid = copy(state);
  const restored = normalize("apartman", mid);
  assert.equal(restored.flags.chains["su-kolon"].stage, 1);
  assert.equal(restored.delayedEffects.filter((e) => e.status === "pending").length, 1);
  for (let i = 0; i < 4 && restored.history.filter((h) => h.type === "echo").length < 1; i += 1) {
    applyAction("apartman", restored, "advance");
  }
  const callbacks = restored.history.filter((h) => h.type === "echo" && h.cause === "su-kolon");
  assert.equal(callbacks.length, 1);
  applyAction("apartman", restored, "advance");
  assert.equal(restored.history.filter((h) => h.type === "echo" && h.cause === "su-kolon").length, 1);
  finiteTree(restored.finance);
  finiteTree(restored.politics);
});

test("Apartman: exclusive branches kill the sibling chain", () => {
  const state = create("apartman");
  state.activeEvent = null;
  state.flags.chains = {
    "aidat-leyla": { stage: 0, status: "done" },
    "aidat-liste": { stage: 0, status: "idle" },
  };
  for (const chain of APARTMAN_CHAINS) {
    if (chain.id !== "aidat-liste" && chain.id !== "aidat-leyla") {
      state.flags.chains[chain.id] = { stage: 0, status: "dead" };
    }
  }
  state.week = 3;
  tickApartmanChains(state);
  assert.notEqual(state.activeEvent?.chainId, "aidat-liste");
  applyApartmanEventChoice(state, "aidat-leyla:x:bekle");
  state.flags.chains["aidat-leyla"].status = "done";
  const sibling = APARTMAN_CHAINS.find((c) => c.id === "aidat-leyla");
  for (const id of sibling.exclusive) {
    const other = state.flags.chains[id] || { status: "idle" };
    other.status = "dead";
    state.flags.chains[id] = other;
  }
  tickApartmanChains(state);
  assert.notEqual(state.activeEvent?.chainId, "aidat-liste");
});

test("Apartman: 20 long runs stay finite, no spam, and diverge", () => {
  const strategies = [
    "durable-maintenance",
    "cheap-patch",
    "raise-dues",
    "wait",
  ];
  const signatures = [];
  for (let seed = 0; seed < 20; seed += 1) {
    const state = create("apartman");
    const pick = strategies[seed % strategies.length];
    const eventPick = seed % 3;
    for (let turn = 0; turn < 28 && !state.runSummary; turn += 1) {
      if (state.activeEvent) {
        const choice = state.activeEvent.choices[eventPick] || state.activeEvent.choices.at(-1);
        applyAction(
          "apartman",
          state,
          `event-choice:${state.activeEvent.chainId}:${state.activeEvent.nodeId}:${choice.id}`,
        );
      }
      const issue = state.issues.find((item) => item.status === "acik");
      if (issue) applyAction("apartman", state, `focus:${issue.id}`);
      applyAction("apartman", state, `proposal:${pick}`);
      applyAction("apartman", state, "advance");
      assert.ok(Number.isFinite(state.finance.cash));
      assert.ok(Number.isFinite(state.politics.confidence));
      assert.ok(state.issues.length < 80);
      assert.ok((state.history || []).length <= 80);
    }
    const chainIds = Object.entries(state.flags.chains || {})
      .filter(([, st]) => st.status === "done")
      .map(([id]) => id)
      .sort();
    signatures.push(
      [
        pick,
        state.week,
        Math.round(state.finance.cash),
        state.politics.confidence,
        state.progression.phase,
        chainIds.join(","),
        state.runSummary?.result || "devam",
      ].join("|"),
    );
    finiteTree(state.finance);
    finiteTree(state.politics.confidence);
  }
  assert.ok(new Set(signatures).size >= 8, `long runs must diverge, got ${new Set(signatures).size}`);
});

function killOtherRaconChains(ev, keep) {
  ev(`(window.RaconContent.CHAINS||[]).forEach(function(c){
    S.flags.chains=S.flags.chains||{};
    if(c.id!==${JSON.stringify(keep)}) S.flags.chains[c.id]={stage:0,status:"dead"};
  });`);
}

test("Racon: hasan-kuzen walk, identity copy, delayed once, missing NPC, save/load", () => {
  const game = loadGame();
  game.win.__raconSeedSabit = 77;
  game.ev('blank("Derin");enterPlay();S.seed=77;S.week=2;S.day=1;UI.spawnLeft=2;');
  killOtherRaconChains(game.ev, "hasan-kuzen");
  game.ev('S.depth.identity="fevri";window.RaconContent.tick(S,raconContentH(),UI);');
  const paper = game.ev('S.inbox.filter(function(x){return x.kind==="chain";})[0]');
  assert.ok(paper, "hasan-kuzen paper should spawn");
  assert.equal(paper.chainId, "hasan-kuzen");
  assert.match(paper.body, /Ateşin duyulmuş/);
  game.ev(`act("chain-choice",{id:${JSON.stringify(paper.id)},cid:"zarf"});`);
  assert.equal(game.ev('S.men.filter(function(m){return m.id==="m_hasan";})[0].memories.at(-1).type'), "kuzen-zarf");
  assert.equal(game.ev('S.depth.delayedEffects.filter(function(x){return x.status==="pending"&&x.type==="chain-echo";}).length'), 1);
  game.ev("writeSave();S=parseSave(localStorage.getItem(KEY));");
  assert.equal(game.ev('S.flags.chains["hasan-kuzen"].stage'), 1);
  assert.equal(game.ev('S.depth.delayedEffects.filter(function(x){return x.status==="pending"&&x.type==="chain-echo";}).length'), 1);
  game.ev("S.week+=3;depthSettle();depthSettle();");
  assert.equal(game.ev('S.depth.delayedEffects.filter(function(x){return x.type==="chain-echo"&&x.status==="pending";}).length'), 0);
  assert.equal(game.ev('S.depth.endHistory.filter(function(x){return x.type==="chain-echo";}).length'), 1);
  assert.doesNotThrow(() => {
    game.ev('S.men=S.men.filter(function(m){return m.id!=="m_hasan";});window.RaconContent.tick(S,raconContentH(),UI);');
  });
});

test("Racon: exclusive sibling dies when a chain completes", () => {
  const game = loadGame();
  game.win.__raconSeedSabit = 11;
  game.ev('blank("Derin");enterPlay();S.seed=11;S.week=9;UI.spawnLeft=2;S.flags.chains=S.flags.chains||{};S.flags.chains["hasan-kuzen"]={stage:2,status:"active"};S.flags.chains["cevdet-teklif"]={stage:0,status:"idle"};');
  game.ev('var paper={id:"in_x",kind:"chain",chainId:"hasan-kuzen",nodeId:"hk-3",week:S.week,choices:[{id:"yumusat"},{id:"kes"},{id:"bekle"}]};S.inbox.unshift(paper);window.RaconContent.choose(paper,"yumusat",S,raconContentH());');
  assert.equal(game.ev('S.flags.chains["hasan-kuzen"].status'), "done");
  assert.equal(game.ev('S.flags.chains["cevdet-teklif"].status'), "dead");
});

test("Wave 1 closure: all 96 Racon nodes have satisfiable gates and valid callbacks", () => {
  const game = loadGame();
  const result = JSON.parse(game.ev(`(function(){
    var H=raconContentH(), chains=window.RaconContent.CHAINS, seen={}, callbacks={}, reached=[], errors=[];
    chains.forEach(function(chain){
      chain.stages.forEach(function(node,stage){
        if(seen[node.id]) errors.push("duplicate node "+node.id); seen[node.id]=1;
        var prior=[]; chain.stages.slice(0,stage).forEach(function(n){prior=prior.concat(n.choices||[])});
        if(node.requireMemory&&!prior.some(function(ch){return (ch.effects&&ch.effects.remember||[]).some(function(m){return m.who===node.requireMemory.who&&m.type===node.requireMemory.type})})) errors.push("missing memory producer "+node.id);
        if(node.requireFlag&&!prior.some(function(ch){return ch.effects&&ch.effects.flags&&ch.effects.flags[node.requireFlag]})) errors.push("missing flag producer "+node.id);
        (node.choices||[]).forEach(function(ch){var sc=ch.effects&&ch.effects.schedule||{},next=sc.next;if(next!=null&&next!=="done"&&next!=="dead"&&!(Number.isInteger(next)&&next>=0&&next<chain.stages.length))errors.push("bad next "+node.id+"/"+ch.id);if(sc.id){if(callbacks[sc.id])errors.push("duplicate callback "+sc.id);callbacks[sc.id]=1}});
        blank("Reach");enterPlay();S.week=Math.max(node.minWeek||1,1);S.day=1;S.dosya=node.maxDosya!=null?node.maxDosya:Math.max(S.dosya,node.minDosya||0);S.kasa=Math.max(S.kasa,node.minKasa||0);S.rep.nam=Math.max(S.rep.nam,node.minNam||0);if(node.requireIdentity)S.depth.identity=[].concat(node.requireIdentity)[0];[node.requireMan,node.requireMemory&&node.requireMemory.who].filter(Boolean).forEach(function(id){if(!H.manBy(id)){var hire=HIRE.filter(function(x){return x.id===id})[0];if(hire)S.men.push(migrateMan(Object.assign({},hire,{stats:defaultStats(),gonul:60,durum:"hazir",yorgunluk:0,kus:false})))}});S.depth.eventDirector={history:[],cooldowns:{}};S.inbox=[];S.flags.chains={};chains.forEach(function(other){S.flags.chains[other.id]={stage:0,status:other.id===chain.id?"idle":"dead"}});S.flags.chains[chain.id].stage=stage;S.flags.chainFlags={};if(node.requireFlag)S.flags.chainFlags[node.requireFlag]=1;if(node.forbidFlag)S.flags.chainFlags[node.forbidFlag]=0;if(node.requireMemory){var man=H.manBy(node.requireMemory.who);if(man)H.D.remember(man,{id:"gate-"+node.id,type:node.requireMemory.type,turn:S.week})}UI.spawnLeft=2;window.RaconContent.tick(S,H,UI);var paper=S.inbox.filter(function(x){return x.kind==="chain"&&!x.kapali})[0];if(!paper||paper.nodeId!==node.id)errors.push("unreachable "+node.id);else reached.push(node.id);
      })
    });
    return JSON.stringify({nodes:Object.keys(seen).length,reached:reached.length,errors:errors});
  })()`));
  assert.equal(result.nodes, 96);
  assert.deepEqual(result.errors, []);
  assert.equal(result.reached, 96);
});

test("Wave 1 closure: Racon people consequences and crew memory survive save/load", () => {
  const game = loadGame();
  game.ev('blank("Bellek");enterPlay();var p=personBy("p_esnaf_st_fevzi");relModEkle(p,8,"zincir kanıtı",0);var m=manBy("m_hasan");window.TarikLabDepth.remember(m,{id:"kanıt",type:"kuzen-zarf",turn:S.week});writeSave();S=parseSave(localStorage.getItem(KEY));');
  assert.equal(game.ev('personBy("p_esnaf_st_fevzi").mods.some(function(x){return x.reason==="zincir kanıtı"&&x.delta===8})'), true);
  assert.equal(game.ev('manBy("m_hasan").memories.some(function(x){return x.type==="kuzen-zarf"})'), true);
  assert.equal(game.ev('window.RaconContent.CHAINS.flatMap(function(c){return c.stages}).filter(function(n){return n.requireMemory}).every(function(n){return n.requireMemory.who.indexOf("m_")===0})'), true);
});

test("Wave 1 closure: Racon identity gates remain reachable after an early choice", () => {
  const game = loadGame();
  const reached = new Set();
  for (const laterChoice of ["sessiz", "sikistir", "cekil", "ates"]) {
    game.ev('blank("Kimlik");enterPlay();S.depth.identityScores={};depthRecordDecision("audit","sessiz",[],"early");');
    for (let i = 0; i < 8; i += 1) game.ev(`depthRecordDecision("audit",${JSON.stringify(laterChoice)},[],"later");`);
    reached.add(game.ev("S.depth.identity"));
  }
  assert.ok(reached.size >= 4, `mixed strategy reached only ${[...reached].join(",")}`);
  const gated = game.ev('window.RaconContent.CHAINS.flatMap(function(c){return c.stages}).filter(function(n){return n.requireIdentity}).length');
  assert.equal(gated, 2);
});

test("Wave 1 closure: Racon save remains bounded and chain distribution has no domination", () => {
  const game = loadGame();
  game.win.__raconSeedSabit = 4242;
  game.ev('blank("Büyüme");enterPlay();S.seed=4242;UI.fastJob=true;UI.spawnLeft=2;');
  const sizes = [];
  for (let day = 0; day < 160; day += 1) {
    game.ev(`UI.spawnLeft=2;var p=S.inbox.filter(function(x){return x.kind==="chain"&&!x.kapali})[0];if(p){var c=(p.choices||[])[${day % 3}]||(p.choices||[]).slice(-1)[0];if(c)act("chain-choice",{id:p.id,cid:c.id})}if(!UI.sahne)act("ilerlet",{});if(UI.modal)act("threat-yes",{});`);
    if ([40, 80, 160].includes(day + 1)) sizes.push(game.ev("JSON.stringify(S).length"));
  }
  assert.equal(game.ev("S.depth.decisions.length<=80&&S.depth.delayedEffects.length<=40&&S.depth.endHistory.length<=20&&S.depth.eventDirector.history.length<=80"), true);
  assert.ok(sizes[2] < 300_000, `Racon save grew to ${sizes[2]} bytes`);
  assert.ok(sizes[2] < sizes[1] * 1.7, `Racon save growth accelerated: ${sizes.join(",")}`);
  const counts = JSON.parse(game.ev('JSON.stringify(S.depth.eventDirector.history.reduce(function(a,x){a[x.id]=(a[x.id]||0)+1;return a},{}))'));
  assert.ok(Math.max(0, ...Object.values(counts)) <= 1, "a chain node repeated in the event window");
});

test("Wave 1 closure: save namespaces and game ids are isolated", () => {
  const runtime = fs.readFileSync(new URL("../public/games/next-wave/shared/runtime.js", import.meta.url), "utf8");
  const racon = fs.readFileSync(new URL("../public/games/racon/index.html", import.meta.url), "utf8");
  assert.match(runtime, /tariklab\.nextwave\./);
  assert.match(racon, /tariklab::racon/);
  assert.doesNotMatch(racon, /next-wave\.apartman/);
  assert.equal(normalize("apartman", { ...create("apartman"), meta: { version: 2, id: "son-100-gun" } }), null);
});

test("Racon: 20 long runs stay finite, inbox bounded, stories diverge", () => {
  const signatures = [];
  for (let i = 0; i < 20; i += 1) {
    const game = loadGame();
    game.win.__raconSeedSabit = 1000 + i * 17;
    game.ev(`blank("Uzun");enterPlay();S.seed=${1000 + i * 17};UI.fastJob=true;UI.spawnLeft=2;`);
    const choiceIdx = i % 3;
    for (let day = 0; day < 70 && !game.ev("S.flags.oyunSonu"); day += 1) {
      game.ev(`UI.spawnLeft=2;var p=S.inbox.filter(function(x){return x.kind==="chain"&&!x.kapali;})[0];if(p){var c=(p.choices||[])[${choiceIdx}]||(p.choices||[]).slice(-1)[0];if(c)act("chain-choice",{id:p.id,cid:c.id});}`);
      game.ev("if(!UI.sahne)act('ilerlet',{});if(UI.modal)act('threat-yes',{});");
      assert.equal(game.ev("Number.isFinite(S.kasa)&&Number.isFinite(S.dosya)"), true);
      assert.ok(game.ev("S.inbox.length") < 400);
    }
    signatures.push(
      game.ev(
        'JSON.stringify({w:S.week,k:S.kasa,d:S.dosya,i:S.depth.identity,f:Object.keys(S.flags.chainFlags||{}).sort(),c:Object.keys(S.flags.chains||{}).filter(function(id){return S.flags.chains[id].status==="done";}).sort(),end:S.flags.oyunSonu||""})',
      ),
    );
  }
  assert.ok(new Set(signatures).size >= 8, `racon long runs must diverge, got ${new Set(signatures).size}`);
});
