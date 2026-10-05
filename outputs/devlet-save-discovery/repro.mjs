// Synthetic runtime contract probe; no browser, real localStorage or production access.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
const repo=fileURLToPath(new URL('../../', import.meta.url));
const base='dfbab3f15b74df5336fecf9f7d4247184cbb9222';
assert.equal(execFileSync('git',['diff',base,'--','public/games/next-wave.js','public/games/next-wave','public/games/tc-sim-devlet'],{cwd:repo,encoding:'utf8'}),'');
assert.match(readFileSync(repo+'/public/games/tc-sim-devlet/app.js','utf8'),/bootGame\("tc-sim-devlet", draw\);/);
const {bootGame}=await import(pathToFileURL(repo+'/public/games/next-wave/shared/runtime.js'));
const {create,normalize}=await import(pathToFileURL(repo+'/public/games/next-wave.js'));
const id='tc-sim-devlet',key='tariklab.nextwave.tc-sim-devlet.slot1',bak=key+'.backup';
const fresh=()=>create(id),valid=JSON.stringify(fresh()),results=[];
function environment(entries=[],failWrites=false){
 const values=new Map(entries),reads=[],writes=[];
 globalThis.localStorage={getItem(k){reads.push(k);return values.get(k)??null;},setItem(k,v){if(failWrites)throw Error('synthetic quota');writes.push(k);values.set(k,String(v));},removeItem(k){values.delete(k);}};
 globalThis.document={querySelector:()=>null,documentElement:{classList:{toggle(){}}}};
 globalThis.window={confirm:()=>true,addEventListener(){},tlabI18n:{getLang:()=> 'tr',onLang:()=>()=>{}}};
 return {values,reads,writes};
}
try{
 let e=environment([[key,valid]]),session=bootGame(id,()=>{});
 assert.equal(session.continue(),true);assert.equal(session.state.meta.version,2);
 assert.equal(session.save(1),true);assert.equal(session.save(1),true);
 assert.equal(e.values.has(bak),false);assert.equal(e.writes.includes(bak),false);
 results.push({case:'valid v2 default reload and repeated save',result:'PASS',backupCreated:false});
 e=environment([[key,'{broken'],[bak,valid]]);session=bootGame(id,()=>{});
 assert.equal(session.slotSummaries()[0].filled,false);assert.equal(session.continue(),false);
 assert.equal(e.reads.includes(bak),false);assert.equal(e.values.get(key),'{broken');assert.equal(e.values.get(bak),valid);assert.equal(e.writes.length,0);
 results.push({case:'default corrupt primary plus injected valid backup',result:'EXPECTED_DEFAULT_NO_BACKUP_CONTRACT',backupRead:false,bytesPreserved:true});
 e=environment([[key,valid]]);session=bootGame(id,()=>{});session.continue();const live=session.state;
 e.values.set(key,'{broken');e.values.set(bak,valid);const writesBefore=e.writes.length;
 assert.equal(session.load(1),false);assert.equal(session.state,live);assert.match(session.notice,/açık oyun korunuyor/);
 assert.equal(e.values.get(key),'{broken');assert.equal(e.values.get(bak),valid);assert.equal(e.writes.length,writesBefore);
 results.push({case:'default corrupt load while game is open',result:'PASS',liveStatePreserved:true,storedBytesPreserved:true});
 e=environment([[key,'{broken'],[bak,valid]]);session=bootGame(id,()=>{},{safe:true});
 assert.equal(session.continue(),true);assert.equal(session.state.meta.version,2);assert.ok(e.reads.includes(bak));assert.equal(e.values.get(key),'{broken');assert.equal(e.values.get(bak),valid);
 results.push({case:'explicit safe:true control',result:'PASS',validBackupRecovered:true,repairWrite:false,actualDevletConfiguration:false});
 const old=fresh();delete old.devletDepth;old.meta.version=1;const oldBytes=JSON.stringify(old);
 e=environment([[key,oldBytes]]);session=bootGame(id,()=>{});assert.equal(session.continue(),true);
 assert.equal(session.state.meta.version,2);assert.ok(session.state.devletDepth);assert.deepEqual(normalize(id,structuredClone(session.state)),session.state);
 assert.equal(e.values.get(key),oldBytes);assert.equal(session.save(1),true);assert.equal(JSON.parse(e.values.get(key)).meta.version,2);
 results.push({case:'synthetic legacy v1 without depth via actual default runtime',result:'PASS',loadedVersion:2,idempotent:true,legacyBytesUntouchedUntilSave:true});
 e=environment([[key,valid]],true);session=bootGame(id,()=>{});session.continue();const quotaState=session.state;
 assert.equal(session.save(1),false);assert.equal(session.state,quotaState);assert.equal(e.values.get(key),valid);assert.match(session.notice,/Kayıt yazılamadı/);
 results.push({case:'synthetic write quota failure',result:'PASS',liveStatePreserved:true,primaryBytesPreserved:true});
 console.log(JSON.stringify({base,scope:'Synthetic in-memory localStorage and DOM stubs; actual unmodified runtime/create/normalize imported',finding:'NOT_REPRODUCED_AS_DATA_LOSS_BUG',results},null,2));
}finally{delete globalThis.localStorage;delete globalThis.document;delete globalThis.window;}
