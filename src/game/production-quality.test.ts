import assert from 'node:assert/strict';
import test from 'node:test';
import { hydratePlayer, makeRivals, MARKET_START, turfHourlyOf, turfHaraçHourly, SAVE_VERSION } from './data.ts';
import { applyTick, applyTicks } from './clock.ts';
import { rivalPressure, turfDefense } from './formulas.ts';
const storage = new Map<string, string>();
Object.assign(globalThis, { window: { localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string,v: string) => storage.set(k,v), removeItem: (k: string) => storage.delete(k) }, location: { search: '' }, addEventListener() {} }, document: { addEventListener() {} } });
const { useGame } = await import('./store.ts');
const state = () => useGame.getState();
const player = (over = {}) => hydratePlayer({ name: 'Quality', neighborhood: 'eyup', level: 20, cash: 100000, stamina: 100, health: 100, jobsDone: 5, itibar: 30, eventCooldown: 9999, ...over });
function fresh(over = {}) { state().loadSlot(1); useGame.setState({ player: player(over), rivals: makeRivals(), logs: [], market: {...MARKET_START} }); }
function rng(value: number, fn: () => void) { const old = Math.random; Math.random = () => value; try { fn(); } finally { Math.random = old; } }
test('empty rival cannot mint money; invalid or hospitalized bounty target cannot charge or pay', () => {
 fresh(); const r = {...state().rivals[0], cash: 0, attack: 0}; useGame.setState({rivals:[r]});
 const cash = state().player!.cash;
 rng(0.5, () => state().attackRival(r.id));
 assert.equal(state().player!.cash, cash); assert.equal(state().rivals[0].cash, 0);
 useGame.setState({rivals:[{...r,health:0,hospitalTicks:12,bounty:5000}]});
 const before = state().player;
 state().huntBounty(r.id); state().putBounty('missing',500); state().putBounty(r.id,500);
 assert.equal(state().player,before);
});
test('legitimate bounty requires a fresh knockout and pays once', () => {
 fresh(); const r = {...state().rivals[0],cash:0,attack:0,health:1,bounty:5000}; useGame.setState({rivals:[r]});
 const cash = state().player!.cash;
 rng(0.5, () => state().huntBounty(r.id));
 assert.equal(state().player!.cash,cash+5000); state().huntBounty(r.id); assert.equal(state().player!.cash,cash+5000);
});
test('fractional trading cannot create free holdings or profit by splitting sales; NaN rejects atomically', () => {
 fresh(); const cash = state().player!.cash;
 state().tradeInvest('usd','al',NaN); assert.equal(state().player!.cash,cash);
 for(let i=0;i<100;i++) { state().tradeInvest('usd','al',.01); state().tradeInvest('usd','sat',.01); }
 assert.ok(state().player!.cash <= cash); assert.ok(Math.abs(state().player!.usd) < .000001);
 assert.ok(Number.isFinite(state().player!.cash));
});
test('near-cap recapture cannot repeatedly mint milestone cash; invalid district is atomic', () => {
 fresh({turf:{eyup:99.9,tarlabasi:0,kadikoy:0,sultangazi:0}}); const cash = state().player!.cash;
 rng(0.5, () => state().pressTurf('eyup'));
 assert.ok(state().player!.cash-cash < 100);
 const before = state().player; state().pressTurf('missing' as never); assert.equal(state().player,before);
 state().pressTurf('eyup'); assert.equal(state().player,before);
});
test('displayed district income reflects police cuts', () => {
 const p=player({isi:80,turf:{eyup:75,tarlabasi:0,kadikoy:0,sultangazi:0}});
 assert.equal(turfHourlyOf(p,'eyup'),turfHaraçHourly(p));
 assert.ok(turfHourlyOf(p,'eyup') < turfHourlyOf({...p,isi:0},'eyup'));
});
test('away control decays and police pressure cools instead of getting stuck forever', () => rng(.99,()=>{
 const s={player:player({isi:60,turf:{eyup:0,tarlabasi:50,kadikoy:0,sultangazi:0}}),rivals:[],logs:[],market:MARKET_START};
 const next=applyTick(s); assert.equal(next.player.turf.tarlabasi,49.95); assert.equal(next.player.isi,59.5);
}));
test('defence versus expansion: available specialists reduce local pressure; assignments and revenge increase it',()=>{
 const p=player({crew:['gozcu','tetik'],turf:{eyup:80,tarlabasi:50,kadikoy:0,sultangazi:0}}); const r={...makeRivals()[0],hood:'eyup' as const};
 const busy={...p,crewBusy:{gozcu:4,tetik:4}};
 assert.ok(turfDefense(p)>turfDefense(busy)); assert.ok(rivalPressure(p,r)<rivalPressure(busy,r));
 assert.ok(rivalPressure(p,{...r,revengeTicks:5})>rivalPressure(p,r));
 assert.equal(rivalPressure(p,{...r,hospitalTicks:5}),0);
});
test('50 seeded two-day strategies stay finite; defence preserves more territory under identical pressure',()=>{
 let defendedTotal=0, exposedTotal=0;
 for(let seed=1;seed<=50;seed++) for(const defended of [false,true]) {
  let x=seed; const old=Math.random; Math.random=()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296);
  try {
   let s={player:player({crew:defended?['gozcu','tetik']:[],turf:{eyup:75,tarlabasi:75,kadikoy:75,sultangazi:75}}),rivals:makeRivals(),logs:[] as import('./types.ts').LogEntry[],market:{...MARKET_START}};
   for(let i=0;i<6;i++) s=applyTicks(s,48);
   for(const n of Object.values(s.player.turf)) assert.ok(n>=0&&n<=100);
   assert.ok(Number.isFinite(s.player.cash)&&s.player.cash>=0);
   const control=s.player.turf.tarlabasi+s.player.turf.kadikoy+s.player.turf.sultangazi;
   if(defended) defendedTotal+=control; else exposedTotal+=control;
  }finally{Math.random=old;}
 }
 assert.ok(defendedTotal>exposedTotal,`${defendedTotal} > ${exposedTotal}`);
});
test('existing schema and slot reload retain new action results without migration',()=>{
 fresh(); rng(.5,()=>state().sitEsnafBar('eyup')); const p=state().player!; state().saveToSlot(1); state().loadSlot(1);
 assert.equal(state().player!.cash,p.cash); assert.equal(state().player!.turf.eyup,p.turf.eyup); assert.equal(state().version,SAVE_VERSION); assert.equal(SAVE_VERSION,15);
});

test('another crew collecting a bounty does not reward the idle player',()=>rng(0,()=>{
 const p=player({cash:0,isi:0,itibar:30,crew:[],turf:{eyup:0,tarlabasi:0,kadikoy:0,sultangazi:0}});
 const r={...makeRivals()[0],health:1,bounty:18000,revengeTicks:0};
 const next=applyTick({player:p,rivals:[r],logs:[],market:MARKET_START});
 assert.equal(next.player.cash,0);assert.equal(next.player.itibar,30);assert.equal(next.rivals[0].bounty,0);
 assert.ok(next.logs.some(l=>l.text.includes('Ödül o ekibe')));
}));
