import {orderDelta} from './orders.js';
import {BUILDINGS, UNITS} from './data.js';

// Small immutable receipt snapshot: no world clone and no saved UI fields.
export function captureOrderState(state) {
  return {time:state.time, playerId:state.playerId,
    factions:state.factions.map(f=>({id:f.id,influence:f.influence})),
    settlements:state.settlements.map(t=>({id:t.id,name:t.name,ownerId:t.ownerId,x:t.x,y:t.y,
      resources:{...t.resources},troops:{...t.troops},queue:t.queue.map(q=>({...q}))})),
    armies:state.armies.map(a=>({id:a.id})),
  };
}
export function buildOutcomeMoment(before, after, action, lang='tr') {
  if (!before || !after || before.playerId!==after.playerId || before.time!==after.time) return null;
  const town=before.settlements.find(t=>t.id===action.settlementId);
  if (!town || town.ownerId!==before.playerId) return null;
  const delta=orderDelta(before,after,action), outcome=delta.outcome;
  if (!outcome || !['queue','army'].includes(outcome.kind)) return null;
  const en=lang!=='tr';
  const due=outcome.kind==='queue'?outcome.completeAt:outcome.arriveAt;
  if (!Number.isFinite(due) || due<after.time) return null;
  const minutes=Math.ceil(due-after.time);
  const labels=en?{food:'Food',wood:'Wood',stone:'Stone',iron:'Iron',influence:'Influence'}:
    {food:'Erzak',wood:'Odun',stone:'Taş',iron:'Demir',influence:'Nüfuz'};
  const cost=Object.entries(delta.cost).map(([key,value])=>({key,label:labels[key]||key,value}));
  const label=outcome.kind==='queue'?(BUILDINGS[outcome.building]?.label || UNITS[outcome.unit]?.label || (en?'Preparation':'Hazırlık')):
    `${town.x},${town.y} → ${outcome.to.x},${outcome.to.y}`;
  const title=en?'ORDER SEALED':'FERMAN MÜHÜRLENDİ';
  const summary=outcome.kind==='queue'?
    (en?`Queued in ${town.name}; ${minutes} game minutes until completion.`:`${town.name}: sıraya alındı; bitime ${minutes} oyun dk.`):
    (en?`Departed ${town.name}; arrival in ${minutes} game minutes. Result is resolved on arrival.`:`${town.name}: yola çıktı; varış ${minutes} oyun dk. Sonuç varışta hesaplanır.`);
  const id=[town.id,action.type,label,due,outcome.level||outcome.count||0].join(':');
  return {id,title,summary,label,minutes,cost,kind:outcome.kind,
    announcement:`${title}. ${summary} ${cost.map(c=>`${c.label} -${c.value}`).join(', ')}.`,
    paused:!!after.paused, en,
    marks:cost.map((c,i)=>({x:14+i*48,width:Math.min(36,8+Math.log2(1+c.value)*3)})),
  };
}

/** The same current queue progress drives the map plinth and DOM directory. */
export function settlementWork(state,town) {
  if (town.ownerId!==state.playerId || !town.queue.length) return null;
  const q=town.queue[0], end=q.completeAt, start=q.startAt;
  if (!Number.isFinite(end)||!Number.isFinite(start)) return null;
  return {count:town.queue.length,kind:q.kind,minutes:Math.ceil(Math.max(0,end-state.time)),
    progress:Math.max(0,Math.min(1,(state.time-start)/Math.max(1,end-start))),
    label:BUILDINGS[q.building]?.label||UNITS[q.unit]?.label||'Hazırlık'};
}
