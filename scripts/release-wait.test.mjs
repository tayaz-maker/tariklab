import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForRelease} from './release-wait.mjs';
const sha='a'.repeat(40);
const paths=['.github/workflows/ci.yml','.github/workflows/tc-job-start-outcome.yml'];
const runs=(status='completed',conclusion='success')=>paths.map((path,id)=>({id,path,status,conclusion,event:'push',head_branch:'main',head_sha:sha}));
test('pending same-main checks can finish, then the original strict guard authorizes',async()=>{
 let waits=0,verified=0;
 await waitForRelease({sha,main:sha,runs:runs('in_progress',null),delay:async()=>{waits++},read:async path=>path==='branches/main'?{commit:{sha}}:{workflow_runs:runs()},verify:()=>verified++});
 assert.equal(waits,1);assert.equal(verified,1);
});
test('failed, stale, missing, timed-out and unavailable checks never authorize publication',async()=>{
 for(const config of [
  {runs:runs('completed','failure')},
  {main:'b'.repeat(40)},
  {runs:[]},
  {runs:runs('in_progress',null)},
 ]){
  let verified=0;
  await assert.rejects(waitForRelease({sha,main:sha,runs:runs(),read:async()=>{throw Error('unavailable')},delay:async()=>{},attempts:0,verify:()=>verified++,...config}));
  assert.equal(verified,0);
 }
 await assert.rejects(waitForRelease({sha,main:sha,runs:[],read:async()=>{throw Error('unavailable')},delay:async()=>{},verify:()=>assert.fail('must not authorize')}),/unavailable/);
});
test('latest rerun and exact-SHA push provenance are required',async()=>{
 const variants=[
  [...runs(),{...runs()[0],id:20,status:'completed',conclusion:'cancelled'}],
  runs().map(r=>({...r,event:'pull_request'})),
  runs().map(r=>({...r,head_sha:'b'.repeat(40)})),
 ];
 for(const candidate of variants)await assert.rejects(waitForRelease({sha,main:sha,runs:candidate,attempts:0,verify:()=>assert.fail('must not authorize')}));
});
