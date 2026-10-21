import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PLAYABLE_REGIONS,getDistrict} from '../public/games/tc-sim/js/locations.js';
const root=new URL('../',import.meta.url);
test('unused old illustrations are absent; current maps and all legacy region IDs remain',()=>{
 for(const file of ['quarter-ridge.jpg','quarter-shore.jpg','quarter-edge.jpg','city-ankara-west.jpg','city-ankara-east.jpg','city-izmir-konak.jpg','city-izmir-bornova.jpg'])assert.equal(existsSync(new URL(`public/games/tc-sim/assets/map/${file}`,root)),false);
 const hashes={istanbul:'02b579fa0a60af243a09bf9012cd61eff9307a443d818f9219f31565a39d574e',ankara:'85999ae77098b2b3b1cdc51d8f64b4fda712d95c392fa42aa3ac5ec9a885cbf0',izmir:'e130026cf2d41933f1de904f0e7b35f598956708582e728a16698cd119a7163e'};
 for(const [city,expected] of Object.entries(hashes))assert.equal(createHash('sha256').update(readFileSync(new URL(`public/games/tc-sim/assets/map/tc-sim-2-${city}.webp`,root))).digest('hex'),expected);
 assert.equal(PLAYABLE_REGIONS.length,23);for(const id of ['avcilar','bayrampasa','batikent'])assert.equal(getDistrict(id).id,id);
 const app=readFileSync(new URL('public/games/tc-sim/js/app.js',root),'utf8');assert.doesNotMatch(app,/region-legacy-art|Önceki mahalle çizimleri|quarter-\$\{id\}/);
});
