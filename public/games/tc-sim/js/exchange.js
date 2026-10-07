import { MARKET_HISTORY } from '../data/market-history.js?v=10';
import { approximateNominal, economyYear } from './period-economy.js?v=10';

export const EXCHANGE_ASSETS = Object.freeze({
 USD:{label:'ABD doları',step:10}, EUR:{label:'Euro',step:10,since:'2002-01-01'},
 DEM:{label:'Alman markı',step:10,until:'2002-01-01'}, GBP:{label:'İngiliz sterlini',step:10},
 CHF:{label:'İsviçre frangı',step:10}, JPY:{label:'Japon yeni',step:1000},
 CAD:{label:'Kanada doları',step:10}, AUD:{label:'Avustralya doları',step:10}, SEK:{label:'İsveç kronu',step:100},
 gram:{label:'Gram altın · saf altın karşılığı',step:1,gold:1},
 quarter:{label:'Çeyrek ziynet altını',step:1,gold:1.754*.9166},
 half:{label:'Yarım ziynet altını',step:1,gold:3.508*.9166},
 full:{label:'Tam ziynet altını',step:1,gold:7.016*.9166},
});
const valid = n => Number.isFinite(n) && n >= 0 && n <= 1e15;
export function normalizeExchange(raw) {
 const positions={};
 for(const [id,p] of Object.entries(raw?.positions || {})) if(EXCHANGE_ASSETS[id] && valid(p?.quantity) && valid(p?.basis)) positions[id]={quantity:p.quantity,basis:p.basis};
 return {positions,history:Array.isArray(raw?.history)?raw.history.filter(x=>EXCHANGE_ASSETS[x?.id] && valid(x.quantity) && Number.isFinite(x.cash)).slice(-80):[]};
}
export function cashUnit(state) {
 const year=economyYear(state);
 return approximateNominal(1,year,state.time.date)/(year<2005?1e6:1);
}
export function exchangeQuote(state,id) {
 const asset=EXCHANGE_ASSETS[id], date=state.time.date;
 if(!asset)return null;
 const observed=MARKET_HISTORY.fx.findLast(row=>row.date<=date);
 if(!observed)return null;
 const future=date>MARKET_HISTORY.fx.at(-1).date;
 // Last observed quote is carried forward, never interpolated using future data.
 // Beyond the data horizon a bounded, deterministic scenario varies it; not a forecast.
 const months=future?Math.max(0,(Number(date.slice(0,4))-2026)*12+Number(date.slice(5,7))-10):0;
 const scenario=future?Math.exp(.10*Math.sin(months*.71)+.025*months):1;
 let reference,buy,sell,goldMonth=null;
 if(asset.gold){
  goldMonth=Object.keys(MARKET_HISTORY.goldUsdPerTroyOunceMonthly).filter(m=>m<date.slice(0,7)).at(-1);
  if(!goldMonth)return null;
  const usd=observed.rates.USD;
  reference=MARKET_HISTORY.goldUsdPerTroyOunceMonthly[goldMonth]/31.1034768*((usd.buy+usd.sell)/2)*asset.gold*scenario;
  buy=reference*.97; sell=reference*(id==='gram'?1.03:1.06);
 }else{
  const row=id==='DEM' && date>='2002-01-01' ? Object.fromEntries(Object.entries(observed.rates.EUR||{}).map(([key,v])=>[key,v/1.95583])) : observed.rates[id];if(!row)return null;
  reference=(row.buy+row.sell)/2*scenario;
  const spread=['USD','EUR','DEM'].includes(id)?.008:.02;
  buy=(row.cashBuy||row.buy)*(1-spread)*scenario;
  sell=(row.cashSell||row.sell)*(1+spread)*scenario;
 }
 const available=(!asset.since||date>=asset.since)&&(!asset.until||date<asset.until);
 const unit=cashUnit(state),fee=.002;
 return {id,date,sourceDate:observed.date,source:observed.url,goldMonth,future,available,reference,bid:buy/unit,ask:sell/unit,fee,unit,
  reason:available?'':id==='EUR'?'Euro nakit dolaşımı 1 Ocak 2002’de başlar.':'Bu para biriminde yeni nakit alımı kapalı.'};
}
export function exchangePortfolio(state) {
 const w=normalizeExchange(state.wealth?.exchange);
 return Object.entries(w.positions).map(([id,p])=>{const q=exchangeQuote(state,id);const value=q?Math.floor(p.quantity*q.bid*(1-q.fee)):0;return {id,...p,value,profit:value-p.basis,quote:q};});
}
export function exchangeAvailability(state,id,side,quantity) {
 const q=exchangeQuote(state,id);
 if(!q||!['buy','sell'].includes(side)||!Number.isSafeInteger(quantity)||quantity<=0||quantity>1e9)return {ok:false,reason:'Geçerli miktar veya doğrulanmış fiyat yok.'};
 if(state.lifetime?.death||state.events?.active)return {ok:false,reason:'Önce açık olayı bitir; tamamlanmış yaşam işlem yapamaz.'};
 if(side==='buy'&&!q.available)return {ok:false,reason:q.reason};
 const p=state.wealth?.exchange?.positions?.[id];
 const cash=side==='buy'?Math.ceil(quantity*q.ask*(1+q.fee)):Math.floor(quantity*q.bid*(1-q.fee));
 if(!Number.isSafeInteger(cash)||cash<=0)return {ok:false,reason:'İşlem tutarı sınır dışında.'};
 if(side==='buy'&&state.finances.balance<cash)return {ok:false,reason:'Alış ve işlem maliyeti için bakiye yetersiz.'};
 if(side==='sell'&&(!p||p.quantity<quantity))return {ok:false,reason:'Satılabilir miktar yetersiz.'};
 return {ok:true,cash,quote:q};
}
export function tradeExchange(state,id,side,quantity) {
 const check=exchangeAvailability(state,id,side,quantity);if(!check.ok)return check;
 const w=state.wealth.exchange=normalizeExchange(state.wealth.exchange);
 const p=w.positions[id]||{quantity:0,basis:0};
 const basis=side==='sell'?p.basis*quantity/p.quantity:check.cash;
 const delta=side==='buy'?-check.cash:check.cash;
 // One synchronous mutation, with authoritative re-quotation and integer cash rounding.
 state.finances.balance+=delta;
 p.quantity+=side==='buy'?quantity:-quantity;
 p.basis=side==='buy'?p.basis+check.cash:Math.max(0,p.basis-basis);
 if(p.quantity)w.positions[id]=p;else delete w.positions[id];
 const row={date:state.time.date,id,side,quantity,cash:delta,basis,realized:side==='sell'?check.cash-basis:0,sourceDate:check.quote.sourceDate};
 w.history.push(row);w.history=w.history.slice(-80);
 state.finances.ledger.push({week:state.time.absoluteWeek,amount:delta,reason:`${EXCHANGE_ASSETS[id].label} · ${quantity} ${side==='buy'?'alış':'satış'} (makas ve ücret dahil)`,category:'exchange'});
 state.finances.ledger=state.finances.ledger.slice(-120);
 return {ok:true,message:'İşlem tamamlandı; portföy ve nakit güncellendi.',...row};
}
