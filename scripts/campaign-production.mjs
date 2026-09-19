import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const origin='https://www.tariklab.com';
const digest=s=>createHash('sha256').update(s).digest('hex');
const files=['hanedanian/campaign.js','hanedanian/engine.js','hanedanian/app.js','ihtilal/app.js'];
let matches=false;
for(let attempt=0;attempt<24;attempt++){
 const checks=await Promise.all(files.map(async name=>{
  const response=await fetch(`${origin}/games/${name}?release=${process.env.GITHUB_SHA||'smoke'}`);
  return response.ok&&digest(await response.text())===digest(readFileSync(`public/games/${name}`));
 }));
 if(checks.every(Boolean)){matches=true;break;}
 await new Promise(resolve=>setTimeout(resolve,10000));
}
assert.ok(matches,'production must serve the exact reviewed game code before smoke');
for(const script of ['scripts/hanedanian-browser.mjs','scripts/ihtilal-browser.mjs']){
 const r=spawnSync(process.execPath,[script],{stdio:'inherit',env:{...process.env,GAME_E2E_ORIGIN:origin,HANEDANIAN_SOAK_MS:'0'}});
 assert.equal(r.status,0,`${script}: production browser acceptance`);
}
