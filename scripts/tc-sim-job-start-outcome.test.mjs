import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readyJobStartState } from "./tc-sim-job-start-fixture.mjs";
import { resolveEvent } from "../public/games/tc-sim/js/events.js";
import { saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
import { getMonthlyEmploymentIncome, getWeeklyLifeLoad } from "../public/games/tc-sim/js/life.js";
import { snapshotJobStart, buildJobStartOutcome } from "../public/games/tc-sim/js/job-start-outcome.js";
import { renderJobStartOutcome, bindJobStartOutcome, jobOutcomeText } from "../public/games/tc-sim/js/job-start-outcome-ui.js";
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const freeze = value => { if (value && typeof value === "object") { for (const x of Object.values(value)) freeze(x); Object.freeze(value); } return value; };
const money = value => `${value} TRY`;
function complete() { const state = readyJobStartState(), before = snapshotJobStart(state), result = resolveEvent(state, "start"); return { state, before, result, model: buildJobStartOutcome(before, state, result, "start") }; }
function storage() { const data = new Map(); return { getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,v), removeItem:k=>data.delete(k) }; }

test("actual next-week job completion has zero cash/focus reward and a separate real future schedule", () => {
  const { state, model } = complete();
  assert.ok(model);
  assert.deepEqual(model.now, { cash:0, focus:0, energy:0, stress:0, health:0 });
  assert.equal(model.waitedWeeks, 1);
  assert.equal(model.schedule.salaryBefore, 0);
  assert.equal(model.schedule.salary, getMonthlyEmploymentIncome(state));
  assert.equal(model.schedule.load, getWeeklyLifeLoad(state).load);
  assert.equal(state.career.pendingJob, null);
  assert.equal(state.career.jobId, "market");
});

test("failed, mismatched, premature, replayed and unrelated job mutations do not produce a moment", () => {
  const { state, before, result } = complete();
  assert.equal(buildJobStartOutcome(before, state, {ok:false}, "start"), null);
  assert.equal(buildJobStartOutcome(before, state, result, "other"), null);
  assert.equal(buildJobStartOutcome({...before, pending:{...before.pending,caseId:"wrong"}}, state, result, "start"), null);
  assert.equal(buildJobStartOutcome({...before, week:before.week-1}, state, result, "start"), null);
  assert.equal(buildJobStartOutcome(before, {...state,events:{...state.events,history:[]}}, result, "start"), null);
  assert.equal(buildJobStartOutcome(before, {...state,career:{...state.career,jobId:"office"}}, result, "start"), null);
  assert.equal(snapshotJobStart(state), null);
  assert.equal(buildJobStartOutcome(null, state, result, "start"), null);
});

test("pure model and rendering leave exact mechanics and persisted save payloads unchanged", () => {
  const enabled = readyJobStartState(), disabled = structuredClone(enabled);
  const initialHash = hash(enabled);
  const before = snapshotJobStart(freeze(structuredClone(enabled)));
  assert.equal(hash(enabled), initialHash);
  const result = resolveEvent(enabled, "start"); resolveEvent(disabled, "start");
  const afterHash = hash(enabled);
  const model = buildJobStartOutcome(freeze(before), freeze(structuredClone(enabled)), result, "start");
  renderJobStartOutcome(freeze(model), {t:(tr)=>tr,money,announce:true,emphasize:true});
  assert.equal(hash(enabled), afterHash); assert.equal(hash(enabled), hash(disabled));
  const a=storage(),b=storage(); assert.equal(saveGame(a,enabled).ok,true);assert.equal(saveGame(b,disabled).ok,true);
  const persistedA=loadGame(a).state,persistedB=loadGame(b).state;
  // Existing wall-clock updatedAt is the only intentionally normalized field.
  persistedA.meta.updatedAt=null;persistedB.meta.updatedAt=null;
  assert.equal(hash(persistedA),hash(persistedB));
  assert.equal(snapshotJobStart(persistedA),null);
  const legacy=structuredClone(enabled),oldStore=storage();legacy.meta.saveVersion=1;
  oldStore.setItem("tc-sim-save",JSON.stringify(legacy));
  const migrated=loadGame(oldStore);assert.equal(migrated.ok,true);
  assert.equal(migrated.state.career.jobId,"market");assert.equal(snapshotJobStart(migrated.state),null);
  console.log("TC_JOB_OUTCOME_HASH",JSON.stringify({state:afterHash,normalizedSave:hash(persistedA)}));
});

test("TR/EN/PL copy distinguishes now from schedule; later renders are static and not live", () => {
  const { model } = complete();
  const expected={tr:[/Bu seçimde nakit değişmedi/,/Maaş şimdi ödenmedi/],en:[/No cash changed/,/Salary was not paid now/],pl:[/Ta decyzja nie zmieniła gotówki/,/Wynagrodzenie nie zostało teraz wypłacone/]};
  for(const lang of ["tr","en","pl"]){
    const seen=[];const t=(tr,en)=>{const value=jobOutcomeText(lang,tr,en);seen.push({tr,value});return value;};
    const fresh=renderJobStartOutcome(model,{t,money,announce:true,emphasize:lang!=="pl"});
    for(const pattern of expected[lang])assert.match(fresh,pattern);
    assert.equal((fresh.match(/role="status"/g)||[]).length,1);
    assert.match(fresh,/<details><summary>/);assert.doesNotMatch(fresh,/autofocus|role="dialog"|<canvas|<img|<audio|<video/);
    if(lang==="pl") for(const row of seen) {
      // "stres" is the same valid word in both languages.
      if(row.tr!=="stres") assert.notEqual(row.value,row.tr,`untranslated new PL copy: ${row.tr}`);
    }
    const staticHtml=renderJobStartOutcome(model,{t,money,settled:true});
    assert.doesNotMatch(staticHtml,/role="status"|is-emphasized/);assert.match(staticHtml,/aria-live="off"/);
  }
});

test("two animation ends, close and Escape settle once without focus changes; reduced motion can close static emphasis", () => {
  for(const animated of [true,false]){
    const attrs={},callbacks={},buttonAttrs={},buttonEvents={};let count=0;
    const classes=new Set(animated?["is-emphasized"]:[]);
    const button={textContent:"",setAttribute:(k,v)=>buttonAttrs[k]=v,addEventListener:(k,fn)=>buttonEvents[k]=fn,focus(){assert.fail("must not steal focus");}};
    const panel={querySelector:()=>button,setAttribute:(k,v)=>attrs[k]=v,classList:{contains:k=>classes.has(k),remove:k=>classes.delete(k),add:k=>classes.add(k)},addEventListener:(k,fn)=>callbacks[k]=fn};
    bindJobStartOutcome({querySelector:()=>panel},()=>count++,(tr)=>tr);
    if(animated){callbacks.animationend({animationName:"tc-job-start-trace"});callbacks.animationend({animationName:"tc-job-start-trace"});}
    else buttonEvents.click();
    callbacks.keydown({key:"Escape"});buttonEvents.click();
    assert.equal(count,1);assert.equal(attrs["aria-live"],"off");assert.equal(buttonAttrs["aria-pressed"],"true");assert.equal(button.textContent,"Vurgu kapalı");assert.equal(classes.has("is-emphasized"),false);
  }
});

test("actual app choice renders one result, save rerender is not live, reload never replays", async () => {
  let serial=0;
  async function mount(state,reduce=false){
    const saved=storage();assert.equal(saveGame(saved,state).ok,true);
    const root={elements:[],_html:"",set innerHTML(html){this._html=html;this.elements=[...html.matchAll(/<(button|form)\b([^>]*)>/g)].map(m=>{
      const attrs=Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]]));
      return {attrs,disabled:/\sdisabled(?:\s|$)/.test(m[2]),dataset:Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith("data-")).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),listeners:{},addEventListener(k,fn){this.listeners[k]=fn;}};
    });},get innerHTML(){return this._html;}};
    const matches=(e,s)=>s.startsWith("#")?e.attrs.id===s.slice(1):s.startsWith("[")&&Object.hasOwn(e.attrs,s.slice(1,-1));
    const document={querySelector:s=>s==="#app"?root:root.elements.find(e=>matches(e,s))||null,querySelectorAll:s=>root.elements.filter(e=>matches(e,s))};
    globalThis.document=document;globalThis.localStorage=saved;globalThis.window={confirm:()=>true,matchMedia:()=>({matches:reduce})};
    await import(`../public/games/tc-sim/js/app.js?job-outcome-test=${++serial}`);
    const click=s=>{const el=document.querySelector(s);assert.ok(el,s);assert.equal(el.disabled,false);el.listeners.click();};
    click("#continue-game");return{root,saved,click};
  }
  try{
    const ui=await mount(readyJobStartState());ui.click("[data-event-choice]");
    assert.equal((ui.root.innerHTML.match(/data-job-start-moment/g)||[]).length,1);
    assert.match(ui.root.innerHTML,/job-start-moment is-emphasized/);
    assert.doesNotMatch(ui.root.innerHTML,/<p class="result" role="status">Yeni işin başlıyor: İşe başla<\/p>/);
    ui.click("#save-game");
    const card=ui.root.innerHTML.match(/<section class="result job-start-moment[\s\S]*?<\/section>/)[0];
    assert.doesNotMatch(card,/role="status"|is-emphasized/);
    const reopened=await mount(loadGame(ui.saved).state);assert.doesNotMatch(reopened.root.innerHTML,/data-job-start-moment/);
    const reduced=await mount(readyJobStartState(),true);reduced.click("[data-event-choice]");
    assert.match(reduced.root.innerHTML,/data-job-start-moment/);assert.doesNotMatch(reduced.root.innerHTML,/job-start-moment is-emphasized/);
  }finally{delete globalThis.document;delete globalThis.localStorage;delete globalThis.window;}
});
