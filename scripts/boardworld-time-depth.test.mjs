import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame, getActions, loadExpansionRuntime, resolveAction} from '../public/games/tc-sim-boardworld/engine.mjs';
import {nextDistrictShiftAt} from '../public/games/tc-sim-boardworld/expansion-districts.mjs';
import {exportGame, importGame} from '../public/games/tc-sim-boardworld/persistence.mjs';
await loadExpansionRuntime();
const act = (s,id) => { const r=resolveAction(s,id); assert.ok(r.ok, `${id}: ${r.message}`); return r.state; };
function employed(district) {
 let s=createGame({startingDistrict:district,lifePath:'ordinary',expansion:true});
 s=act(s,`district:visit:${district}:work`); s=act(s,'district:apply');
 return act(s,'district:shift');
}
test('safe advance reaches a regional shift and preserves needs, money and replay',()=>{
 const before=employed('istanbul:kartal'), target=nextDistrictShiftAt(before);
 assert.ok(target>before.time);
 const loaded=importGame(exportGame(before)).state;
 const first=resolveAction(before,'calendar:next'), replay=resolveAction(loaded,'calendar:next');
 assert.ok(first.ok); assert.equal(first.state.time,target);
 assert.match(first.message,/vardiya penceresi/);
 assert.ok(first.state.player.hunger<before.player.hunger);
 assert.equal(first.state.bank,before.bank);
 assert.equal(exportGame(first.state),exportGame(replay.state));
 assert.equal(getActions(first.state).find(a=>a.id==='district:shift').disabled,false);
});
test('controlled weekend fixture calculates the employer workday without changing state',()=>{
 const s=employed('ankara:yenimahalle'); s.time=4*1440+19*60; s.expansion.districts.job.lastShiftDay=5;
 const snapshot=structuredClone(s);
 assert.equal(nextDistrictShiftAt(s),7*1440+6*60);
 assert.deepEqual(s,snapshot);
});
test('critical hunger prevents a fast-forward even when another shift exists',()=>{
 const s=employed('istanbul:kartal'); s.player.hunger=19;
 assert.equal(getActions(s).find(a=>a.id==='calendar:next').disabled,true);
 const result=resolveAction(s,'calendar:next'); assert.equal(result.ok,false); assert.equal(result.state,s);
});

test('shift stop result is localized with elapsed minutes',async()=>{
 const {chooseLanguage,translateText}=await import('../public/games/tc-sim-boardworld/i18n.mjs');
 const message='915 dakika geçti. Yerel vardiya penceresi açıldı; koşulları incele.';
 for(const language of ['en','pl']) { await chooseLanguage(language); assert.notEqual(translateText(message),message); assert.match(translateText(message),/915/); }
 await chooseLanguage('tr');
});

test('a confirmed appointment interrupts safe advance before the shift window',()=>{
 let s=createGame({startingDistrict:'kadikoy',lifePath:'ordinary',expansion:true});
 const draft={kind:'personal',npcId:'',subjectId:'rest',day:2,minute:360,venue:'kadikoy-park',duration:60,repeat:'none'};
 const booked=resolveAction(s,'calendar:propose',draft); assert.ok(booked.ok); s=booked.state;
 for(const id of ['district:travel:istanbul:kartal','district:visit:istanbul:kartal:work','district:apply','district:shift']) s=act(s,id);
 const target=nextDistrictShiftAt(s), appointment=s.calendar.entries[0];
 const result=resolveAction(s,'calendar:next'); assert.ok(result.ok);
 assert.ok(result.state.time<target); assert.equal(result.state.calendar.entries[0].status,'confirmed');
 assert.ok(result.state.time<appointment.start); assert.match(result.message,/Takvimdeki/);
});

test('controlled qualified health worker uses the public centre schedule for the next shift',()=>{
 let s=createGame({scenario:'graduate',startingDistrict:'ankara:altindag',lifePath:'freeform',expansion:true,seed:49});
 s.expansion.institutions.qualifications.push({course:'health-support',day:1});
 for(const id of ['district:visit:ankara:altindag:institution','district:apply:health','district:shift']) s=act(s,id);
 const target=nextDistrictShiftAt(s); assert.equal(target,1440+8*60);
 const result=resolveAction(s,'calendar:next'); assert.ok(result.ok);
 assert.ok(result.state.time<=target,'needs, events and appointments can interrupt before the shift');
});
