import {FIELDS, REGIONS} from './basin-network.js';

const WORDS={
  tr:{title:'Kararın izi',closed:'Dönem kapandı',local:'Seçili havza',global:'Masa toplamı',net:'Kapanış dahil net değişim',now:'Bu kararın net değişimi',decisions:'Masa kararı',used:'kullanıldı',unused:'kullanılmadan kapandı',refill:'yeni dönem kapasitesi',queued:'Yeni yola çıkan',arrived:'Yeni varan',echo:'Yeni bekleyen yankı',resolved:'İşlenen yankı',entry:'girişi',closing:'kapanışı',period:'D',noWaves:'Yeni yola çıkan veya varan etki yok.',close:'Sonuç izini kapat',route:'Hat ayarı',tut:'Tut',ac:'Aç',sustur:'Sustur',devret:'Devret',kapat:'Dönemi kapat',sert:'Sert tut',acik:'Açık tut',buffered:'Hattı süz',open:'Hattı aç',intel:'Bilgi',trust:'Güven',tension:'Gerilim',capacity:'Kapasite',strain:'Yük',remaining:'Diğer etkiler aşağıdaki yoldaki etkiler bölümünde.'},
  en:{title:'Decision trace',closed:'Period closed',local:'Selected basin',global:'Desk totals',net:'Net change including closing',now:'Net change from this decision',decisions:'Desk decisions',used:'used',unused:'closed unused',refill:'new period capacity',queued:'Newly dispatched',arrived:'Newly arrived',echo:'New pending echo',resolved:'Resolved echo',entry:'opening',closing:'closing',period:'P',noWaves:'No newly dispatched or arriving effects.',close:'Close decision trace',route:'Route setting',tut:'Hold',ac:'Open',sustur:'Quiet',devret:'Shift',kapat:'Close the period',sert:'Hold hard',acik:'Hold open',buffered:'Filter route',open:'Open route',intel:'Information',trust:'Trust',tension:'Tension',capacity:'Capacity',strain:'Load',remaining:'Other effects are in the effects-in-transit section below.'},
};
const sign=n=>n>0?`+${n}`:String(n);
const deltaRows=(before,after,keys)=>keys.map(key=>({key,before:before[key],after:after[key],delta:after[key]-before[key]}));
const echoKey=p=>JSON.stringify([p.tag,p.due,p.regionId||'',...FIELDS.map(k=>p[k]||0)]);
// A multiset comparison keeps identical pending echoes distinct, without adding IDs to saves.
function difference(rows,previous) {
  const counts=new Map();for(const p of previous){const k=echoKey(p);counts.set(k,(counts.get(k)||0)+1);}
  return rows.filter(p=>{const k=echoKey(p),count=counts.get(k)||0;if(count){counts.set(k,count-1);return false;}return true;});
}

/** Pure presentation of a committed transition; never called on hydration. */
export function buildOutcomeMoment(before,after,action,lang='tr') {
  if(!before||!after||before===after||!action||after.log.length<=before.log.length)return null;
  const committed=after.log.slice(before.log.length);
  if(!committed.some(row=>['move','route','break','period'].includes(row.k)))return null;
  const closed=after.period!==before.period;
  const first=!before.log.some(row=>['move','route','break'].includes(row.k));
  if(!first&&!closed&&before.phase!=='break'&&after.phase!=='end')return null;
  const language=lang==='tr'?'tr':'en',copy=WORDS[language];
  const id=typeof action==='string'?action:action.id;
  const regionName=id=>REGIONS.find(r=>r.id===id)?.[language]||id;
  const beforeLocal=before.regions.find(r=>r.id===before.selected),afterLocal=after.regions.find(r=>r.id===before.selected);
  const local=deltaRows(beforeLocal,afterLocal,FIELDS),global=deltaRows(before,after,['trust','intel','tension']);
  const previousPulses=new Set(before.network.pulses.map(p=>p.id));
  const previousArrivals=new Set(before.network.history.map(p=>p.id));
  const pulseRow=(p,status)=>({id:`wave-${p.id}`,status,from:p.from,to:p.to,due:p.arrived??p.due,timing:'entry',delta:{...(p.delivered||p.delta)},kind:p.kind});
  const queued=after.network.pulses.filter(p=>!previousPulses.has(p.id)).map(p=>pulseRow(p,'queued'));
  const arrived=closed?after.network.last.filter(p=>!previousArrivals.has(p.id)).map(p=>pulseRow(p,'arrived')):[];
  const echoRow=(p,status,index)=>({id:`${status}-${index}-${echoKey(p)}`,status,to:p.regionId||null,due:p.due,timing:'closing',delta:Object.fromEntries(FIELDS.filter(k=>p[k]).map(k=>[k,p[k]])),kind:p.tag});
  const pending=difference(after.pending,before.pending).map((p,index)=>echoRow(p,'echo',index));
  const resolved=difference(before.pending,after.pending).map((p,index)=>echoRow(p,'resolved',index));
  const cost={before:before.capacity,after:after.capacity,used:committed.filter(row=>['move','route'].includes(row.k)).length,forfeited:id==='kapat'?before.capacity:0,refilled:closed};
  const title=`${copy[id]||copy.route} · ${closed?`${copy.closed} ${before.period}`:regionName(before.selected)}`;
  const measure=rows=>rows.map(r=>`${copy[r.key]} ${r.before} → ${r.after} (${sign(r.delta)})`).join(' · ');
  const costText=`${copy.decisions}: ${cost.before} → ${cost.after} · ${cost.used} ${copy.used}${cost.forfeited?` · ${cost.forfeited} ${copy.unused}`:''}${closed?` · ${copy.refill} ${cost.after}`:''}`;
  const waves=[...pending,...resolved,...arrived,...queued].map(row=>({...row,
    label:`${copy[row.status]}${row.timing==='entry'?`: ${regionName(row.from)} → ${regionName(row.to)}`:''}`,
    timingLabel:`${copy.period}${row.due} ${copy[row.timing]}`,
    deltaLabel:FIELDS.filter(k=>row.delta[k]).map(k=>`${row.timing==='closing'?`${k==='strain'?regionName(row.to):copy.global} · `:''}${copy[k]} ${sign(row.delta[k])}`).join(' · ')||'—',
  }));
  return {id:`ihtilal:${before.seed}:${before.log.length}:${after.log.length}:${id}`,announcement:`${title}. ${costText}. ${copy.local}: ${measure(local)}. ${copy.global}: ${measure(global)}. ${waves.map(w=>`${w.label}, ${w.timingLabel}, ${w.deltaLabel}`).join('. ')}`,
    title,copy:{...copy},closed,first,period:{before:before.period,after:after.period},region:{id:before.selected,name:regionName(before.selected)},local,global,cost,costText,waves,queued,arrived,pending,resolved};
}
