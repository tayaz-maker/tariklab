import assert from 'node:assert/strict';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {archiveAcceptance} from './ihtilal-archive-browser.mjs';
import {coastArchiveAcceptance} from './esik-archive-browser.mjs';

const origin=process.env.MIGRATION_ORIGIN;
assert.ok(['https://www.tariklab.com','https://tariklab.tayaz29.workers.dev'].includes(origin));
const out=`${process.env.RUNNER_TEMP}/screenshots/cloudflare-migration`;
await mkdir(out,{recursive:true});
const catalog=(await readFile('src/lib/games.ts','utf8')).split('export const GAMES:')[1];
const routes=[...catalog.matchAll(/slug: "([^"]+)"[^}]*?status: "live",\s*href: "([^"]+)"/g)].map(m=>({id:m[1],href:m[2]}));
assert.equal(routes.length,18);
const digest=b=>createHash('sha256').update(b).digest('hex');
const files=['credits.html','sitemap.xml','i18n/tlab-i18n.js','games/jitem-derin-ag/SOURCE.json'];
for(const folder of ['racon','hanedanian','ihtilal','esik','jitem-derin-ag/assets']) {
 for(const name of await readdir('public/games/'+folder)) if(/\.(?:js|mjs|css|html)$/.test(name)) files.push('games/'+folder+'/'+name);
}
const hashes=[];
for(const file of files){
 const response=await fetch(origin+'/'+file);assert.equal(response.status,200,file);
 const served=Buffer.from(await response.arrayBuffer()),source=await readFile('public/'+file);
 assert.ok(served.equals(source),'exact source bytes: '+file);
 hashes.push({file,sha256:digest(served),bytes:served.length});
}
const sw=await fetch(origin+'/sw.js');assert.equal(sw.status,200);
const swBytes=Buffer.from(await sw.arrayBuffer());
assert.ok(swBytes.equals(await readFile('.output/public/sw.js')),'exact same-commit compiled service worker');
hashes.push({file:'sw.js',sha256:digest(swBytes),bytes:swBytes.length});
await writeFile(out+'/hashes.json',JSON.stringify(hashes,null,2));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const rows=[],failures=[];
try {
 for(const lang of ['tr','en','pl']) for(const width of [390,1280]) {
  for(const route of routes) {
   const context=await browser.newContext({viewport:{width,height:844}});
   const page=await context.newPage(),errors=[],failedAssets=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error' && m.location().url.startsWith(origin)) errors.push(m.text());});
   page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)failedAssets.push({url:r.url(),status:r.status()});});
   await context.addInitScript(language=>localStorage.setItem('tariklab.language',language),lang);
   try {
    const response=await page.goto(origin+route.href,{waitUntil:'networkidle'});assert.equal(response.status(),200);
    let surface=page.mainFrame();
    if(route.href.startsWith('/oyna/')){
     await page.locator('iframe').waitFor();surface=await (await page.locator('iframe').elementHandle()).contentFrame();
    }
    await surface.waitForFunction(()=>document.body.innerText.trim().length>20);
    const metrics=await surface.evaluate(()=>({text:document.body.innerText.trim().length,width:innerWidth,scroll:document.documentElement.scrollWidth,lang:document.documentElement.lang}));
    assert.ok(metrics.scroll<=metrics.width+1,route.id+' embedded overflow');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route.id+' portal overflow');
    assert.equal(await page.evaluate(()=>localStorage.getItem('tariklab.language')),lang);
    assert.deepEqual(errors,[],route.id+' console');assert.deepEqual(failedAssets,[],route.id+' assets');
    await page.screenshot({path:`${out}/${route.id}-${lang}-${width}.png`});
    rows.push({id:route.id,href:route.href,lang,width,metrics,status:'PASS'});
   } catch(error) {
    failures.push({id:route.id,lang,width,error:String(error),errors,failedAssets});
    await page.screenshot({path:`${out}/${route.id}-${lang}-${width}-FAIL.png`});
   } finally {await context.close();}
  }
 }
 assert.deepEqual(failures,[],'18 live routes in TR/EN/PL and 390/1280');
 assert.equal(rows.length,108);
 const archive=await archiveAcceptance(browser,origin,out+'/ihtilal');
 const coast=await coastArchiveAcceptance(browser,origin,out+'/coast');
 const receipt={origin,canonicalMain:process.env.RELEASE_MAIN,browser:browser.version(),hashes,rows,archive,coast,failures,status:'PASS'};
 await writeFile(out+'/receipt.json',JSON.stringify(receipt,null,2));
 console.log(JSON.stringify({origin,browser:browser.version(),routes:18,cases:108,hashes:hashes.length,archive:archive.length,coast:coast.length,status:'PASS'}));
} finally {
 await writeFile(out+'/route-results.json',JSON.stringify({rows,failures},null,2));
 await browser.close();
}
