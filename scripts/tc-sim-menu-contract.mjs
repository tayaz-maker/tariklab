// Shared by full visual acceptance and the existing CI UX gate.
import assert from 'node:assert/strict';
import {screenTitle} from '../public/games/tc-sim/js/navigation.js';
export const ownership={'.region-map':['city'],'.location-cities':['city'],'[data-location-move]':['home'],'[data-semt-surface="housing"]':['home'],'[data-semt-surface="business"]':['finance'],'[data-semt-action="open"]':['finance'],'[data-mortgage-panel]':['home'],'[data-wealth-action="property-owner"]':['home'],'.bank-accounts':['banks'],'[data-credit]':['banks'],'[data-exchange]':['banks'],'.week-panel':['decisions'],'.life-depth-panel':['goals'],'[data-finance-ledger]':['finance'],'#yearly-plan-form':['character'],'[data-load-slot]':['saves'],'[data-remember-screen]':['settings']};
export async function assertMenuScreen(page, view, language, seen = new Set()) {
 assert.equal(await page.locator('.workspace').getAttribute('data-screen'),view);
 assert.equal(await page.locator('.workspace-head h1').innerText(),screenTitle(view,language));
 assert.equal(await page.locator('.side-nav .is-active').count(),1);
 assert.equal(await page.locator('.side-nav [aria-current="page"]').getAttribute('data-view'),view);
 assert.equal(await page.locator('.workspace-head').count(),1);
 for(const [selector,owners] of Object.entries(ownership))if(await page.locator(selector).count()){
  assert.ok(owners.includes(view),`${language}/${view}: foreign ${selector}`);seen.add(selector);
 }
 if(view==='decisions'){
  const heading={tr:'Zamanını nasıl kullandın?',en:'How did you use your time?',pl:'Jak wykorzystałeś swój czas?'}[language];
  await page.waitForFunction(text=>document.querySelector('.week-panel .panel-head h2')?.textContent.trim()===text,heading);
  assert.equal(await page.locator('.week-panel .panel-head h2').isVisible(),true);
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),`${view}: horizontal overflow`);
 return seen;
}
