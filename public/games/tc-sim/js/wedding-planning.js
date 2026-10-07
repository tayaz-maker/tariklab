// Household presentation/accounting helpers; progression stays in HOUSEHOLD_EVENTS.
import { economyYear, formatPeriodMoney } from './period-economy.js?v=10';
import { exchangeQuote, normalizeExchange } from './exchange.js?v=10';
import { creditOffer, creditAvailability, takeCredit } from './bank-business.js?v=10';
import { transact, getWeeklyActivityLimit } from './state.js?v=10';

export function weddingRecord(state) {
  const raw = state.household?.wedding;
  return raw?.partnerId === state.social?.currentPartnerNpcId ? raw : null;
}
export function normalizeWedding(state) {
  const r=state.household.wedding;
  if (!r) return;
  if (typeof r.partnerId !== 'string' || !state.people.some(p=>p.id===r.partnerId)) { state.household.wedding=null; return; }
  const week=v=>Number.isInteger(v)&&v>=1&&v<=state.time.absoluteWeek?v:null;
  const amount=v=>Number.isSafeInteger(v)&&v>=0&&v<=1e12?v:0;
  state.household.wedding={partnerId:r.partnerId,familiesMet:week(r.familiesMet),engagedSince:week(r.engagedSince),prepared:r.prepared===true,
    familyView:['support','reserved','objection'].includes(r.familyView)?r.familyView:'reserved',
    partnerFamilyView:['support','reserved','objection'].includes(r.partnerFamilyView)?r.partnerFamilyView:'reserved',
    tradition:r.tradition==='isteme'?'isteme':'informal',settledWeek:week(r.settledWeek),
    style:['confirm','community','wedding','financed'].includes(r.style)?r.style:null,
    gross:amount(r.gross),familyContribution:amount(r.familyContribution),cashGift:amount(r.cashGift),goldGift:amount(r.goldGift),
    loanId:typeof r.loanId==='string'?r.loanId:null,honeymoon:week(r.honeymoon),lastReview:week(r.lastReview)};
}
export function ensureWedding(state) {
  if (!weddingRecord(state)) state.household.wedding={partnerId:state.social.currentPartnerNpcId};
  normalizeWedding(state); return state.household.wedding;
}
export function weddingPeriod(state) {
  const year=economyYear(state);
  return {year, factor:year<1990?.75:year<2010?.9:year<2020?1:1.15,
    text:year<1990?'Aile ve yakın çevreyle yapılan hazırlıklar bu dönemin seçeneklerinden biri; sade nikâh da mümkün.':year<2010?'Evde söz, mahalle kutlaması ve salon düğünü farklı bütçeler gerektirir.':year<2020?'Davetli sayısı ve yeni evin masrafları aynı bütçeden çıkıyor.':'Organizasyon ve ortak ev için ayırdığınız bütçeyi birlikte düşünün; takı geliri garanti değil.'};
}
export function familyMeetingContext(state) {
  const background=state.player.background;
  const family=state.people.filter(p=>p.roleId==='family'&&!p.deceased);
  const trust=family.length?family.reduce((n,p)=>n+p.social.trust-p.social.tension/2,0)/family.length:0;
  const pressure=Math.max(0,Math.min(3,state.flags.familyMods?.marriagePressure||1));
  const threshold=66+pressure*2+(weddingPeriod(state).year<2000?6:0);
  const own=background.family==='demanding'&&(trust<threshold||state.finances.balance<9000)?'objection':background.family==='supportive'&&trust>=45?'support':'reserved';
  const person=state.people.find(p=>p.id===state.social.currentPartnerNpcId);
  // Fictional household response, not a claim about a region or all Turkish families.
  const partnerView=person?.social.trust>=78&&person.social.tension<20?'support':state.finances.balance<3000?'objection':'reserved';
  return {own:family.length?own:'reserved',partner:partnerView};
}
export function weddingQuote(state, style='confirm') {
  if (!['confirm','community','wedding','financed'].includes(style)) return null;
  const r=weddingRecord(state),period=weddingPeriod(state),factor=period.factor;
  const guests=style==='confirm'?0:style==='community'?60:state.player.background.social==='broad'?200:120;
  const hall=style==='wedding'||style==='financed';
  const lines=[['Nikâh ve belgeler',600],['Yüzük',r?.engagedSince?0:1400],['Kıyafet',hall?1800:1000],['Çeyiz / temel ev eşyası',3000],['Mekân',hall?6500:guests?1500:0],['Yemek / ikram',guests*(hall?45:25)],['Organizasyon',hall?2000:guests?400:0]].map(([label,base])=>({label,amount:Math.round(base*factor)}));
  const gross=lines.reduce((n,l)=>n+l.amount,0);
  const familyContribution=r?.familiesMet?Math.floor(gross*((r.familyView==='support'?.15:0)+(r.partnerFamilyView==='support'?.10:0))*(state.player.background.economic==='tight'?.5:1)):0;
  const credit=style==='financed'?creditOffer(state,'small'):null;
  return {style,guests,lines,gross,familyContribution,credit,cashNeeded:Math.max(0,gross-familyContribution-(credit?.cash||0)),period,
    // Gifts are never spendable in advance, nor sufficient to farm marriage profit.
    giftCeiling:Math.floor(Math.min(gross*.4,guests*45*factor)),
    label:{confirm:'Sade nikâh',community:'Yakın çevreyle kutlama',wedding:'Salon düğünü',financed:'Krediyle salon düğünü'}[style]};
}
export function weddingFundingAvailability(state, style) {
  const quote=weddingQuote(state,style);
  if (!quote) return {ok:false,reason:'Evlilik biçimi bulunamadı.'};
  if (state.finances.balance<quote.cashNeeded) return {ok:false,reason:`Peşin bütçe en az ${formatPeriodMoney(quote.cashNeeded,economyYear(state),state.time.date)} olmalı; takı henüz gelir değil.`};
  if (quote.credit) {
    if (state.weekly.used+2>getWeeklyActivityLimit(state)) return {ok:false,reason:'Kredi ve evlilik için bu hafta iki aktivite ayırmalısın.'};
    // Reuse the real bank gate on a copy: checking an event must never normalize/mutate its save.
    const copy=structuredClone(state);copy.events.active=null;
    const check=creditAvailability(copy,'small');if(!check.ok)return check;
  }
  return {ok:true,quote};
}
export function settleWeddingBudget(state, style) {
  const q=weddingQuote(state,style),r=ensureWedding(state);
  if(r.settledWeek)return false;
  if(q.credit){
    // Event already authoritatively validated. Use the existing credit issuer,
    // including its time cost, underwriting, ledger and ordinary personal debt.
    const bank={...state,events:{...state.events,active:null}};
    const result=takeCredit(bank,'small');if(!result.ok)return false;
    state.wealth=bank.wealth;r.loanId=state.wealth.debts.find(d=>d.type==='personal')?.id||null;
  }
  if(q.familyContribution)transact(state,q.familyContribution,'Ailelerin evlilik hazırlığına katkısı','household');
  transact(state,-q.gross,'Ortak evlilik hazırlığı','household');
  const relations=state.people.filter(p=>!p.deceased&&p.social.trust>=50).length;
  const turnout=.4+Math.min(.4,relations*.035)+((state.meta.seed||1)+state.time.absoluteWeek)%5*.04;
  const giftBudget=Math.floor(q.giftCeiling*Math.min(.95,turnout));
  const gold=exchangeQuote(state,'quarter');
  const goldGift=gold?.available?Math.floor(giftBudget*.7/(gold.ask*(1+gold.fee))):0;
  const cashGift=giftBudget-(goldGift?Math.ceil(goldGift*gold.ask*(1+gold.fee)):0);
  if(cashGift)transact(state,cashGift,'Düğün nakit hediyeleri','household');
  if(goldGift){
    const w=state.wealth.exchange=normalizeExchange(state.wealth.exchange),p=w.positions.quarter||{quantity:0,basis:0};
    p.quantity+=goldGift;w.positions.quarter=p;
    w.history.push({date:state.time.date,id:'quarter',side:'gift',quantity:goldGift,cash:0,basis:0,realized:0,sourceDate:gold.sourceDate});w.history=w.history.slice(-80);
    transact(state,0,`Düğün hediyesi: ${goldGift} çeyrek altın portföye eklendi`,'household');
  }
  Object.assign(r,{settledWeek:state.time.absoluteWeek,style,gross:q.gross,familyContribution:q.familyContribution,cashGift,goldGift});
  return true;
}
export function householdChoiceCost(state,eventId,choiceId) {
  const factor=weddingPeriod(state).factor;
  if(eventId==='marriage_commitment')return weddingQuote(state,choiceId)?.cashNeeded||0;
  if(eventId==='marriage_discussion'&&choiceId==='engage')return Math.round(1500*factor);
  if(eventId==='household_families'&&choiceId==='isteme')return Math.round(350*factor);
  if(eventId==='engagement_preparation'&&choiceId==='expanded')return Math.round(1800*factor);
  if(eventId==='household_honeymoon'&&choiceId==='trip')return Math.round(3000*factor);
  return 0;
}
