import assert from 'node:assert/strict';
import {fixture,place} from './duel-fixture.mjs';
import {serialize} from '../public/games/duel-core/save.js';
import {assertSameOrigin} from './duel-origin-proof.mjs';

export async function duelPolishSmoke(browser,origin,out){
  for(const theme of ['veto-h','gett-oh'])for(const width of [390,1280]){
    const context=await browser.newContext({viewport:{width,height:844}});
    try{
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const state=fixture(theme);
      place(state,theme==='veto-h'?'SND-152':'RCN-152',0,'hand');
      const key=`tariklab.${theme}.duel`,raw=serialize(state);
      await context.addInitScript(({key,raw})=>{
        if(!sessionStorage.getItem('qa.fixture.seeded')){
          localStorage.setItem(key,raw);
          localStorage.setItem('tariklab.darbe-h.duel','retired-save-untouched');
          sessionStorage.setItem('qa.fixture.seeded','1');
        }
        localStorage.setItem('tariklab.language','pl');
      },{key,raw});
      await page.goto(`${origin}/games/${theme}/index.html`);
      assertSameOrigin(page.url(),origin,'Polish duel');
      await page.getByRole('button',{name:'Kontynuuj',exact:true}).click();
      await page.locator('.duel-table').waitFor();
      assert.equal(await page.locator('html').getAttribute('lang'),'pl');
      await page.waitForFunction(()=>[...document.querySelectorAll('.hand-row img')].some(i=>i.complete&&i.naturalWidth>0));
      const saved=await page.evaluate(k=>localStorage.getItem(k),key);
      await page.reload();
      assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),saved);
      await page.getByRole('button',{name:'Kontynuuj',exact:true}).click();
      await page.locator('.duel-table').waitFor();
      assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab.darbe-h.duel')),'retired-save-untouched');
      assert.deepEqual(errors,[]);
      await page.screenshot({path:`${out}/${theme}-pl-${width}.png`});
    }finally{await context.close();}
  }
  console.log('DUEL_POLISH_PASS 4 desktop/mobile art and save/reload cases');
}
