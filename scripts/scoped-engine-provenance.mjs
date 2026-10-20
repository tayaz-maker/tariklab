// Load-only exception for the existing frozen aggregate. Every gameplay byte
// remains in that original aggregate; both reviewed loader prefixes are pinned.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const fixture=new URL('./fixtures/scoped-engine/',import.meta.url);
const provenance=JSON.parse(readFileSync(new URL('provenance.json',fixture),'utf8'));
const original=JSON.parse(readFileSync(new URL('original-prefix.json',fixture),'utf8'));
const digest=value=>createHash('sha256').update(value).digest('hex');
export function frozenNextWaveBytes(bytes){
 const text=bytes.toString('utf8'),boundary=text.indexOf('function pushHist');
 assert.ok(boundary>0,'gameplay boundary must exist');
 const prefix=text.slice(0,boundary),suffix=text.slice(boundary);
 assert.equal(digest(original),provenance.originalPrefixSha256,'frozen import fixture');
 assert.equal(digest(prefix),provenance.scopedPrefixSha256,'reviewed scoped loader only');
 assert.equal(digest(suffix),provenance.gameplaySuffixSha256,'all gameplay remains byte-identical');
 return Buffer.from(original+suffix);
}
