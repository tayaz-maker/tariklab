import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame} from '../public/games/tc-sim/js/state.js';
import {getEventDefinition,enqueueEvent,activateNextEvent,resolveEvent} from '../public/games/tc-sim/js/events.js';
import {recordNpcMilestone} from '../public/games/tc-sim/js/depth3-systems.js';
import {deserializeState} from '../public/games/tc-sim/js/save.js';
const fixtures=[['moving_help_mehmet','mehmet','housing','help'],['night_call_mehmet','mehmet','career','phone'],['family_late_night','anne','family','truth']];
for(const [id,actor,type,choice] of fixtures)test(`${id}: no context-free repeat; new known milestone reopens once`,()=>{
 let s=createNewGame({seed:41});s.time.absoluteWeek=20;s.relationships.mehmet=80;s.people.find(p=>p.id==='mehmet').social.trust=80;
 const def=getEventDefinition(id);assert.equal(def.condition(s),true);
 enqueueEvent(s,id);assert.equal(activateNextEvent(s).eventId,id);assert.ok(resolveEvent(s,choice).ok);
 s.events.active=null;s.events.queue=[];s.time.absoluteWeek=80;
 assert.equal(def.condition(s),false);
 recordNpcMilestone(s,actor,{id:'hidden-change',type,text:'Private change'});assert.equal(def.condition(s),false);
 recordNpcMilestone(s,actor,{id:'new-change',type,text:'Known change',playerKnown:true});assert.equal(def.condition(s),true);
 s=deserializeState(JSON.stringify(s)).state;assert.equal(def.condition(s),true);
 enqueueEvent(s,id);activateNextEvent(s);assert.ok(resolveEvent(s,choice).ok);
 s.time.absoluteWeek=120;assert.equal(def.condition(s),false,'same development already consumed');
 s.people.find(p=>p.id===actor).deceased=true;assert.equal(def.condition(s),false);
});
test('family door story belongs to young adult family life',()=>{
 const s=createNewGame({seed:41});s.time.absoluteWeek=40;s.player.age=38;
 assert.equal(getEventDefinition('family_late_night').condition(s),false);
 s.player.age=23;s.people.find(p=>p.id==='anne').available=false;
 assert.equal(getEventDefinition('family_late_night').condition(s),false);
});
test('explicit due queue keeps priority over all organic selection',()=>{
 const s=createNewGame({seed:41});s.time.absoluteWeek=60;
 enqueueEvent(s,'reference_followup_positive','due-case');
 assert.equal(activateNextEvent(s).eventId,'reference_followup_positive');
});
