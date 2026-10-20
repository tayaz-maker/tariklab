import { gunzipSync } from "node:zlib";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const allHashes=new Set();
for(const theme of ['veto-h','gett-oh'])test(`${theme}: all card arts are unique local optimized WebP`,()=>{
 const base=`public/games/${theme}`;
 const source=JSON.parse(readFileSync(`${base}/source-cards.json`,'utf8'));
 const manifest=JSON.parse(readFileSync(`${base}/assets/art-manifest.json`,'utf8'));
 assert.equal(Object.keys(manifest.cards).length,source.length);
 const hashes=new Set();let bytes=0;const sizes=[];
 for(const card of source){
  const art=manifest.cards[card.id];assert.ok(art,card.id);
  assert.equal(art.path,`/games/${theme}/assets/cards/${card.id}.webp`);
  const data=readFileSync(`public${art.path}`);
  assert.equal(data.toString('ascii',0,4),'RIFF');assert.equal(data.toString('ascii',8,12),'WEBP');
  assert.equal(data.readUInt32LE(4)+8,data.length);
  // Pillow emits lossy VP8; verify the actual encoded frame dimensions.
  const frame=data.indexOf(Buffer.from([0x9d,0x01,0x2a]));assert.ok(frame>=0);
  assert.equal(data.readUInt16LE(frame+3)&0x3fff,art.width);assert.equal(data.readUInt16LE(frame+5)&0x3fff,art.height);
  const hash=createHash('sha256').update(data).digest('hex');assert.equal(hash,art.sha256);assert.ok(!hashes.has(hash),card.id);assert.ok(!allHashes.has(hash),`Cross-game duplicate: ${card.id}`);hashes.add(hash);allHashes.add(hash);
  assert.equal(data.length,art.bytes);assert.ok(data.length<180_000);bytes+=data.length;sizes.push(data.length);
 }
 sizes.sort((a,b)=>a-b);assert.equal(manifest.summary.totalBytes,bytes);
 assert.equal(manifest.summary.coverage,source.length);assert.ok(bytes/source.length<100_000);
 assert.equal(manifest.summary.maxBytes,sizes.at(-1));assert.equal(manifest.summary.duplicateHashes,0);
});

test('source transport packs reproduce all 600 accepted card images and two backgrounds',()=>{
 const paths=new Set();
 for(const filename of readdirSync('scripts/duel-art-packs').filter(n=>n.endsWith('.json.gz'))){
  const pack=JSON.parse(gunzipSync(readFileSync(`scripts/duel-art-packs/${filename}`)).toString('utf8'));
  for(const asset of pack.assets){
   assert.ok(!paths.has(asset.path),`Duplicate packed asset: ${asset.path}`);paths.add(asset.path);
   const packed=Buffer.from(asset.base64,'base64');
   assert.equal(createHash('sha256').update(packed).digest('hex'),asset.sha256);
   assert.deepEqual(readFileSync(asset.path),packed,`Stale pack: ${asset.path}`);
  }
 }
 for(const theme of ['veto-h','gett-oh']){
  const source=JSON.parse(readFileSync(`public/games/${theme}/source-cards.json`,'utf8'));
  for(const card of source)assert.ok(paths.has(`public/games/${theme}/assets/cards/${card.id}.webp`));
  const background=`public/games/${theme}/assets/atmosphere.webp`;assert.ok(paths.has(background));
  const bytes=readFileSync(background);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes.length<300_000);
 }
 assert.equal(paths.size,602);
});
