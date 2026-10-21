import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame,validateState} from '../public/games/tc-sim/js/state.js';
import {processNetworkWeek,normalizeNetworkMilestoneKnowledge} from '../public/games/tc-sim/js/network.js';
import {deserializeState} from '../public/games/tc-sim/js/save.js';
import {advanceWeek} from '../public/games/tc-sim/js/time.js';
const core=['anne','baba','mehmet','elif','selin','emre','burak'];
for(const familyType of ['nuclear','extended','stem','single'])for(const networkMode of ['tight','normal','wide'])test(`${familyType}/${networkMode}: all available NPCs rotate and use known IDs`,()=>{
 let s=createNewGame({seed:41,familyType,networkMode});const extras=s.people.filter(p=>!core.includes(p.id)&&p.available!==false);
 for(const p of extras)s.relationships[p.id]=60;
 for(let i=1;i<=extras.length;i++){
  s.time.absoluteWeek=i*16;assert.equal(processNetworkWeek(s),true);
  const before=JSON.stringify(s.people);assert.equal(processNetworkWeek(s),false);assert.equal(JSON.stringify(s.people),before);
  s=deserializeState(JSON.stringify(s)).state;assert.equal(processNetworkWeek(s),false);
 }
 for(const p of s.people.filter(p=>extras.some(e=>e.id===p.id))){assert.equal(p.lifeMilestones.length,1);assert.equal(p.knownMilestones[0],p.lifeMilestones[0].id);assert.ok(p.lifeMilestones[0].type);}
 assert.ok(validateState(s).ok);
});
test('V5/V6 legacy known text converts only a unique exact personal network match',()=>{
 for(const saveVersion of [5,6]) {
  const s=createNewGame({seed:41});const p=s.people.find(p=>p.id==='kardes');
  p.lifeMilestones=[{id:'net-kardes-16',week:16,text:'Shared development'},{id:'private',week:17,text:'Secret'},{id:'net-kardes-32',week:32,text:'Ambiguous'},{id:'net-kardes-48',week:48,text:'Ambiguous'}];
  p.knownMilestones=['Shared development','Unmatched','Ambiguous'];s.meta.saveVersion=saveVersion;
  const loaded=deserializeState(JSON.stringify(s)).state;const q=loaded.people.find(p=>p.id==='kardes');
  assert.deepEqual(q.knownMilestones,['net-kardes-16','Unmatched','Ambiguous']);assert.deepEqual(normalizeNetworkMilestoneKnowledge(q),q.knownMilestones);assert.ok(!q.knownMilestones.includes('private'));
 }
});
test('yearbook receives known network developments and excludes hidden ones',()=>{
 const s=createNewGame({seed:41,familyType:'single',networkMode:'tight'});const extras=s.people.filter(p=>!core.includes(p.id));
 s.relationships[extras[0].id]=60;s.relationships[extras[1].id]=0;
 s.time.absoluteWeek=16;processNetworkWeek(s);s.time.absoluteWeek=32;processNetworkWeek(s);
 const known=extras[0].lifeMilestones[0].text,hidden=extras[1].lifeMilestones[0].text;
 s.time.absoluteWeek=48;s.time.month=12;s.time.weekOfMonth=4;s.time.date='2027-12-22';s.events.active=null;s.events.queue=[];
 assert.ok(advanceWeek(s).ok);
 const annual=JSON.stringify(s.yearlyHistory.at(-1).livingWorld.knownMilestones);
 assert.ok(annual.includes(known));assert.ok(!annual.includes(hidden));
});
test('deceased and unavailable extras never receive new developments',()=>{
 const s=createNewGame({familyType:'single',networkMode:'tight'});const extras=s.people.filter(p=>!core.includes(p.id));extras[0].deceased=true;extras[1].available=false;s.time.absoluteWeek=16;assert.equal(processNetworkWeek(s),false);assert.ok(extras.every(p=>!p.lifeMilestones.length));
});
