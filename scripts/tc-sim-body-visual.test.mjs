import test from "node:test";
import assert from "node:assert/strict";
import { BODY_REGIONS, bodyVisualModel, renderBodyVisual, bindBodyVisual } from "../public/games/tc-sim/js/body-visual.js";
import { readyJobStartState } from "./tc-sim-job-start-fixture.mjs";
import { saveGame, loadGame } from "../public/games/tc-sim/js/save.js";
import { applyDecision } from "../public/games/tc-sim/js/time.js";
const storage = () => { const data = new Map(); return { getItem:k=>data.get(k)??null, setItem:(k,v)=>data.set(k,v), removeItem:k=>data.delete(k), snapshot:()=>JSON.stringify([...data]) }; };
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

test("public state maps health, energy and stress without inventing regional diagnoses", () => {
  const state = readyJobStartState(); state.health = { health: 25, energy: 20, stress: 80 };
  const model = bodyVisualModel(freeze(state));
  assert.equal(model.status, "Toparlanma öncelikli"); assert.equal(model.attention, true);
  assert.deepEqual(model.metrics.map(m=>m.value), [25,20,80]);
  for (const region of BODY_REGIONS) {
    const html = renderBodyVisual(state, { selected: region.id });
    assert.match(html, new RegExp(`id="tc-body-region-title">${region.label}`));
    assert.match(html, /Bu bölgeye özel bir sağlık kaydı bulunmuyor/);
    assert.match(html, /Altın vurgu: seçili bölge/);
  }
  assert.equal(bodyVisualModel(state, "invalid").region.id, "chest");
});

test("unknown conditions/exposures do not alter any visual output; known recovery is visible", () => {
  const state = readyJobStartState(), baseline = renderBodyVisual(state);
  state.body.exposures = { overwork: 100, underRecovery: 100, inactivity: 100 };
  state.body.conditions = [{ id:"persistent-fatigue", status:"chronic", knownToPlayer:false, severity:"severe" }];
  assert.equal(renderBodyVisual(freeze(structuredClone(state))), baseline);
  state.body.conditions[0].knownToPlayer = true;
  assert.match(renderBodyVisual(state), /Uzun süren yorgunluk/);
  state.body.conditions[0].status = "resolved";
  assert.match(renderBodyVisual(state), /geride kaldı/);
  assert.doesNotMatch(renderBodyVisual(state), /severe|overwork|underRecovery/);
});

test("SVG click/Enter/Space and native region buttons select only supported regions", () => {
  const make = (id, tagName) => ({ dataset:{ bodyRegion:id }, tagName, events:{}, addEventListener(k,fn){this.events[k]=fn;} });
  const path = make("head","path"), button = make("back","BUTTON"), invalid = make("diagnose","path"), selected = [];
  bindBodyVisual({querySelectorAll:()=>[path,button,invalid]}, id=>selected.push(id));
  path.events.click(); let prevented=0;
  for(const key of ["Enter"," ","Escape"]) path.events.keydown({key,preventDefault:()=>prevented++});
  button.events.click(); invalid.events.click();
  assert.deepEqual(selected,["head","head","head","back"]);assert.equal(prevented,2);
  assert.equal(button.events.keydown,undefined,"native buttons keep their native keyboard behavior");
});

test("visual projection leaves exact saves intact, including a legacy save without body state", () => {
  const state = readyJobStartState(), saved = storage(); saveGame(saved,state);
  const before = saved.snapshot(), stateBefore = JSON.stringify(state);
  for (const region of BODY_REGIONS) renderBodyVisual(freeze(structuredClone(state)),{selected:region.id});
  assert.equal(JSON.stringify(state),stateBefore);assert.equal(saved.snapshot(),before);
  const loaded = loadGame(saved); assert.equal(loaded.ok,true);
  assert.deepEqual(bodyVisualModel(loaded.state).metrics,bodyVisualModel(state).metrics);
  const old = structuredClone(state);delete old.body;old.meta.saveVersion=1;
  const legacy=storage();legacy.setItem("tc-sim-save",JSON.stringify(old));
  const migrated=loadGame(legacy);assert.equal(migrated.ok,true);assert.doesNotThrow(()=>renderBodyVisual(migrated.state));
});

test("actual app region selection is ephemeral and existing rest dispatch matches engine exactly", async () => {
  const state = readyJobStartState();state.events.active=null;state.events.queue=[];
  const saved=storage();saveGame(saved,state);
  const root={elements:[],_html:"",set innerHTML(html){this._html=html;this.elements=[...html.matchAll(/<(button|form|path)\b([^>]*)>/g)].map(m=>{
    const attrs=Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(a=>[a[1],a[2]]));
    return {attrs,tagName:m[1],disabled:/\sdisabled(?:\s|$)/.test(m[2]),dataset:Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith("data-")).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),listeners:{},addEventListener(k,fn){this.listeners[k]=fn;},focus(){}};
  });},get innerHTML(){return this._html;}};
  const matches=(e,s)=>s.startsWith("#")?e.attrs.id===s.slice(1):s.startsWith("[")&&Object.hasOwn(e.attrs,s.slice(1,-1));
  globalThis.document={querySelector:s=>s==="#app"?root:root.elements.find(e=>matches(e,s))||null,querySelectorAll:s=>root.elements.filter(e=>matches(e,s))};
  globalThis.localStorage=saved;globalThis.window={confirm:()=>true,matchMedia:()=>({matches:false})};
  try {
    await import("../public/games/tc-sim/js/app.js?body-visual-test");
    document.querySelector("#continue-game").listeners.click();
    root.elements.find(e=>e.dataset.view==="body").listeners.click();
    const initial=saved.snapshot();
    for (const region of BODY_REGIONS) { document.querySelector(`#body-region-${region.id}`).listeners.click(); assert.match(root.innerHTML,new RegExp(`id="tc-body-region-title">${region.label}`)); }
    assert.equal(saved.snapshot(),initial);
    assert.doesNotMatch(root.innerHTML,/data-decision="body-care"/);
    const expected=loadGame(saved).state;
    const result=applyDecision(expected,"rest");assert.equal(result.ok,true,result.reason);
    const rest=root.elements.find(e=>e.dataset.decision==="rest");assert.ok(rest);assert.equal(rest.disabled,false);rest.listeners.click();
    const actual=loadGame(saved).state;const target=storage();saveGame(target,expected);const normalized=loadGame(target).state;
    actual.meta.updatedAt=null;normalized.meta.updatedAt=null;assert.deepEqual(actual,normalized);
    assert.equal(Object.hasOwn(actual,"selectedBodyRegion"),false);
  } finally {delete globalThis.document;delete globalThis.localStorage;delete globalThis.window;}
});
