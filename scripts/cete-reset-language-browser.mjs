// Inspect/cancel the existing destructive dialog in isolated QA contexts.
// Never click its destructive confirmation or touch user-owned storage.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {checkedUrl} from './browser-guard.mjs';
const origin=checkedUrl(process.env.CETE_BASE||'http://127.0.0.1:8084');
const out=resolve(process.env.RUNNER_TEMP||'work','screenshots','cete-reset-language',process.env.CETE_LABEL||'source');await mkdir(out,{recursive:true});
const copy={tr:{start:'Sokağa in',title:'Dosyayı yak',cancel:'Vazgeç',confirm:'Yak',details:'Detay',warning:'Emin misin?'},en:{start:'Hit the street',title:'Delete game',cancel:'Cancel',confirm:'Delete',details:'Details',warning:'This cannot be undone.'},pl:{start:'Wyjdź na ulicę',title:'Usuń grę',cancel:'Anuluj',confirm:'Usuń',details:'Szczegóły',warning:'Tej operacji nie można cofnąć.'}};
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}),rows=[];
try{for(const lang of ['tr','en','pl'])for(const width of [320,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});await context.addInitScript(lang=>{localStorage.setItem('tariklab.language',lang);localStorage.setItem('cete-age-ok','1');},lang);
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${origin}/cete-savaslari`,{waitUntil:'networkidle'});await page.locator('#cete-player-name').fill('Reset language QA');await page.getByRole('button',{name:copy[lang].start,exact:true}).click();await page.locator('.game-shell').waitFor();
  if(width===320)await page.locator('.hud-header').getByRole('button',{name:copy[lang].details,exact:true}).click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('tariklab::cete:1')));
  await page.locator('.hud-header').getByRole('button',{name:copy[lang].title,exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  await dialog.getByRole('heading',{name:copy[lang].title,exact:true}).waitFor();assert.ok((await dialog.innerText()).includes(copy[lang].warning));await dialog.getByRole('button',{name:copy[lang].confirm,exact:true}).waitFor();
  const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);await page.screenshot({path:`${out}/${lang}-${width}.png`});
  await dialog.getByRole('button',{name:copy[lang].cancel,exact:true}).click();await dialog.waitFor({state:'hidden'});
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('tariklab::cete:1')));assert.ok(after);assert.equal(after.state.player.name,before.state.player.name);assert.equal(after.state.player.jobsDone,before.state.player.jobsDone);assert.equal(after.state.player.level,before.state.player.level);assert.deepEqual(errors,[]);
  rows.push({lang,width,authoredDialog:true,cancelPreservesProgress:true,destructiveConfirmationClicked:false,errors});
 }finally{await context.close();}
}await writeFile(`${out}/results.json`,JSON.stringify(rows,null,2));console.log(`CETE_RESET_LANGUAGE_PASS ${rows.length} inspect/cancel cases`);}finally{await browser.close();}
