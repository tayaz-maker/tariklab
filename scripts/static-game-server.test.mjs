import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStaticGameServer} from './static-game-server.mjs';

test('missing baseline asset returns 404 and later requests still serve exact bytes',async t=>{
 const root=await mkdtemp(join(tmpdir(),'wave1-server-'));
 await writeFile(join(root,'index.html'),'<main>Ready</main>');
 await writeFile(join(root,'module.js'),'export const ready=true;');
 const server=createStaticGameServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(base+'/missing.svg')).status,404);
 assert.equal((await fetch(base+'/another-missing.js')).status,404);
 const page=await fetch(base+'/');assert.equal(page.status,200);assert.equal(await page.text(),'<main>Ready</main>');
 const module=await fetch(base+'/module.js');assert.equal(module.status,200);assert.equal(module.headers.get('content-type'),'text/javascript');assert.equal(await module.text(),'export const ready=true;');
 assert.equal((await fetch(base+'/%E0%A4%A')).status,400,'malformed encoding stays bounded');
 assert.equal((await fetch(base+'/%2e%2e%2foutside')).status,403,'encoded traversal cannot leave the fixture');
 assert.equal((await fetch(base+'/module.js')).status,200,'rejected paths do not stop the server');
});

test('pinned baseline archive contains entry assets and actual service-worker registrations',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
 const paths=workflow.match(/git archive [a-f0-9]{40} (.+) \| tar/)[1].split(' ');
 for(const game of ['hanedanian','ihtilal','racon']){
  const entry=`/games/${game}/index.html`,html=await readFile(new URL('../public'+entry,import.meta.url),'utf8');
  for(const [,asset] of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/g)){
   const path='public'+new URL(asset,'http://localhost'+entry).pathname;
   assert.ok(paths.some(prefix=>path===prefix||path.startsWith(prefix+'/')),`${entry} needs ${path} in baseline archive`);
  }
  let scripts=html;
  for(const [,asset] of html.matchAll(/<script\b[^>]*?\bsrc=["']([^"']+)["']/g)){
   scripts+='\n'+await readFile(new URL('../public'+new URL(asset,'http://localhost'+entry).pathname,import.meta.url),'utf8');
  }
  for(const [,asset] of scripts.matchAll(/navigator\.serviceWorker\.register\(["']([^"']+)["']/g)){
   const path='public'+new URL(asset,'http://localhost'+entry).pathname;
   assert.ok(paths.some(prefix=>path===prefix||path.startsWith(prefix+'/')),`${entry} registers ${path}; baseline must serve the real worker`);
  }
 }
});
