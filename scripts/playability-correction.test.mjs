import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createNewGame, validateState } from "../public/games/tc-sim/js/state.js";
import { deserializeState } from "../public/games/tc-sim/js/save.js";
import { MARKET, MARKET_OWNERSHIP, spendLifestyle, buyDurable, sellDurable, applyWealthAction, processOwnedBenefits, processWealthMonthEnd, tradeInvestment, investmentPL, marketPreview, netWorth } from "../public/games/tc-sim/js/wealth.js";
import { hydrateDevlet, applyPolicy, tickDevlet, finiteState } from "../public/games/next-wave/devlet-sim.js";
import { POLICIES, EVENTS, PERIODS, COHORTS, REGIONS, FOREIGN_AXES } from "../public/games/next-wave/devlet-data.js";
import { screenHtml, visibleSnapshot, feedbackHtml, helpHtml } from "../public/games/tc-sim-devlet/presentation.js";
const game=(seed=12345)=>{ const s=createNewGame({seed});s.finances.balance=1000000;return s; };
const week=s=>{s.time.absoluteWeek++;s.weekly={used:0,selectedIds:[]};};
beforeEach(()=>{globalThis.window={tlabI18n:{getLang:()=>"tr",phrase:v=>v}};});
afterEach(()=>{delete globalThis.window;});

test("all 53 Market rows retain real previews; mapped ownership survives normalization",()=>{
  assert.equal(Object.keys(MARKET).length,53);
  for(const id of Object.keys(MARKET)) {
    const s=game();const p=marketPreview(s,id);assert.ok(Number.isFinite(p.energy));
    const result=spendLifestyle(s,id);assert.equal(result.ok,true,id);
    assert.equal(result.effects.cash,s.finances.balance-1000000);
    if(MARKET_OWNERSHIP[id]){
      const loaded=deserializeState(JSON.stringify(s));assert.equal(loaded.ok,true,id);
      assert.equal(loaded.state.wealth.durables[0].id,MARKET_OWNERSHIP[id]);
      const cash=loaded.state.finances.balance;week(loaded.state);loaded.state.time.absoluteWeek+=4;
      assert.equal(spendLifestyle(loaded.state,id).ok,false);
      assert.equal(buyDurable(loaded.state,MARKET_OWNERSHIP[id]).ok,false);
      assert.equal(loaded.state.finances.balance,cash);
    }
  }
});
test("purchase validation, stale clicks, cooldown and focus cost cannot double-apply",()=>{
  const poor=game();poor.finances.balance=0;const before=JSON.stringify(poor);
  assert.equal(spendLifestyle(poor,"laptop").ok,false);assert.equal(JSON.stringify(poor),before);
  const s=game();assert.equal(spendLifestyle(s,"coffee").ok,true);const saved=JSON.stringify(s);
  assert.equal(spendLifestyle(s,"coffee").ok,false);assert.equal(JSON.stringify(s),saved);
  week(s);assert.equal(spendLifestyle(s,"coffee").ok,false);
  assert.equal(spendLifestyle(s,"vacation").ok,true);assert.equal(spendLifestyle(s,"cafe").ok,true);
  s.weekly.used=6;assert.equal(spendLifestyle(s,"restaurant").ok,false);
});
test("owned recovery is capped and once per week, upkeep once per month, no cash creation",()=>{
  const s=game();spendLifestyle(s,"bike");week(s);buyDurable(s,"bed");week(s);
  s.health.energy=40;s.health.health=50;
  processOwnedBenefits(s);assert.equal(s.health.energy,43);assert.equal(s.health.health,51);
  const after=JSON.stringify(s);processOwnedBenefits(s);assert.equal(JSON.stringify(s),after);
  const cash=s.finances.balance;processWealthMonthEnd(s);assert.equal(s.finances.balance,cash-30);
  const loaded=deserializeState(JSON.stringify(s)).state;processWealthMonthEnd(loaded);assert.equal(loaded.finances.balance,cash-30);
  assert.ok(netWorth(loaded).total<1000000);assert.equal(validateState(loaded).ok,true);
});
test("gambling has wins and losses, a house edge, one stake, progressing RNG and deterministic reload",()=>{
  let wins=0,losses=0,total=0;
  for(let seed=1;seed<=2000;seed++){
    const s=game(seed*7919), clone=deserializeState(JSON.stringify(s)).state;
    const before=s.meta.rngState,r=spendLifestyle(s,"betting"),r2=spendLifestyle(clone,"betting");
    assert.equal(r.payout,r2.payout);assert.notEqual(s.meta.rngState,before);
    assert.equal(s.finances.balance-1000000,r.payout-MARKET.betting.cost);
    assert.equal(s.finances.ledger.filter(x=>x.reason===MARKET.betting.label).length,1);
    if(r.effects.cash>0)wins++;if(r.effects.cash<0)losses++;total+=r.effects.cash;
    const loaded=deserializeState(JSON.stringify(s)).state,cash=loaded.finances.balance;
    assert.equal(spendLifestyle(loaded,"betting").ok,false);assert.equal(loaded.finances.balance,cash);
  }
  assert.ok(wins>100);assert.ok(losses>500);assert.ok(total<0);
});
test("partial sale allocates proportional cost including fees, full sale removes all basis",()=>{
  const s=game();assert.equal(tradeInvestment(s,"gold",20000).ok,true);
  s.wealth.investments[0].value=18000;week(s);
  const r=tradeInvestment(s,"gold",-9000);assert.equal(r.basisSold,10100);assert.equal(r.proceeds,8910);assert.equal(r.realized,-1190);
  assert.deepEqual(investmentPL(s.wealth.investments[0]),{value:9000,basis:10100,amount:-1100,percent:-1100/10100*100});
  week(s);const last=tradeInvestment(s,"gold",-9000);assert.equal(last.basisSold,10100);assert.equal(s.wealth.investments.length,0);
  assert.equal(s.finances.balance,1000000-20200+17820);
});
test("investment gains/losses are non-cash, monthly idempotent and finite over a long run",()=>{
  const s=game();tradeInvestment(s,"equity",5000);let up=false,down=false;
  for(let month=0;month<240;month++){
    s.time.absoluteWeek=month*4+1;const value=s.wealth.investments[0].value,cash=s.finances.balance;
    assert.equal(processWealthMonthEnd(s),true);const after=s.wealth.investments[0].value;
    up ||= after>value;down ||= after<value;assert.equal(s.finances.balance,cash);
    assert.equal(processWealthMonthEnd(s),false);assert.ok(Number.isFinite(after));
  }
  assert.ok(up&&down);assert.ok(s.finances.ledger.some(row=>row.category==="valuation"&&row.amount===0));
});
test("durable resale removes the benefit without creating money; small investment remainders can be sold",()=>{
  const s=game();spendLifestyle(s,"bike");week(s);const before=s.finances.balance;
  assert.equal(sellDurable(s,"bike").ok,true);assert.equal(s.wealth.durables.length,0);
  assert.equal(s.finances.balance,before+2600);assert.ok(s.finances.balance<1000000);
  assert.equal(sellDurable(s,"bike").ok,false);
  s.health.health=50;week(s);processOwnedBenefits(s);assert.equal(s.health.health,50);
  tradeInvestment(s,"gold",1000);week(s);
  assert.equal(applyWealthAction(s,"invest-sell-all","gold").ok,true);assert.equal(s.wealth.investments.length,0);
  assert.equal(applyWealthAction(s,"invest-sell-all","gold").ok,false);
});
test("DEVLET views, details, report and sorting are immutable and cannot read actual or actual-backed year inflation",()=>{
  const s=hydrateDevlet("2002");s.ui.screen="home";s.yearDigest=[{year:2002,inflation:987654,heat:40,entropy:45,form:s.form}];
  const original=JSON.stringify(s), copy=structuredClone(s);
  Object.defineProperty(copy,"actual",{get(){throw Error("actual leak");}});
  for(const lang of ["tr","en"]){
    globalThis.window={tlabI18n:{getLang:()=>lang,phrase:v=>v}};
    for(const screen of ["home","agenda","economy","policy","institutions","society","foreign","regions","files","history","year","period-file"]){
      const html=screenHtml(copy,{screen});assert.ok(html.length>50);assert.doesNotMatch(html,/987654|state\.actual|>nato<|>gulf<|>ir<|>gr<|>cy<|>Isı<|Isı [0-9]/);
    }
    assert.ok(helpHtml().includes(lang==="tr"?"30 saniyede":"30 seconds"));
    visibleSnapshot(copy);
  }
  delete globalThis.window;
  assert.equal(JSON.stringify(s),original);
  const {actual:_actual,...rest}=s;const renderedRest=Object.fromEntries(Object.keys(copy).filter(k=>k!=="actual").map(k=>[k,copy[k]]));assert.deepEqual(renderedRest,rest);
});
test("DEVLET content contract, two decisions, reported feedback and monthly kernel stay intact",()=>{
  assert.equal(POLICIES["2002"].length,48);assert.equal(EVENTS["2002"].length,62);
  assert.equal(REGIONS.length,7);assert.equal(FOREIGN_AXES.length,8);assert.ok(COHORTS.length>=4);assert.ok(Object.keys(PERIODS).length>=6);
  const s=hydrateDevlet("2002");applyPolicy(s,POLICIES["2002"][0].id);applyPolicy(s,POLICIES["2002"][1].id);
  const picked=JSON.stringify(s);applyPolicy(s,POLICIES["2002"][2].id);assert.equal(JSON.stringify(s),picked);
  const before=visibleSnapshot(s);tickDevlet(s);assert.equal(s.time.turn,before.time.turn+1);assert.equal(s.flags.decisionsRemaining,2);
  assert.match(feedbackHtml(s,{kind:"month",before}),/Ay sonu raporu/);assert.equal(finiteState(s),true);
  const app=readFileSync(new URL("../public/games/tc-sim-devlet/app.js",import.meta.url),"utf8");assert.match(app,/session\.act\("advance"\)/);
});
