import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYABLE_REGIONS, DISTRICTS, districtProfile, locationCommute, locationJobDelay, locationRiskProfile, regionAffordability, socialTravel } from '../public/games/tc-sim/js/locations.js';
import { QUARTERS, UNIT_IDS, listing, quarterMoveQuote, buyHolding, rentToLive, normalizeSemt, letHolding, processSemtWeek, openShop, tendShop, regionalShopTerms, shopVisitQuote, shopWeekNet, semtRoll, SHOP_SALT, renderSemtEmlak } from '../public/games/tc-sim/js/quarters.js';
import { createNewGame, validateState } from '../public/games/tc-sim/js/state.js';
import { getJobById } from '../public/games/tc-sim/js/catalog.js';
import { getMonthlySummary, locationMoveAvailability } from '../public/games/tc-sim/js/life.js';
import { approximateNominal } from '../public/games/tc-sim/js/period-economy.js';
import { processMarchRent } from '../public/games/tc-sim/js/march-hatir.js';
import { saveGame, loadGame } from '../public/games/tc-sim/js/save.js';
const fresh=()=>{const s=createNewGame({seed:41,eraId:'2017-04-18',name:'Bölge QA'});s.events.active=null;s.events.queue=[];s.finances.balance=3e6;s.career.jobId=null;return s;};
const next=s=>{s.time.absoluteWeek++;s.weekly={used:0,selectedIds:[]};s.events.active=null;s.events.queue=[];};
const roundtrip=s=>{const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};assert.ok(saveGame(storage,s).ok);const result=loadGame(storage);assert.ok(result.ok);return result.state;};
const names={istanbul:['Şişli–Mecidiyeköy','Fatih','Beşiktaş','Beyoğlu','Kadıköy','Üsküdar','Ümraniye','Bebek'],ankara:['Yenimahalle','Etimesgut','Kızılay','Bahçelievler','Ulus','Keçiören','Çankaya','Mamak'],izmir:['Karşıyaka','Bornova','Alsancak','Konak','Buca','Göztepe','Balçova']};
test('23 exact playable labels coexist with all nine legacy district IDs and three fictional quarters',()=>{
 assert.equal(PLAYABLE_REGIONS.length,23);assert.equal(new Set(PLAYABLE_REGIONS.map(d=>d.id)).size,23);
 for(const [city,expected] of Object.entries(names))assert.deepEqual(PLAYABLE_REGIONS.filter(d=>d.city===city).map(d=>d.name),expected);
 for(const id of ['sisli','kadikoy','uskudar','bayrampasa','avcilar','cankaya','batikent','konak','bornova'])assert.ok(DISTRICTS.some(d=>d.id===id));
 for(const id of ['sirt','kiyi','ceper'])assert.ok(QUARTERS[id]);
});
for(const d of PLAYABLE_REGIONS){
 test(`${d.name}: move, rent, home quality, visits, career, customer access and save are real`,()=>{
  const s=fresh(),offer=listing(d.id,'2+1',s),quote=quarterMoveQuote(s,d.id,'2+1'),cash=s.finances.balance;
  assert.ok(rentToLive(s,d.id,'2+1').ok);assert.equal(s.finances.balance,cash-quote.cost);assert.equal(s.weekly.used,d.city==='istanbul'?2:3);
  assert.equal(s.household.location.districtId,d.id);assert.equal(getMonthlySummary(s).housing,offer.rent);
  const after=structuredClone(s);assert.equal(rentToLive(s,d.id,'2+1').ok,false);assert.deepEqual(s,after);
  assert.ok(socialTravel(s,'anne').cost>0);assert.equal(socialTravel(s,'anne').slots,d.city==='istanbul'?0:1);
  const p=districtProfile(s);assert.ok(p.living>0 && p.social>0);assert.ok([1,2].includes(locationRiskProfile(s).heatGain));
  s.career.jobId='office';assert.ok(locationCommute(s)>=0 && locationCommute(s)<=3);assert.equal(locationJobDelay(s,getJobById('office')),d.sectors.includes('ofis')?0:1);
  assert.ok(listing(d.id,'3+1',s).buy>listing(d.id,'1+1',s).buy);assert.ok(listing(d.id,'3+1',s).rent>listing(d.id,'1+1',s).rent);
  const loaded=roundtrip(s);assert.deepEqual(loaded.household.semt,s.household.semt);assert.equal(loaded.household.location.districtId,d.id);assert.ok(validateState(loaded).ok);
  next(s);s.career.jobId=null;const shopId=d.shops[0],terms=regionalShopTerms(s,d.id,shopId),before=s.finances.balance;
  assert.ok(openShop(s,d.id,shopId).ok);assert.equal(s.finances.balance,before-terms.startup);
  next(s);assert.ok(tendShop(s,`${d.id}:${shopId}`).ok);const weekCash=s.finances.balance,net=shopWeekNet(terms,{tended:true,roll:semtRoll(s,SHOP_SALT)}).net;
  processSemtWeek(s);assert.equal(s.finances.balance-weekCash,net);const settled=s.finances.balance;processSemtWeek(s);assert.equal(s.finances.balance,settled);
 });
}
test('regions have multiple independent advantages; Bebek price does not imply highest customers, Ümraniye balances sectors',()=>{
 const s=fresh(),profiles=PLAYABLE_REGIONS.map(d=>districtProfile(s,d.id));
 assert.equal(new Set(profiles.map(p=>[p.rent,p.living,p.travel,p.education,p.social,p.purchase,p.customers,p.visibility,p.sectors.join(',')].join('|'))).size,23);
 assert.ok(districtProfile(s,'bebek').purchase>districtProfile(s,'umraniye').purchase);
 assert.ok(districtProfile(s,'bebek').customers<districtProfile(s,'beyoglu').customers);
 assert.ok(districtProfile(s,'umraniye').sectors.includes('ofis'));assert.ok(districtProfile(s,'umraniye').sectors.includes('uretim'));
 assert.ok(districtProfile(s,'buca').rent<districtProfile(s,'goztepe').rent);assert.ok(districtProfile(s,'buca').travel>districtProfile(s,'goztepe').travel);
 s.time.date='2017-12-14';assert.equal(districtProfile(s,'umraniye').rail,false);s.time.date='2017-12-15';assert.equal(districtProfile(s,'umraniye').rail,true);
});
test('period pricing uses existing wage/CPI display; income affects affordability, never prices or saved principal',()=>{
 const s=fresh();const dates=['1985-01-01','1999-01-01','2017-01-01','2025-01-01'];
 const prices=dates.map(date=>{s.time.date=date;const q=listing('bebek','2+1',s);return approximateNominal(q.buy,+date.slice(0,4),date);});assert.equal(new Set(prices).size,4);
 s.time.date='2017-04-18';const quote=listing('bebek','2+1',s);assert.ok(buyHolding(s,'bebek','2+1').ok);const holding=structuredClone(s.household.semt.holdings[0]);
 s.time.date='2025-01-01';normalizeSemt(s);assert.deepEqual(s.household.semt.holdings[0],holding);
 s.career.jobId='market';const low=regionAffordability(s,quote.rent,quote.buy);s.career.jobId='office';const high=regionAffordability(s,quote.rent,quote.buy);assert.notEqual(low.rentShare,high.rentShare);
 const fixed=listing('bebek','2+1',s);s.career.jobId=null;assert.deepEqual(listing('bebek','2+1',s),fixed);assert.equal(regionAffordability(s,quote.rent,quote.buy).rentShare,null);
});
test('regional property ownership, rental revenue and March increase preserve finite integer balances',()=>{
 for(const d of PLAYABLE_REGIONS){const s=fresh();assert.ok(buyHolding(s,d.id,'1+1').ok);assert.ok(letHolding(s,`${d.id}:1+1`).ok);next(s);processSemtWeek(s);assert.ok(s.finances.ledger.every(r=>Number.isInteger(r.amount)));
 const rented=fresh();assert.ok(rentToLive(rented,d.id,'1+1').ok);rented.time.year=2018;rented.time.month=3;rented.time.weekOfMonth=1;const before=rented.household.semt.holdings[0].monthly;processMarchRent(rented);assert.ok(rented.household.semt.holdings[0].monthly>before);assert.ok(Number.isInteger(rented.household.semt.holdings[0].monthly));}
});
test('intercity work, education, pending job, owner occupation and insufficient cash cannot bypass move guards',()=>{
 for(const setup of [s=>s.career.jobId='office',s=>s.education.active={pathId:'vocational_course'},s=>s.career.pendingJob={jobId:'office'},s=>s.wealth.properties=[{occupancy:'owner'}],s=>s.finances.balance=0]){
  const s=fresh();setup(s);normalizeSemt(s);const before=structuredClone(s);assert.equal(rentToLive(s,'ulus','1+1').ok,false);assert.deepEqual(s,before);assert.equal(locationMoveAvailability(s,'ulus','shared').ok,false);
 }
});
test('remote regional shop visits cost travel and decisions once; legacy shops keep existing economics',()=>{
 const s=fresh();assert.ok(openShop(s,'buca','kirtasiye').ok);next(s);const shop=s.household.semt.shops[0],q=shopVisitQuote(s,shop),before=s.finances.balance;
 assert.deepEqual(q,{cost:1200,slots:2});assert.ok(tendShop(s,'buca:kirtasiye').ok);assert.equal(s.finances.balance,before-q.cost);assert.equal(s.weekly.used,q.slots);
 assert.equal(tendShop(s,'buca:kirtasiye').ok,false);assert.equal(s.finances.balance,before-q.cost);
 assert.deepEqual(shopVisitQuote(s,{quarterId:'ceper'}),{cost:0,slots:1});
});
test('selected region offers render with exact quote and collapsed legacy content',()=>{
 const s=fresh();const html=renderSemtEmlak(s,{money:String,escapeText:String,regionId:'umraniye'});
 assert.ok(html.includes('Ümraniye · oynanabilir bölge'));assert.ok(html.includes('data-semt-value="umraniye:1+1"'));
 for(const id of ['sirt','kiyi','ceper'])assert.ok(html.includes(`data-semt-value="${id}:1+1"`));
 assert.ok(html.includes(String(quarterMoveQuote(s,'umraniye','1+1').cost)));
});

test('map image anchors contain all 23 regions once, preserve coasts and use optimized lazy-loaded files',async()=>{
 const {REGION_MAPS}=await import('../public/games/tc-sim/js/region-map-data.js');
 const {renderRegionMap}=await import('../public/games/tc-sim/js/region-map.js');
 const {readFileSync}=await import('node:fs');
 for(const [city,map] of Object.entries(REGION_MAPS)){
  const regions=PLAYABLE_REGIONS.filter(d=>d.city===city);assert.deepEqual(Object.keys(map.positions),regions.map(d=>d.id));
  assert.equal(map.width/map.height,1.5);for(const point of Object.values(map.positions))assert.ok(point.every(v=>v>5&&v<95));
  const file=readFileSync(new URL(`../public/games/tc-sim/assets/map/${map.file}`,import.meta.url));assert.ok(file.length<750000);assert.equal(file.toString('utf8',8,12),'WEBP');
  const html=renderRegionMap(fresh(),regions[0],{escapeText:String});assert.equal((html.match(/<img /g)||[]).length,1);assert.ok(html.includes('loading="lazy"'));assert.equal((html.match(/class="region-map-label"/g)||[]).length,regions.length);
  for(const d of regions)assert.equal((html.match(new RegExp(`<span>${d.name}</span>`,'g'))||[]).length,1);
 }
 const i=REGION_MAPS.istanbul.positions;assert.ok(i.umraniye[0]>i.uskudar[0]);assert.ok(i.bebek[1]<i.besiktas[1]);assert.ok(i.bebek[0]<i.uskudar[0]);
 const a=REGION_MAPS.ankara.positions;assert.ok(a.ulus[1]<a.kizilay[1]);assert.ok(a.etimesgut[0]<a.kizilay[0]);assert.ok(a.mamak[0]>a.kizilay[0]);
 const z=REGION_MAPS.izmir.positions;assert.ok(z.karsiyaka[1]<z.konak[1]);assert.ok(z.buca[0]>z.konak[0]);assert.ok(z.goztepe[0]<z.konak[0]);assert.ok(z.balcova[0]<z.goztepe[0]);
});

test('legacy locations retain the current-home marker without rewriting their saved district',async()=>{
 const {renderRegionMap}=await import('../public/games/tc-sim/js/region-map.js');
 for(const id of ['avcilar','bayrampasa','batikent']){
  const s=fresh();s.household.location={...s.household.location,districtId:id};
  const before=JSON.stringify(s),d=DISTRICTS.find(region=>region.id===id);
  const html=renderRegionMap(s,d,{escapeText:String});
  assert.ok(html.includes(`${d.name} <small>EVİN</small></button>`));
  assert.equal((html.match(/<small>EVİN<\/small>/g)||[]).length,1);
  assert.equal(JSON.stringify(s),before);
 }
});
