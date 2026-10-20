// Missing archive release gates only; reuse the existing per-game save acceptance.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {archiveAcceptance} from './ihtilal-archive-browser.mjs';
import {coastArchiveAcceptance} from './esik-archive-browser.mjs';
import {bukucuArchiveAcceptance} from './bukucu-archive-browser.mjs';
import {requireRelease} from './cloudflare-deploy.mjs';
const sha=process.env.ARCHIVE_RELEASE_SHA;
assert.match(sha||'',/^[a-f0-9]{40}$/,'exact current main ARCHIVE_RELEASE_SHA required');
assert.equal(execFileSync('git',['merge-base',sha,'HEAD'],{encoding:'utf8'}).trim(),sha,'source checkout must include the exact accepted main');
const out=resolve(process.env.ARCHIVE_PRODUCTION_OUT||'work/archive-production-v2');await mkdir(out,{recursive:true});
const readGithub=async path=>{const r=await fetch('https://api.github.com/repos/tayaz-maker/tariklab/'+path,{headers:{'User-Agent':'TarikLab-archive-release'}});assert.equal(r.status,200,path);return r.json();};
const main=await readGithub('branches/main'),runs=await readGithub(`actions/runs?head_sha=${sha}&event=push&per_page=100`);
requireRelease({sha,main:main.commit.sha,runs:runs.workflow_runs});
const checks=await readGithub(`commits/${sha}/check-runs`);
const worker=checks.check_runs.filter(c=>c.name==='Workers Builds: tariklab').sort((a,b)=>b.id-a.id)[0];
assert.ok(worker,'exact-main Workers publication check required');
assert.equal(worker.status,'completed','Workers publication still pending');
assert.equal(worker.conclusion,'success','Workers publication must pass');
const manifest=JSON.parse(await readFile('archives/MANIFEST.json','utf8'));
const paths=[...new Set(manifest.files.map(x=>x.path).filter(x=>x.startsWith('public/')).concat(['public/credits.html','public/i18n/tlab-i18n.js','public/sitemap.xml']))];
const expected=[];for(const file of paths)expected.push({path:'/'+file.slice(7),sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
const report={sha,scope:'Supplemental archive gates; existing esik-save production suite and local77-file archive extraction are not repeated',manifestSource:manifest.sourceMain,worker:{id:worker.id,name:worker.name,conclusion:worker.conclusion,url:worker.html_url},ciRuns:runs.workflow_runs.filter(r=>r.head_sha===sha&&['.github/workflows/ci.yml','.github/workflows/tc-job-start-outcome.yml'].includes(r.path)).map(r=>({id:r.id,path:r.path,conclusion:r.conclusion})),hosts:[]};
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox']});
try{
 for(const[host,origin]of[['www','https://www.tariklab.com'],['workers','https://tariklab.tayaz29.workers.dev']]){
  const dir=resolve(out,host);await mkdir(dir,{recursive:true});const entry={host,origin,status:'running'};report.hosts.push(entry);
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  try{
   await page.goto(origin+'/',{waitUntil:'networkidle'});
   const hashes=await page.evaluate(async expected=>{
    const rows=[];for(const item of expected){const response=await fetch(item.path,{cache:'no-store'});const bytes=await response.arrayBuffer();const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');rows.push({...item,status:response.status,actualSha256:digest,bytes:bytes.byteLength});}return rows;
   },expected);
   for(const row of hashes){assert.equal(row.status,200,row.path);assert.equal(row.actualSha256,row.sha256,row.path+' exact current-main source');}
   entry.hashes=hashes;
   entry.package=await page.evaluate(async path=>{const r=await fetch('/'+path,{cache:'no-store'});return{path,status:r.status};},manifest.path);
   assert.equal(entry.package.status,404,'private lossless source archive must not be published');
   const sitemap=await page.evaluate(async()=>await(await fetch('/sitemap.xml',{cache:'no-store'})).text());
   for(const slug of ['ihtilal','esik','bukucu'])assert.doesNotMatch(sitemap,new RegExp('/oyna/'+slug+'(?:<|/)'),'retired route absent from active sitemap');
   entry.sitemap=true;
  }finally{await context.close();}
  entry.ihtilal=await archiveAcceptance(browser,origin,resolve(dir,'ihtilal'));
  entry.coast=await coastArchiveAcceptance(browser,origin,resolve(dir,'coast'));
  entry.bukucu=await bukucuArchiveAcceptance(browser,origin,resolve(dir,'bukucu'));
  assert.equal(entry.ihtilal.length+entry.coast.length+entry.bukucu.length,18);
  entry.status='PASS';console.log(JSON.stringify({host,status:entry.status,hashes:entry.hashes.length,cases:18,privateArchive:entry.package.status}));
 }
 assert.equal((await readGithub('branches/main')).commit.sha,sha,'main moved during archive release acceptance');
 report.status='PASS';
}finally{await writeFile(resolve(out,'receipt.json'),JSON.stringify(report,null,2));await browser.close();}
