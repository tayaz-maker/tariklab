import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {coastArchiveAcceptance} from './esik-archive-browser.mjs';
import {archiveAcceptance} from './ihtilal-archive-browser.mjs';
const origin=process.env.ARCHIVE_BASE;
assert.ok(['https://www.tariklab.com','https://tariklab.tayaz29.workers.dev'].includes(origin));
const out=`${process.env.RUNNER_TEMP||'/workspace'}/screenshots/kiyi-production`;
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('docs/esik/ARCHIVE_MANIFEST_2026-10-20.json','utf8'));
const files=[...manifest.retainedFiles.map(f=>f.path).filter(p=>p.startsWith('public/')),'public/credits.html','public/i18n/tlab-i18n.js','public/sw.js','public/games/jitem-derin-ag/SOURCE.json','public/games/jitem-derin-ag/assets/runtime.js'];
const hashes=[];
for(const file of files){
 const response=await fetch(origin+'/'+file.slice(7));assert.equal(response.status,200,file);
 const served=Buffer.from(await response.arrayBuffer()),source=await readFile(file);
 assert.ok(served.equals(source),'deployed bytes: '+file);
 hashes.push({file,bytes:served.length,sha256:createHash('sha256').update(served).digest('hex')});
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const coast=await coastArchiveAcceptance(browser,origin,out+'/coast');
 const ihtilal=await archiveAcceptance(browser,origin,out+'/ihtilal');
 const context=await browser.newContext();
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await fetch(origin+'/sitemap.xml');assert.equal(response.status,200);
  const sitemap=await response.text();assert.match(sitemap,/<urlset/);
  assert.doesNotMatch(sitemap,/\/oyna\/(?:esik|ihtilal)(?:\/|<|\s|$)/);
  await page.goto(origin+'/oyna/jitem-derin-ag',{waitUntil:'networkidle'});
  await page.locator('iframe').waitFor();assert.ok((await page.frameLocator('iframe').locator('body').innerText()).trim().length>30);assert.deepEqual(errors,[]);
 }finally{await context.close();}
 await writeFile(out+'/receipt.json',JSON.stringify({origin,canonicalMain:process.env.RELEASE_MAIN,archiveRef:manifest.archiveRef,hashes,coast,ihtilal,jitem:'PASS',sitemap:'PASS'},null,2));
 console.log(JSON.stringify({origin,hashes:hashes.length,coast:coast.length,ihtilal:ihtilal.length,jitem:'PASS',sitemap:'PASS',status:'PASS'}));
}finally{await browser.close();}
