/** Original fictional working geography. No real borders, assets or random turns. */
export const REGIONS = [
  { id: 'kuzey', tr: 'Kuzey kıyı', en: 'North shore', x: 70, y: 48 },
  { id: 'bati', tr: 'Batı eşik', en: 'West threshold', x: 48, y: 150 },
  { id: 'ic', tr: 'İç ova', en: 'Inner plain', x: 150, y: 78 },
  { id: 'merkez', tr: 'Merkez halka', en: 'Center ring', x: 156, y: 168 },
  { id: 'dogu', tr: 'Doğu hat', en: 'East line', x: 250, y: 96 },
  { id: 'yayla', tr: 'Yüksek yayla', en: 'High plateau', x: 248, y: 196 },
  { id: 'guney', tr: 'Güney kapı', en: 'South gate', x: 150, y: 262 },
];
export const ROUTES = [
  ['kuzey','ic',1], ['kuzey','bati',2], ['bati','merkez',1], ['ic','merkez',1],
  ['ic','dogu',2], ['merkez','yayla',2], ['merkez','guney',1], ['dogu','yayla',1], ['yayla','guney',1],
].map(([a,b,delay]) => ({ id: `${a}:${b}`, a,b,delay }));
export const FIELDS = ['intel','trust','tension','capacity','strain'];
export const bounded = n => Math.max(0, Math.min(100, Math.round(n)));
export function mix(seed,text) { let h=seed>>>0; for(const c of text) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0; return h; }
export function routeBetween(a,b) { return ROUTES.find(r => (r.a===a&&r.b===b)||(r.a===b&&r.b===a)); }
export function neighbours(state,id) {
  return ROUTES.filter(r=>r.a===id||r.b===id).map(r=>({...r, other:r.a===id?r.b:r.a,
    mode:state.network.links.find(l=>l.id===r.id).mode,
    travel:r.delay+(state.network.links.find(l=>l.id===r.id).mode==='buffered'?1:0) }));
}
export function initializeNetwork(state) {
  return { ...state,
    regions:state.regions.map(r=>({...r,
      intel:bounded(state.intel+(mix(state.seed,r.id+'.i')%17)-8),
      trust:bounded(state.trust+(mix(state.seed,r.id+'.t')%13)-6),
      tension:bounded(state.tension+(mix(state.seed,r.id+'.g')%11)-5),
      capacity:44+mix(state.seed,r.id+'.c')%19,
    })),
    network:{version:1, links:ROUTES.map(r=>({id:r.id,mode:'open'})), pulses:[], nextId:1,
      history:[], doctrine:'balanced', last:[]},
    routeTarget:null,
  };
}
export function copyNetworkState(state) {
  return {...state,regions:state.regions.map(r=>({...r})),pending:state.pending.map(p=>({...p})),
    network:{...state.network,links:state.network.links.map(l=>({...l})),pulses:state.network.pulses.map(p=>({...p,delta:{...p.delta},visited:[...p.visited]})),
      history:[...state.network.history],last:[...state.network.last]},log:[...state.log]};
}
export function launch(state,from,to,delta,kind,hop=1,visited=[from],origin=from) {
  const route=routeBetween(from,to);
  if(!route||state.network.pulses.length>=96) return;
  const mode=state.network.links.find(l=>l.id===route.id).mode;
  const factors={intel:.5,trust:.7,tension:.35,capacity:.8,strain:.5};
  const payload=Object.fromEntries(FIELDS.map(k=>[k,Math.round((delta[k]||0)*(mode==='buffered'?factors[k]:1))]).filter(([,v])=>v!==0));
  if(!Object.values(payload).some(Boolean)) return;
  state.network.pulses.push({id:state.network.nextId++,from,to,origin,via:route.id,mode,
    due:state.period+route.delay+(mode==='buffered'?1:0),kind,hop,visited:[...visited,to],delta:payload});
}
export function arrivalDelta(region,pulse,doctrine='balanced') {
  const d={...pulse.delta};
  if(d.intel>0) d.intel=Math.round(d.intel*(region.capacity<25?.6:1)*(doctrine==='listen'?1.2:doctrine==='buffer'?.75:1));
  if(d.trust>0&&region.intel<30) d.trust=Math.round(d.trust*.5);
  if(d.tension>0) d.tension=Math.round(d.tension*(region.intel>=55?.6:1)*(region.capacity>=55?.7:1)*(doctrine==='buffer'?.75:doctrine==='listen'?1.1:1));
  if(d.capacity>0&&region.strain>=65) d.capacity=Math.round(d.capacity*.6);
  return d;
}
export function basinReady(r) { return r.strain<65&&r.tension<65&&r.capacity>=20&&r.trust>=30&&r.intel>=25; }
export function spillRisk(r) { return r.strain>=55&&(r.tension>=38||r.capacity<35); }
export function targetFor(state) {
  const ids=neighbours(state,state.selected).map(r=>r.other);
  if(ids.includes(state.routeTarget))return state.routeTarget;
  return state.regions.filter(r=>ids.includes(r.id)).sort((a,b)=>b.strain-a.strain||a.id.localeCompare(b.id))[0]?.id;
}
export function seedMoveSignals(state,move,target) {
  const here=state.regions.find(r=>r.id===state.selected);
  if(move==='devret') { launch(state,here.id,target,{capacity:12,strain:-10,tension:-3,trust:2},'devret'); return; }
  const delta=move==='ac'?{intel:10,tension:5,trust:-2}:
    move==='sustur'?{intel:-5,tension:-4}:
    here.strain<=45?{trust:3,tension:-2}:{tension:4,strain:2};
  for(const route of neighbours(state,here.id)) launch(state,here.id,route.other,delta,move);
}
/** Arrivals resolve simultaneously. One additional hop, no capacity duplication or cycles. */
export function resolveNetwork(state) {
  const due=state.network.pulses.filter(p=>p.due<=state.period).sort((a,b)=>a.id-b.id);
  state.network.pulses=state.network.pulses.filter(p=>p.due>state.period);
  const before=new Map(state.regions.map(r=>[r.id,{...r}]));
  const totals=new Map(state.regions.map(r=>[r.id,Object.fromEntries(FIELDS.map(k=>[k,0]))]));
  const arrived=due.map(p=>({...p,delivered:arrivalDelta(before.get(p.to),p,state.network.doctrine),arrived:state.period}));
  for(const p of arrived) for(const k of FIELDS) totals.get(p.to)[k]+=p.delivered[k]||0;
  for(const r of state.regions) for(const k of FIELDS) r[k]=bounded(r[k]+totals.get(r.id)[k]);
  state.network.last=arrived;
  state.network.history=state.network.history.concat(arrived).slice(-48);
  if(state.period<=6) {
    for(const p of arrived) {
      if(p.hop>=2) continue;
      // Aid is a conserved shipment, not a replicating rumour. Never relay capacity/relief.
      const relay={intel:Math.trunc((p.delivered.intel||0)*.5),trust:Math.trunc((p.delivered.trust||0)*.5),
        tension:Math.trunc((p.delivered.tension||0)*.5),strain:Math.max(0,Math.trunc((p.delivered.strain||0)*.5))};
      for(const route of neighbours(state,p.to)) if(!p.visited.includes(route.other))
        launch(state,p.to,route.other,relay,p.kind,2,p.visited,p.origin);
    }
  }
  for(const r of state.regions) {
    const stress=Math.max(0,Math.floor((r.strain-45)/12));
    r.intel=bounded(r.intel-2-(r.strain>=60?1:0));
    r.strain=bounded(r.strain+2+Math.floor((100-r.capacity)/35)-Math.floor(r.trust/40));
    r.capacity=bounded(r.capacity+2+Math.floor(r.trust/30)-stress*2);
    r.tension=bounded(r.tension+stress-(r.strain<40?1:0));
    if(stress>=2) r.trust=bounded(r.trust-1);
    if(state.period<=6&&spillRisk(r)) for(const route of neighbours(state,r.id))
      launch(state,r.id,route.other,{tension:4,strain:3,trust:-1},'pressure',2,[r.id]);
  }
  const drift={};
  for(const k of ['trust','intel','tension']) drift[k]=Math.round(state.regions.reduce((sum,r)=>sum+r[k]-before.get(r.id)[k],0)/state.regions.length);
  return drift;
}
