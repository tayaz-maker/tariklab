import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync('scripts/fixtures/lossless-sources.json','utf8'));
test('source-only gzip transport preserves all original bytes',()=>{
 assert.equal(Object.keys(manifest).length,53);let original=0,compressed=0;
 for(const [path,expected] of Object.entries(manifest)){
  const packed=readFileSync(path+'.gz'),bytes=gunzipSync(packed);
  assert.equal(bytes.length,expected.before,path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256,path);
  original+=bytes.length;compressed+=packed.length;
 }
 assert.ok(original-compressed>3_800_000);
});
