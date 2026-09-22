import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
const root=resolve('public'),out='/workspace/screenshots/darbe-premium';await mkdir(out,{recursive:true});
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp'};
const server=createServer(async(req,res)=>{try{let path=decodeURIComponent(new URL(req.url,'http://local').pathname);if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))throw Error('path');const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(8086,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:8086/games/darbe-h/');await page.waitForLoadState('networkidle');

await page.screenshot({path:out+'/menu.png'});
const archive=page.getByRole('button',{name:/arşiv.*300|archive.*300/i});await archive.click();await page.waitForLoadState('networkidle');await page.screenshot({path:out+'/archive.png'});
await page.locator('.archive-grid .playing-card').first().click();await page.waitForTimeout(150);await page.screenshot({path:out+'/detail.png'});

await page.goto('http://127.0.0.1:8086/games/darbe-h/');await page.waitForLoadState('networkidle');
await page.getByRole('button',{name:'Yeni Düello',exact:true}).click();
await page.getByRole('button',{name:'İleri',exact:true}).click();
await page.getByRole('button',{name:'İleri',exact:true}).click();
await page.getByRole('button',{name:'Düelloyu Başlat',exact:true}).click();
for(let i=0;i<10;i++) {
 const rock=page.getByRole('button',{name:'Taş',exact:true});
 if(await rock.count()) {await rock.click();continue;}
 const first=page.getByRole('button',{name:/^İlk|^Önce/}).last();
 if(await first.count()) {await first.click();continue;}
 break;
}

await page.getByRole('button',{name:'Düelloyu Başlat',exact:true}).click();
await page.locator('.hand-row .playing-card').first().waitFor();
const skip=page.getByRole('button',{name:/^(Geç|Skip)$/}); if(await skip.count())await skip.first().click();
await page.waitForLoadState('networkidle');
await page.screenshot({path:out+'/hand-desktop.png',fullPage:true});
await page.setViewportSize({width:390,height:844});
await page.locator('.hand-row').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/hand-mobile.png'});
await page.goto('http://127.0.0.1:8086/games/darbe-h/');await page.getByRole('button',{name:/arşiv.*300|archive.*300/i}).click();
await page.waitForLoadState('networkidle');await page.screenshot({path:out+'/archive-mobile.png'});
await page.locator('.archive-grid .playing-card').first().click();await page.screenshot({path:out+'/detail-mobile.png'});
console.log('mobile overflow',await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
const candidates=Array.from({length:60},()=>[]);
for(let n=0;n<300;n++){const edition=Math.floor(n/60);candidates[(n+edition*17)%60].push(n+1);}
const sampleIds=candidates.map((ids,i)=>ids[i%5]);
const sample=await browser.newPage({viewport:{width:1500,height:1400}});
await sample.setContent('<style>body{margin:0;background:#0a100e;color:#e9dcc1;font:12px Georgia}h1{margin:20px}.grid{display:grid;grid-template-columns:repeat(10,1fr);gap:10px;padding:14px}figure{margin:0}img{width:100%;display:block}figcaption{padding:5px}</style><h1>DARBE-H! · 60 original scene compositions</h1><div class="grid">'+sampleIds.map((n)=>{const id='DRB-'+String(n).padStart(3,'0');return `<figure><img src="http://127.0.0.1:8086/games/darbe-h/assets/cards/${id}.svg"><figcaption>${id}</figcaption></figure>`;}).join('')+'</div>');await sample.waitForLoadState('networkidle');await sample.screenshot({path:out+'/contact-60.png',fullPage:true});
await writeFile(out+'/errors.json',JSON.stringify(errors));console.log(JSON.stringify({screenshots:out,errors,representativeCards:sampleIds.length}));
}finally{await browser.close();server.close();}
