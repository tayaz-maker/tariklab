import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const out=new URL('../../outputs/card-realism/veto-surface-study/',import.meta.url);
const read=name=>readFileSync(new URL(name,out));
const build=()=>execFileSync(process.execPath,['scripts/card-art/veto-surface-study.mjs'],{cwd:root,stdio:'pipe'});
build();
const svg=read('SND-001-study.svg');
const manifest=JSON.parse(read('provenance.json'));

test('the authored source rebuilds identical SVG and provenance bytes',()=>{
  const first=read('provenance.json');
  build();
  assert.deepEqual(svg,read('SND-001-study.svg'));
  assert.deepEqual(first,read('provenance.json'));
});
test('SND-001 study preserves artwork viewport and fits the bounded SVG budget',()=>{
  assert.match(svg.toString(),/width="576" height="384" viewBox="0 0 576 384"/);
  assert.ok(svg.length<=80_000,`SVG exceeds 80 KB: ${svg.length}`);
  assert.equal(manifest.id,'SND-001');
  assert.equal(manifest.bytes,svg.length);
  assert.equal(manifest.sha256,createHash('sha256').update(svg).digest('hex'));
});
test('scene contains no lettering, remote assets, embedded raster or active content',()=>{
  const source=svg.toString();
  assert.doesNotMatch(source,/<(?:text|image|script|foreignObject|animate|audio|video)\b/i);
  assert.doesNotMatch(source,/(?:href|src)\s*=|data:|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i);
  assert.doesNotMatch(source,/on(?:load|click|error)\s*=|@import/i);
  assert.deepEqual(manifest.externalAssets,[]);
});
test('all referenced material/clip/filter identifiers resolve locally',()=>{
  const s=svg.toString(),ids=[...s.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'duplicate SVG ID');
  for(const [,id]of s.matchAll(/url\(#([^)]+)\)/g))assert.ok(ids.includes(id),`missing ${id}`);
});
test('quality failure is explicit and cannot be mistaken for production acceptance',()=>{
  assert.equal(manifest.status,'REJECTED_FOR_PRODUCTION');
  assert.equal(manifest.artAccepted,false);
  assert.equal(manifest.production,false);
  assert.equal(manifest.rolloutEligible,false);
  assert.equal(manifest.rejection.length,4);
});
test('source depends on no image/model/library inputs and has no runtime randomness',()=>{
  const s=readFileSync(new URL('./veto-surface-study.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(s,/readFile|fetch\(|Math\.random\(|Date\.now\(|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  const imports=[...s.matchAll(/from '([^']+)'/g)].map(m=>m[1]);
  assert.deepEqual(imports,['node:fs','node:crypto','node:url']);
});
