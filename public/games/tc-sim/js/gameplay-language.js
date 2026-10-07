// Presentation only: no state writes, event dispatch, random draws or save fields.
import {getPlayerVisibleOpenCases} from './calendar.js?v=10';
import {getMonthlySummary,getEffectiveCommuteLoad} from './life.js?v=10';
import {EXCHANGE_ASSETS} from './exchange.js?v=10';

export function gameplayText(value){
 return String(value??'')
 .replace(/uzun dönem yaşam rotası/gi,'hayatının başladığı gün')
 .replace(/dönem kararı işlendi/g,'kararın hikâyene eklendi')
 .replace(/Nominal karşılık/g,'O yılın parasıyla')
 .replace(/nominal karşılık/g,'o yılın parasıyla')
 .replace(/Ark durumu/g,'Hayatındaki gelişmeler')
 .replace(/Sistem etkisi/g,'Hayatına etkisi')
 .replace(/Son anlamlı temas/g,'Son görüşmeniz')
 .replace(/anlamlı temas yok/g,'görüşmediniz')
 .replace(/tek sahiplik/g,'bir kez alınabilir')
 .replace(/Bir haftalık aktivite/g,'Haftandan bir zaman')
 .replace(/sonuçlandır\./g,'kararını ver.');
}
export function caseTiming(item,week){
 const due=Number.isInteger(item.dueWeek)?item.dueWeek:null;
 if(due===null)return {rank:3,label:'Takipte',next:'Yeni bir gelişme olduğunda haber alacaksın.'};
 if(due<week)return {rank:0,label:`${week-due} haftadır bekliyor`,next:'Takvimde durumu kontrol et; henüz kesinleşmiş bir sonuç yok.'};
 if(due===week)return {rank:1,label:'Bu hafta',next:'Takvimi kontrol et. Bir seçim gerektiğinde olay ekranı açılır.'};
 return {rank:2,label:`${due-week} hafta sonra`,next:'Şimdilik karar vermen gerekmiyor; zamanı geldiğinde yeniden bakabilirsin.'};
}
export function inboxCases(state){
 const active=state.events.active?.sourceCaseId;
 const seen=new Set();
 return getPlayerVisibleOpenCases(state).filter(item=>{if(item.id===active||seen.has(item.id))return false;seen.add(item.id);return true;})
 .map(item=>({item,...caseTiming(item,state.time.absoluteWeek)}))
 .sort((a,b)=>a.rank-b.rank||(a.item.dueWeek??Infinity)-(b.item.dueWeek??Infinity));
}
export function recentNotices(state,omit=[]){
 const last=state.memories.at(-1),keyOf=m=>`${gameplayText(m.text)}|${m.week}|${m.year}`;
 const seen=new Set(last&&omit.map(gameplayText).includes(gameplayText(last.text))?[keyOf(last)]:[]);
 return [...state.memories].reverse().filter(m=>{const key=keyOf(m);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,8);
}
export function snapshotDecision(state){
 // Some existing summary helpers normalize data; a private copy keeps this projection read-only.
 const copy=structuredClone(state),monthly=getMonthlySummary(copy);
 return {balance:state.finances.balance,ledger:state.finances.ledger.map(r=>JSON.stringify(r)),housing:monthly.housing,commute:getEffectiveCommuteLoad(copy),
  people:state.people.map(p=>({id:p.id,name:p.name,closeness:state.relationships[p.id],trust:p.social.trust,tension:p.social.tension})),
  positions:structuredClone(state.wealth?.exchange?.positions||{}),business:state.flags.business?{level:state.flags.business.level,employees:state.flags.business.employees}:null};
}
export function decisionFeedback(before,state,result,money){
 let message=gameplayText(result.reason||result.message||'Kararın kaydedildi.');
 if(result.ok===false)return message;
 if(EXCHANGE_ASSETS[result.id]&&['buy','sell'].includes(result.side))message=`${result.quantity} ${EXCHANGE_ASSETS[result.id].label} ${result.side==='buy'?'aldın':'sattın'}.`;
 const after=snapshotDecision(state),parts=[message],delta=after.balance-before.balance;
 if(delta){
  let overlap=Math.min(before.ledger.length,after.ledger.length);
  while(overlap&&before.ledger.slice(-overlap).join('\n')!==after.ledger.slice(0,overlap).join('\n'))overlap--;
  const reasons=after.ledger.slice(overlap).map(s=>JSON.parse(s)).filter(r=>r.amount).map(r=>gameplayText(r.reason));
  const why=[...new Set(reasons)].slice(0,2).join(' / ');
  parts.push(`Cüzdanın: ${delta>0?'+':'−'}${money(Math.abs(delta))}${why?' · '+why:''}.`);
 }
 if(after.housing!==before.housing)parts.push(`Aylık konut giderin ${money(before.housing)} → ${money(after.housing)}.`);
 if(after.commute!==before.commute)parts.push(`Haftalık yol yükün ${before.commute} → ${after.commute}; enerji ve stresine yansır.`);
 for(const id of new Set([...Object.keys(before.positions),...Object.keys(after.positions)])){
  const p=after.positions[id]||{quantity:0};
  const diff=p.quantity-(before.positions[id]?.quantity||0);
  if(diff)parts.push(`${EXCHANGE_ASSETS[id]?.label||id}: ${diff>0?'+':''}${diff}; elinde ${p.quantity} var.`);
 }
 // Only the relationship gauges already visible in KİŞİLER; never memory secrets, cases or unknown health.
 const changes=after.people.map(p=>{const b=before.people.find(x=>x.id===p.id);if(!b)return null;
  const fields=[['trust','güven'],['closeness','yakınlık'],['tension','gerilim']];
  const field=fields.find(([k])=>Math.abs(p[k]-b[k])>=2);return field?`${p.name} ile ${field[1]} ${p[field[0]]>b[field[0]]?'arttı':'azaldı'}.`:null;}).filter(Boolean).slice(0,2);
 parts.push(...changes);
 if(after.business&&before.business&&(after.business.level!==before.business.level||after.business.employees!==before.business.employees))parts.push(`İşletmen: kapasite seviyesi ${after.business.level}, ${after.business.employees} çalışan. Ciro ve giderler ay sonunda belli olur; büyüme kâr garantisi değildir.`);
 return parts.slice(0,7).join(' ');
}
