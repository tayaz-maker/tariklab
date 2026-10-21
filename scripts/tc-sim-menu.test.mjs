import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {NAVIGATION_ITEMS,NAVIGATION_GROUPS,getNavigationTarget,screenFromLocation,screenTitle} from '../public/games/tc-sim/js/navigation.js';
test('every canonical route has one menu owner and three localized headings',()=>{
 const views=NAVIGATION_ITEMS.map(i=>i.view);assert.equal(new Set(views).size,views.length);
 const owned=[...NAVIGATION_GROUPS.flat(),'dashboard','inbox','character','calendar','decisions','goals','saves'];assert.deepEqual(owned.toSorted(),views.toSorted());
 for(const view of views){assert.equal(getNavigationTarget(view),view);for(const lang of ['tr','en','pl'])assert.ok(screenTitle(view,lang).length>1);assert.equal(screenFromLocation({hash:'#screen='+view}),view);assert.equal(screenFromLocation({search:'?screen='+view}),view);}
 assert.equal(getNavigationTarget('missing'),null);assert.equal(screenFromLocation({hash:'#screen=missing'}),null);assert.notEqual(getNavigationTarget('home'),getNavigationTarget('city'));
 assert.ok(NAVIGATION_GROUPS[3].includes('career'));assert.ok(!NAVIGATION_GROUPS[0].includes('career'));
});
// Phase 0 remains the source baseline. Per-file pins allow the five authorized
// gameplay fixes to compose while every untouched engine and UI file stays pinned.
test('TC engine, content, saves and presentation match the reviewed file fingerprints',()=>{
 const fingerprints=JSON.parse(readFileSync(new URL('./tc-sim-source-fingerprints.json',import.meta.url),'utf8'));
 for(const [file,expected] of Object.entries(fingerprints)) {
  let source=readFileSync(file,'utf8');
  if(file.endsWith('/quarters.js'))source=source.split('export function renderSemtEmlak')[0];
  assert.equal(createHash('sha256').update(source).digest('hex'),expected,file);
 }
});
