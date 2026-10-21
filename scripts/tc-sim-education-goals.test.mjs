import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewGame} from '../public/games/tc-sim/js/state.js';
import {enrollEducation} from '../public/games/tc-sim/js/life.js';
import {getEducationProgress} from '../public/games/tc-sim/js/education.js';
import {refreshLifeArcs} from '../public/games/tc-sim/js/life-depth.js';
import {processDecisionNetworkWeek} from '../public/games/tc-sim/js/decision-network.js';
import {deserializeState} from '../public/games/tc-sim/js/save.js';

function student(points) {
  const s=createNewGame({seed:41});
  assert.equal(enrollEducation(s,'university','part').ok,true);
  s.career.performance=90;
  s.finances.balance=10000;
  s.education.active.progressPoints=points;
  return s;
}
function focus(s) {
  for(let i=0;i<3;i++) {s.time.absoluteWeek++;processDecisionNetworkWeek(s,['practice-skill']);}
}
test('education goal and arc use canonical points, ignoring legacy progress',()=>{
  const s=student(156);s.education.active.progress=99;
  const d=refreshLifeArcs(s);
  assert.equal(d.goals.find(g=>g.arc==='education').progress,50);
  assert.equal(d.arcs.education.momentum,50);
});
test('focus advances real education, tuition and remaining time once across reload',()=>{
  let s=student(156);focus(s);
  assert.equal(s.education.active.progressPoints,160);
  assert.equal(getEducationProgress(s).remainingWeeks,76);
  assert.equal(s.education.tuitionOwedThisMonth,1500);
  s=deserializeState(JSON.stringify(s)).state;
  for(let i=0;i<4;i++)processDecisionNetworkWeek(s,['practice-skill']);
  assert.equal(s.education.active.progressPoints,160);
  s.time.absoluteWeek++;processDecisionNetworkWeek(s,['practice-skill']);
  assert.equal(s.education.active.progressPoints,160,'quarterly reward cooldown survives reload');
});
test('focus at threshold grants one canonical graduation and no second diploma',()=>{
  let s=student(310);focus(s);
  assert.equal(s.education.active,null);
  assert.equal(s.education.level,'lisans');
  assert.equal(s.flags.educationCompletedPending,'university');
  assert.equal(s.education.fields.filter(f=>f==='business').length,1);
  const memories=s.memories.length;
  s=deserializeState(JSON.stringify(s)).state;
  processDecisionNetworkWeek(s,['practice-skill']);
  assert.equal(s.memories.length,memories);
});
