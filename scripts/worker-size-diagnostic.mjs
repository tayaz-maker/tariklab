import {withDeadline} from './route-performance-deadline.mjs';
import {responseTransferBytes} from './route-performance-metrics.mjs';

// Diagnostic control only: the HTTP meter supplies bytes even when Playwright's
// SW bootstrap metadata is incomplete. No request or worker is disabled.
export async function diagnoseWorkerSizes(request, timeoutMs=2000) {
 const stages=[];
 let stage='response';
 async function read(name,operation) {
  stage=name;
  const result=await withDeadline(`worker metadata: ${name}`,operation,timeoutMs);
  stages.push(name);return result;
 }
 try {
  const response=await read('response',()=>request.response());
  if(!response)throw new Error('requestfinished has no response');
  await read('requestHeaders',()=>request.allHeaders());
  await read('responseHeaders',()=>response.headersArray());
  const sizes=await read('sizes',()=>request.sizes());
  return {state:'complete',stages,sizes,transferBytes:responseTransferBytes(sizes)};
 } catch(error) {
  return {state:'incomplete',stages,blockedStage:stage,error:String(error)};
 }
}
