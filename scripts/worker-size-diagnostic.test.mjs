import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseWorkerSizes} from './worker-size-diagnostic.mjs';

function fixture(overrides={}) {
 return {
  response:async()=>({headersArray:async()=>[]}),
  allHeaders:async()=>({}),
  sizes:async()=>({responseHeadersSize:249,responseBodySize:-249}),
  ...overrides,
 };
}
test('SW requestfinished without response metadata identifies the first missing promise',async()=>{
 const result=await diagnoseWorkerSizes(fixture({response:()=>new Promise(()=>{})}),10);
 assert.equal(result.state,'incomplete');assert.equal(result.blockedStage,'response');
 assert.deepEqual(result.stages,[]);assert.equal('transferBytes' in result,false);
});
test('missing request extra-info is distinguished from missing response metadata',async()=>{
 const result=await diagnoseWorkerSizes(fixture({allHeaders:()=>new Promise(()=>{})}),10);
 assert.equal(result.blockedStage,'requestHeaders');assert.deepEqual(result.stages,['response']);
 assert.equal('transferBytes' in result,false);
});
test('missing response extra-info and final encoded sizes remain distinguishable',async()=>{
 const response=await diagnoseWorkerSizes(fixture({response:async()=>({headersArray:()=>new Promise(()=>{})})}),10);
 assert.equal(response.blockedStage,'responseHeaders');
 const sizes=await diagnoseWorkerSizes(fixture({sizes:()=>new Promise(()=>{})}),10);
 assert.equal(sizes.blockedStage,'sizes');
 assert.equal('transferBytes' in response,false);assert.equal('transferBytes' in sizes,false);
});
test('completed cached metadata preserves the observed zero without a timeout fallback',async()=>{
 const result=await diagnoseWorkerSizes(fixture(),10);
 assert.equal(result.state,'complete');assert.equal(result.transferBytes,0);
 assert.deepEqual(result.stages,['response','requestHeaders','responseHeaders','sizes']);
});
