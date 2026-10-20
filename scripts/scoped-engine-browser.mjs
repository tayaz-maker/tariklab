import assert from 'node:assert/strict';
export async function verifyScopedEngineLoads(browser,base){
 // The current Son 100 Gun POV page has its own engine and never loads next-wave.
 const owners={'apartman':'apartman-','kayip-telefon':'kayip-','son-100-gun':null,'tc-sim-devlet':'devlet-','son-kasaba':null};
 const results=[];
 for(const [game,owner] of Object.entries(owners)){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  try{
   const page=await context.newPage(),loaded=[],errors=[];
   page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/games/next-wave/'))loaded.push(new URL(r.url()).pathname);});
   page.on('pageerror',e=>errors.push(e.message));
   assert.equal((await page.goto(`${base}/games/${game}/index.html`,{waitUntil:'networkidle'})).status(),200);
   assert.deepEqual(errors,[],game);
   const engines=loaded.filter(path=>!/\/shared\//.test(path));
   assert.ok(owner?engines.some(path=>path.includes('/'+owner)):engines.length===0,`${game}: own engine only`);
   assert.ok(engines.every(path=>owner&&path.includes('/'+owner)),`${game}: unrelated engine download ${engines.join(',')}`);
   results.push({game,engineRequests:engines.length});
  }finally{await context.close();}
 }
 console.log('SCOPED_ENGINE_LOADS_PASS',JSON.stringify(results));
 return results;
}
