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
test('all existing TC engine/content/save bytes remain the accepted main; quarters changes are confined to rendering',()=>{
 const files=[
  "public/games/tc-sim/js/adult-life-events.js",
  "public/games/tc-sim/js/askerlik.js",
  "public/games/tc-sim/js/bank-accounts.js",
  "public/games/tc-sim/js/bank-actions.js",
  "public/games/tc-sim/js/bank-business.js",
  "public/games/tc-sim/js/bank-cards.js",
  "public/games/tc-sim/js/bank-record.js",
  "public/games/tc-sim/js/bank-ui.js",
  "public/games/tc-sim/js/banks-presentation.js",
  "public/games/tc-sim/js/body-events.js",
  "public/games/tc-sim/js/body-systems.js",
  "public/games/tc-sim/js/body-visual.js",
  "public/games/tc-sim/js/calendar.js",
  "public/games/tc-sim/js/catalog.js",
  "public/games/tc-sim/js/criminal-justice.js",
  "public/games/tc-sim/js/decision-network.js",
  "public/games/tc-sim/js/depth-events.js",
  "public/games/tc-sim/js/depth2-events.js",
  "public/games/tc-sim/js/depth2-systems.js",
  "public/games/tc-sim/js/depth3-events.js",
  "public/games/tc-sim/js/depth3-systems.js",
  "public/games/tc-sim/js/education.js",
  "public/games/tc-sim/js/eras.js",
  "public/games/tc-sim/js/events.js",
  "public/games/tc-sim/js/exchange.js",
  "public/games/tc-sim/js/expansion-events.js",
  "public/games/tc-sim/js/game-date.js",
  "public/games/tc-sim/js/gameplay-language.js",
  "public/games/tc-sim/js/historical-scenarios.js",
  "public/games/tc-sim/js/household.js",
  "public/games/tc-sim/js/icra.js",
  "public/games/tc-sim/js/intimacy.js",
  "public/games/tc-sim/js/job-start-outcome-ui.js",
  "public/games/tc-sim/js/job-start-outcome.js",
  "public/games/tc-sim/js/life-content.js",
  "public/games/tc-sim/js/life-depth.js",
  "public/games/tc-sim/js/life-echo-events.js",
  "public/games/tc-sim/js/life.js",
  "public/games/tc-sim/js/lifetime-ui.js",
  "public/games/tc-sim/js/lifetime.js",
  "public/games/tc-sim/js/locations.js",
  "public/games/tc-sim/js/march-hatir.js",
  "public/games/tc-sim/js/monthly-cash.js",
  "public/games/tc-sim/js/mortgage.js",
  "public/games/tc-sim/js/network.js",
  "public/games/tc-sim/js/parenthood.js",
  "public/games/tc-sim/js/partner-workplace.js",
  "public/games/tc-sim/js/period-economy.js",
  "public/games/tc-sim/js/pocket-income.js",
  "public/games/tc-sim/js/quarters.js",
  "public/games/tc-sim/js/realism-events.js",
  "public/games/tc-sim/js/region-data.js",
  "public/games/tc-sim/js/region-map-data.js",
  "public/games/tc-sim/js/region-map.js",
  "public/games/tc-sim/js/risk-layer.js",
  "public/games/tc-sim/js/save.js",
  "public/games/tc-sim/js/social-insurance.js",
  "public/games/tc-sim/js/social.js",
  "public/games/tc-sim/js/state.js",
  "public/games/tc-sim/js/status-panel.js",
  "public/games/tc-sim/js/time.js",
  "public/games/tc-sim/js/ui-icons.js",
  "public/games/tc-sim/js/wealth.js",
  "public/games/tc-sim/js/wedding-planning.js",
  "public/games/tc-sim/js/weekly-feedback.js"
];
 const h=createHash('sha256');for(const f of files){let source=readFileSync(f,'utf8');if(f.endsWith('/quarters.js'))source=source.split('export function renderSemtEmlak')[0];h.update(f).update(source);}assert.equal(h.digest('hex'),'358ed096fc10c1f692da06f83fa4b72532318840e3d4839d976ab9cad4163e21');
});
