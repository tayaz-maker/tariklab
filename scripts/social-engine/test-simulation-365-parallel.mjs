import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createWorld,stepWorld,advanceMinutes,canonicalState,validateState} from '../../src/games/social-engine/simulation/engine.ts';
import {encodeSave,decodeSave} from '../../src/games/social-engine/persistence/codec.ts';
import {observeLocalDay} from './neighbourhood-liveness.mjs';
import {startReplay} from './simulation-365-replay.mjs';
const hash=s=>createHash('sha256').update(canonicalState(s)).digest('hex');
async function run(parallel) {
 const wall=performance.now(), cpu=process.cpuUsage();
 let p=createWorld(20261103), r=parallel?startReplay({seed:20261103}):createWorld(20261103), s=null, rows=[],count=0;
 if(parallel) assert.equal((await r.ready).hash,hash(p));
 try {
  for(let day=1;day<=2;day++) {
   const rp=parallel?r.advance():null, sp=parallel&&s?s.advance():null;
   let o=observeLocalDay(p);
   for(let t=0;t<14400;t++){stepWorld(p);if(t%113===0)count++;if((t+1)%600===0)o.sample()}
   let activity=o.result(); assert.ok(!activity.stalled);
   let rr,ss;
   if(parallel){rr=await rp;ss=sp?await sp:null}
   else {advanceMinutes(r,1440);if(s)advanceMinutes(s,1440);rr={hash:hash(r),violations:validateState(r)};ss=s?{hash:hash(s),violations:validateState(s)}:null}
   assert.deepEqual(validateState(p),[]); assert.deepEqual(rr.violations,[]);if(ss)assert.deepEqual(ss.violations,[]);
   assert.equal(hash(p),rr.hash);if(ss)assert.equal(hash(p),ss.hash);
   rows.push({day,hash:hash(p),replayHash:rr.hash,resumedHash:ss?.hash??null,activity,tick:p.tick,minute:p.minute});
   if(day===1){let checkpoint=await encodeSave('auto',p),decoded=(await decodeSave(checkpoint)).state;assert.equal(hash(decoded),hash(p));s=parallel?startReplay({checkpoint}):decoded;if(parallel)assert.equal((await s.ready).hash,hash(p))}
  }
  return {rows,count,wallMs:performance.now()-wall,cpu:process.cpuUsage(cpu)};
 }finally {if(parallel)await Promise.all([r.stop(),...(s?[s.stop()]:[])])}
}
let serial=await run(false),parallel=await run(true);
assert.deepEqual(serial.rows,parallel.rows);assert.equal(serial.count,parallel.count);
console.log(JSON.stringify({serial,parallel,speedup:serial.wallMs/parallel.wallMs,scope:'two days, day 1 real encode/decode resume; not full 365-day CI'}));
