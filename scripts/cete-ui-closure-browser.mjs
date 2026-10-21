// Copy/semantic regression only: real new-game UI; no game-state fixtures/reset.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {checkedUrl} from './browser-guard.mjs';
import {readSaveEvidence,assertPreparedSave,assertSavedProgress,languagesFrom,widthsFrom} from './master-acceptance-contract.mjs';
const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const base=checkedUrl(arg('--base','http://127.0.0.1:8124')),mode=arg('--mode','source');assert.ok(['source','built'].includes(mode));
const languages=languagesFrom(arg('--languages')),widths=widthsFrom(arg('--viewports')),label=arg('--label',mode);assert.match(label,/^[a-zA-Z0-9_-]+$/);
const out=resolve(process.env.RUNNER_TEMP||'work','screenshots','cete-ui-closure',label);await mkdir(out,{recursive:true});
const copy={
 tr:{start:'Sokağa in',step:'İlk iş: İcraat’ten pavyon çıkışı veya tombala.',skip:'Atla',starter:'Çaylak defteri: önce pavyon çıkışı, sonra tombala. Mermi yetmezse saati geçir.',deadline:'Yarın biter.',crew:'Görev için 1 boş adam gerek. Meşgul adam icraata çıkamaz.',title:'Ana ekrana ekle',install:'Kur',dismiss:'Tamam',ios:'Paylaş → Ana Ekrana Ekle. Sonra netsiz açılır.',hint:'Kur, bir kez online aç, sonra uçak modunda oyna.',offline:'Çevrimdışı · kayıt yerelde',action:'İcraata çık'},
 en:{start:'Hit the street',step:'First job: in Jobs, choose the pavilion exit or bingo.',skip:'Skip',starter:'Start with the first low-risk job. Recruit a free crew member for riskier jobs. Pass time to recover energy.',deadline:'Expires tomorrow.',crew:'Requires 1 available crew. Busy crew cannot join.',title:'Add to Home Screen',install:'Install',dismiss:'Got it',ios:'Share → Add to Home Screen. Then open it offline.',hint:'Install, open once online, then play in airplane mode.',offline:'Offline · saved locally',action:'Take job'},
 pl:{start:'Wyjdź na ulicę',step:'Pierwsze zlecenie: w Zleceniach wybierz wyjście z lokalu lub bingo.',skip:'Pomiń',starter:'Zacznij od pierwszego zlecenia o niskim ryzyku. Do trudniejszych zleceń zwerbuj darmowego członka ekipy. Przewiń czas, aby odzyskać energię.',deadline:'Termin upływa jutro.',crew:'Wymagana wolna ekipa: 1. Zajęci nie mogą dołączyć.',title:'Dodaj do ekranu głównego',install:'Zainstaluj',dismiss:'Rozumiem',ios:'Udostępnij → Dodaj do ekranu głównego. Potem otworzysz grę offline.',hint:'Zainstaluj, otwórz raz online, a potem graj w trybie samolotowym.',offline:'Offline · zapis lokalny',action:'Podejmij zlecenie'},
};
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']}),rows=[];
const hashSave=value=>Object.fromEntries(Object.entries(value).map(([key,data])=>[key,createHash('sha256').update(JSON.stringify(data)).digest('hex')]));
try{for(const lang of languages)for(const width of widths){
 const ios=width===390,c=copy[lang],row={lang,width,iosEmulation:ios,ok:false},errors=[];
 const context=await browser.newContext({viewport:{width,height:ios?844:900},serviceWorkers:mode==='built'?'allow':'block',...(ios?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'}:{})});
 await context.addInitScript(lang=>{localStorage.setItem('tariklab.language',lang);localStorage.setItem('cete-age-ok','1');},lang);
 try{
  const page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push({type:'JS',message:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({type:'console',message:m.text()});});page.on('requestfailed',r=>errors.push({type:'requestfailed',url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)errors.push({type:'HTTP',url:r.url(),status:r.status()});});
  await page.goto(base+'/cete-savaslari',{waitUntil:'networkidle'});await page.locator('#cete-player-name').fill('Copy Closure QA');await page.getByRole('button',{name:c.start,exact:true}).click();await page.locator('.game-shell .hud-header').getByText('Copy Closure QA',{exact:false}).waitFor();
  const readSave=async()=>readSaveEvidence('cete-savaslari',await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))));
  const before=await readSave();assertPreparedSave('cete-savaslari',before);
  await page.getByText(c.step,{exact:false}).first().waitFor();await page.getByRole('button',{name:c.skip,exact:true}).waitFor();await page.getByText(c.starter,{exact:true}).waitFor();assert.ok((await page.locator('.game-shell').innerText()).includes(c.deadline));
  // Check the actual dynamic-count blocked-crew instruction; no crew/save mutation.
  if(lang!=='tr')await page.getByText(c.crew,{exact:true}).first().waitFor();
  // Exercise the browser install presentation event, not a real OS install.
  await page.evaluate(()=>{const event=new Event('beforeinstallprompt');event.prompt=async()=>{};window.dispatchEvent(event);});
  await page.getByText(c.title,{exact:true}).waitFor();await page.getByText(ios?c.ios:c.hint,{exact:true}).waitFor();await page.getByRole('button',{name:c.install,exact:true}).waitFor();await page.screenshot({path:`${out}/${lang}-${width}-install.png`});
  await page.getByRole('button',{name:c.dismiss,exact:true}).click();
  if(mode==='built'){
   await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForLoadState('networkidle');
   await page.reload({waitUntil:'networkidle'});await page.locator('.game-shell .hud-header').getByText('Copy Closure QA',{exact:false}).waitFor();await page.getByText(c.step,{exact:false}).first().waitFor();
  }
  await page.waitForLoadState('networkidle');await context.setOffline(true);
  if(mode==='built')await page.reload({waitUntil:'load'});
  await page.locator('.game-shell .hud-header').getByText('Copy Closure QA',{exact:false}).waitFor();await page.getByRole('button',{name:c.action,exact:true}).first().waitFor();await page.getByText(c.offline,{exact:true}).waitFor();await page.getByText(c.step,{exact:false}).first().waitFor();
  const after=await readSave();assertSavedProgress(before,after);assert.equal(await page.evaluate(()=>document.documentElement.lang),lang);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/${lang}-${width}-offline.png`});Object.assign(row,{ok:true,authoredTutorial:true,jobHelp:true,installCopy:true,actualOfflineReload:mode==='built',namedPlayerHUD:true,primaryAction:true,beforeSaveHashes:hashSave(before),afterSaveHashes:hashSave(after)});
 }catch(error){row.error=error.message;}finally{row.errors=errors;rows.push(row);await context.close();await writeFile(`${out}/results.json`,JSON.stringify({mode,base,rows},null,2));}
 console.log(JSON.stringify(row));
}assert.ok(rows.every(row=>row.ok),'Cete UI closure regression failed');console.log(`CETE_UI_CLOSURE_PASS ${mode} ${rows.length} cells`);}finally{await browser.close();}
