import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {checkedOutcomeOrigin, fingerprintPaths, verifyOutcomeBuild} from './tc-sim-job-start-target.mjs';
export const REGION_FINGERPRINT_PATHS=Object.freeze([
 '/games/tc-sim/index.html','/games/tc-sim/region-map.css?v=10',
 ...['region-data.js','region-map-data.js','region-map.js','quarters.js','state.js','save.js'].map(file=>`/games/tc-sim/js/${file}?v=10`),
 ...['istanbul','ankara','izmir'].map(city=>`/games/tc-sim/assets/map/tc-sim-2-${city}.webp`),
]);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function checkedRegionTarget(values){
 const hosted=Boolean(values['base-url']);
 assert.ok(!(hosted&&values.serve),'choose --serve or --base-url');
 if(hosted){assert.ok(values['expected-root'],'hosted checks require --expected-root');assert.match(values['expected-sha']||'',/^[a-f0-9]{40}$/,'hosted checks require a full --expected-sha');}
 if(values['expected-sha'])assert.match(values['expected-sha'],/^[a-f0-9]{40}$/,'a full --expected-sha is required');
 return {hosted,origin:hosted?checkedOutcomeOrigin(values['base-url'],true):null,serve:hosted?null:values.serve||'public',expectedRoot:values['expected-root']||values.serve||'public',expectedSha:values['expected-sha']||null};
}
export async function requireRegionCurrentMain(expectedSha,request=fetch){
 assert.match(expectedSha||'',/^[a-f0-9]{40}$/);
 const response=await request('https://api.github.com/repos/tayaz-maker/tariklab/branches/main',{redirect:'error',cache:'no-store',headers:{Accept:'application/vnd.github+json','User-Agent':'TarikLab-TC-regions-acceptance'},signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200,'current main verification unavailable');const main=await response.json();assert.equal(main.commit?.sha,expectedSha,'main moved; refuse stale regional production acceptance');return main.commit.sha;
}
export async function verifyRegionBuild(origin,directory,{expectedSha=null,repository=process.cwd(),request=fetch}={}){
 // Static game files are copied verbatim by the production build. Validate the
 // expected build against immutable Git blobs before comparing hosted bytes.
 if(expectedSha){
  assert.match(expectedSha,/^[a-f0-9]{40}$/);
  const git=args=>execFileSync('git',args,{cwd:repository,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});
  assert.equal(git(['rev-parse',`${expectedSha}^{commit}`]).toString().trim(),expectedSha);
  for(const path of [...fingerprintPaths,...REGION_FINGERPRINT_PATHS]){
   const file=path.split('?')[0],bytes=await readFile(resolve(directory,'.'+file));
   assert.equal(digest(bytes),digest(git(['show',`${expectedSha}:public${file}`])),`expected build is not exact SHA ${expectedSha}: ${path}`);
  }
 }
 const rows=await verifyOutcomeBuild(origin,directory,request);
 for(const path of REGION_FINGERPRINT_PATHS){
  const expected=digest(await readFile(resolve(directory,'.'+path.split('?')[0])));
  const response=await request(origin+path,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  assert.equal(response.status,200,`region asset status: ${path}`);const bytes=Buffer.from(await response.arrayBuffer()),actual=digest(bytes);
  assert.equal(actual,expected,`deployed region asset is not the exact candidate: ${path}`);rows.push({path,bytes:bytes.length,sha256:actual});
 }
 return rows;
}
