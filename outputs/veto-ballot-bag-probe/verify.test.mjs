import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
const dir=new URL('./',import.meta.url);
const svg=readFileSync(new URL('SND-011.svg',dir),'utf8');
const evidence=JSON.parse(readFileSync(new URL('evidence.json',dir)));
const source=readFileSync(new URL('../../public/games/veto-h/source-cards.json',import.meta.url));
const sha=x=>createHash('sha256').update(x).digest('hex');
test('exact original SND-011 record and all300 source bytes remain immutable',()=>{
  assert.equal(sha(source),'b876fdb69eeb4ddcfd1d06e397df14e14070cf3131ad4d210b4608e8fe7b4acd');
  assert.deepEqual(evidence.sourceCard,JSON.parse(source).find(c=>c.id==='SND-011'));
  assert.equal(evidence.sourceCard.text,'Savaşta yok olmaz. Her Hazırlık Aşaması’nda OP −200.');
});
test('standalone SVG contains no raster, external reference, visible text, script or animation',()=>{
  assert.doesNotMatch(svg,/<(?:image|text|script|foreignObject|animate|animateTransform|set)\b/i);
  assert.doesNotMatch(svg,/(?:href|src)=|data:|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i);
  assert.match(svg,/width="576" height="384" viewBox="0 0 1440 960"/);
});
test('static vector budget and hash match compact evidence',()=>{
  assert.equal(evidence.sha256,sha(svg));
  assert.equal(evidence.bytes,Buffer.byteLength(svg));
  assert.equal(evidence.gzipBytes,gzipSync(svg,{level:9}).length);
  assert.ok(evidence.bytes<60000);
  assert.ok(evidence.gzipBytes<10000);
  assert.equal(evidence.quality.accepted,false);
  assert.equal(evidence.status,'REJECT_FOR_PRODUCTION');
  assert.equal(evidence.quality.decision,'REJECT_FOR_PRODUCTION');
  assert.equal(evidence.quality.completedProductionCards,0);
});
test('one-source generation is deterministic without an asset dependency',()=>{
  execFileSync(process.execPath,[new URL('build.mjs',dir).pathname]);
  assert.equal(readFileSync(new URL('SND-011.svg',dir),'utf8'),svg);
  assert.deepEqual(JSON.parse(readFileSync(new URL('evidence.json',dir))),evidence);
});
