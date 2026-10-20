import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const origin=process.env.WAVE1_BASE;
assert.ok(['https://www.tariklab.com','https://tariklab.tayaz29.workers.dev'].includes(origin));
const files=['games/next-wave.js','games/next-wave/devlet-content.js','games/next-wave/devlet-depth.js','games/next-wave/devlet-sim.js','games/tc-sim-devlet/presentation.js','games/tc-sim-devlet/index.html','games/apartman/index.html','games/bukucu/index.html','i18n/tlab-i18n.js','i18n/boot.js','i18n/pl-body.js','i18n/pl/tc-sim-devlet.json','i18n/pl/apartman.json','i18n/pl/bukucu.json'];
const rows=[];
for(const file of files){
 const response=await fetch(origin+'/'+file);assert.equal(response.status,200,file);
 const served=Buffer.from(await response.arrayBuffer()),source=await readFile('public/'+file);
 assert.ok(served.equals(source),'Exact deployed bytes: '+file);
 rows.push({file,bytes:served.length,sha256:createHash('sha256').update(served).digest('hex')});
}
const out=`${process.env.RUNNER_TEMP||'/workspace'}/screenshots/wave1-decision-production`;
await mkdir(out,{recursive:true});
await writeFile(out+'/hashes.json',JSON.stringify({canonicalMain:'2472042f3e97d21c2cbf64fa47588505a972d369',origin,rows},null,2));
console.log(JSON.stringify({origin,hashes:rows.length,status:'PASS'}));
