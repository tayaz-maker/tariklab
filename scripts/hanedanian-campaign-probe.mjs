import { createGame, dispatch, advance, getPlayerSettlements, getFaction, getCampaign, getCapacity, getMilitaryPower, combatPower, getRates, validateState } from '../public/games/hanedanian/engine.js';
import { regionOf, progressOf, projectRequirements, PROJECT_QUOTAS } from '../public/games/hanedanian/campaign.js';
import { distance } from '../public/games/hanedanian/world.js';
import { TERRAINS } from '../public/games/hanedanian/data.js';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const resources=['food','wood','stone','iron'];
export function runCampaign(seed, path, {limit=100000, policy='network', snapshot=false}={}) {
  const s=createGame({seed}); s.settings.autoPause=false;
  const log={seed,path,policy,commands:0,rejected:0,stages:[],early:false,losses:0,maxAITowns:1,maxAIShare:0};
  let lastStage=0, previousTownCount=1;
  const order=a=>{const r=dispatch(s,a); if(r.ok) log.commands++; else log.rejected++; return r.ok;};
  const send=(t,type,extra)=>order({type,settlementId:t.id,...extra});
  const regionsWanted=[4,1,5,7,3,2,0,6,8].filter(r=>s.world.tiles.filter(z=>z.poi&&regionOf(s,z)===r).length>=2).slice(0,6);
  const cachedSites=new Map();
  for (let time=0; time<limit; time+=120) {
    const towns=getPlayerSettlements(s), p=progressOf(s), faction=getFaction(s);
    if(towns.length<previousTownCount) log.losses+=previousTownCount-towns.length;
    previousTownCount=towns.length;
    if(s.dynasty.pendingEvent) order({type:'event',choice:path==='dynasty'?'marry':'mentor'});
    const stat=path==='dynasty'?'diplomacy':'stewardship';
    if(s.dynasty.stats[stat]<7) order({type:'dynasty',choice:stat});
    if(s.dynasty.stats.warfare<5) order({type:'dynasty',choice:'warfare'});
    const group=new Map(); for(const t of towns) { const r=regionOf(s,t); if(!group.has(r))group.set(r,t); }
    const ongoing=s.armies.filter(a=>a.ownerId==='player'&&a.mission==='expand'&&!a.returning);
    if(towns.length+ongoing.length<8 && policy!=='idle') {
      const missing=regionsWanted.find(r=>!group.has(r)&&!ongoing.some(a=>regionOf(s,a.to)===r));
      const r=missing??(Math.floor(time/120)%2?4:7);
      if(!cachedSites.has(r)) cachedSites.set(r,s.world.tiles.filter(z=>!z.poi&&regionOf(s,z)===r&&s.world.tiles.filter(q=>q.poi&&regionOf(s,q)===r&&distance(q,z)<=7).length>=2).map(z=>({z,score:s.world.tiles.filter(q=>q.poi&&regionOf(s,q)===r&&distance(q,z)<=7).length*3+TERRAINS[z.terrain].rates[0]*15-distance(z,{x:24,y:24})*0.2})).sort((a,b)=>b.score-a.score));
      const candidate=cachedSites.get(r).find(({z})=>s.settlements.every(k=>distance(k,z)>=3)&&ongoing.every(a=>distance(a.to,z)>=3)&&towns.some(t=>distance(t,z)<=8+t.buildings.hall*2));
      if(candidate) { const t=[...towns].sort((a,b)=>distance(a,candidate.z)-distance(b,candidate.z)).find(t=>distance(t,candidate.z)<=8+t.buildings.hall*2); send(t,'expand',{x:candidate.z.x,y:candidate.z.y}); }
    }
    for(const t of towns) {
      const r=regionOf(s,t), anchor=group.get(r)===t;
      if(policy==='idle')continue;
      const wanted = anchor ? path==='wealth'?'exchange':path==='dominion'?'fortress':'court' : towns.filter(q=>group.get(regionOf(s,q))!==q).indexOf(t)%2?'workshop':'granary';
      if(p.specializations[t.id]!==wanted) send(t,'specialize',{specialty:wanted});
      const orderBuildings=['hall','market','warehouse','farm','lumber','quarry','mine','barracks','wall'];
      const targets={hall:6,market:6,warehouse:8,farm:12,lumber:12,quarry:12,mine:12,barracks:path==='dominion'?6:3,wall:3};
      if(t.queue.length<2) {
        // First fix the production bottleneck; then unlock spatial/infrastructure decisions.
        const rate=getRates(s,t); const low=resources.reduce((a,b)=>rate[a]<rate[b]?a:b);
        const prod={food:'farm',wood:'lumber',stone:'quarry',iron:'mine'}[low];
        const priority=[...(t.buildings.hall<2?['hall']:[]),...(t.buildings.warehouse<3?['warehouse']:[]),...(t.buildings[prod]<8?[prod]:[]),...orderBuildings];
        for(const b of priority) if(t.buildings[b]<targets[b]&&!t.queue.some(q=>q.building===b)&&send(t,'build',{building:b}))break;
      }
      if(t.resources.food>2400 && t.buildings.market) {
        const hungry=towns.find(q=>q!==t&&q.resources.food<800);
        if(hungry)send(t,'trade',{targetId:hungry.id,cargo:{food:Math.min(1000,t.buildings.market*220)}});
      }
      const army=s.armies.some(a=>a.fromId===t.id&&!a.returning&&['claim','attack'].includes(a.mission));
      if(!army && t.queue.length<3) {
        if(path==='dominion' && Object.values(p.rivals).filter(x=>x>=1200).length<3 && t.buildings.barracks>=4 && t.troops.siege<20 && (getRates(s,t).food>0.5||t.resources.food>2200) && !t.queue.some(q=>q.unit==='siege'))send(t,'train',{unit:'siege',count:4});
        if(t.troops.scout<4 && !t.queue.some(q=>q.unit==='scout'))send(t,'train',{unit:'scout',count:2});
        const warDone=Object.values(p.rivals).filter(x=>x>=1200).length>=3;
        const max=path==='dominion'&&!warDone?220:path==='dynasty'?160:70;
        if(path==='dominion'&&warDone){if(t.troops.archer>70)send(t,'demobilize',{unit:'archer',count:t.troops.archer-70});if(t.troops.siege>4)send(t,'demobilize',{unit:'siege',count:t.troops.siege-4});}
        if(t.troops.archer<max && (getRates(s,t).food>0.5||t.resources.food>2200) && !t.queue.some(q=>q.unit==='archer'))send(t,'train',{unit:'archer',count:10});
      }
      if(!Object.keys(s.intel).some(k=>{const [x,y]=k.split(',').map(Number);return regionOf(s,{x,y})===r;}) && t.troops.scout && !s.armies.some(a=>a.fromId===t.id&&a.mission==='scout')) send(t,'scout',{x:regionOf(s,{x:t.x+1,y:t.y})===r&&t.x<48?t.x+1:t.x-1,y:t.y,count:1});
      const points=s.world.tiles.filter(z=>z.poi && regionOf(s,z)===r && distance(t,z)<=7 && z.poi.ownerId!=='player');
      const localOwned=s.world.tiles.filter(z=>z.poi?.ownerId==='player'&&regionOf(s,z)===r).length;
      if(!army && localOwned<(path==='dominion'?3:2)) {
        const z=points.find(z=>!z.poi.ownerId||!getFaction(s,z.poi.ownerId).relations.player.vasal);
        const troops={militia:t.troops.militia,spear:Math.floor(t.troops.spear*0.5),archer:Math.floor(t.troops.archer*0.7)};
        if(z&&combatPower(troops)>130)send(t,'claim',{x:z.x,y:z.y,troops});
      }
      if(anchor && policy==='network') {
        const pr=p.projects[`${path}:${r}`];
        if(!pr?.active && (pr?.level||0)<3 && projectRequirements(s,t,path).requirements.every(x=>x.done)) send(t,'project',{path});
        if(pr?.active && t.queue.length<2) send(t,'contribute',{path});
        const next=[...group.values()].filter(q=>regionOf(s,q)!==r).sort((a,b)=>distance(t,a)-distance(t,b));
        // A deterministic ring ensures every region receives imports, not only the nearest hub.
        const anchors=[...group.values()].sort((a,b)=>regionOf(s,a)-regionOf(s,b)), index=anchors.indexOf(t);
        const target=anchors[(index+1)%anchors.length]||next[0];
        if(target&&target!==t&&p.supply[t.id]?.targetId!==target.id)send(t,'supplyOrder',{path,targetId:target.id});
      }
      if (!anchor && policy==='network') {
        const target=[...group.values()].filter(q=>regionOf(s,q)!==r).map(q=>{const project=p.projects[`${path}:${regionOf(s,q)}`];return {q,need:project?.active?PROJECT_QUOTAS[project.level]-project.imported:project?.level===3?12000-(p.finales[path]?.[regionOf(s,q)]||0):0};}).filter(x=>x.need>0).sort((a,b)=>b.need-a.need)[0]?.q;
        if(target && p.supply[t.id]?.targetId!==target.id)send(t,'supplyOrder',{path,targetId:target.id});
      }
      if(path==='dominion' && Object.values(p.rivals).filter(x=>x>=1200).length<3 && !army&&t.troops.archer>=150 && t.troops.siege>=12) {
        const enemy=s.settlements.filter(e=>e.ownerId!=='player'&&!(p.rivals[e.ownerId]>=1200)&&!getFaction(s,e.ownerId).relations.player.vasal&&getFaction(s,e.ownerId).relations.player.truceUntil<=s.time).sort((a,b)=>{const strength=e=>{const intel=s.intel[`${e.x},${e.y}`];if(!intel||s.time-intel.time>720)return 1200;const strength=combatPower(intel.troops,'defense')*TERRAINS[s.world.tiles[e.y*49+e.x].terrain].defense*(1+Math.max(0,intel.buildings.wall-Math.floor(t.troops.siege/3))*.15);return strength<1200?100000:strength;};return strength(a)-strength(b)||distance(t,a)-distance(t,b);})[0];
        if(enemy){
          const intel=s.intel[`${enemy.x},${enemy.y}`];
          if(!intel||s.time-intel.time>720){if(t.troops.scout>=4)send(t,'scout',{x:enemy.x,y:enemy.y,count:4});}
          else {const troops={archer:Math.floor(t.troops.archer*0.9),militia:t.troops.militia,siege:t.troops.siege};const def=combatPower(intel.troops,'defense')*TERRAINS[s.world.tiles[enemy.y*49+enemy.x].terrain].defense*(1+Math.max(0,intel.buildings.wall-Math.floor(t.troops.siege/3))*.15);if(combatPower(troops)*(1+s.dynasty.stats.warfare*.04)>def*1.1)send(t,'attack',{x:enemy.x,y:enemy.y,troops});}
        }
      }
    }
    if(path==='dynasty') for(const f of s.factions.slice(1)) {
      const rel=f.relations.player;
      if(rel.vasal)continue;
      if(rel.score<65&&towns.length>=3) order({type:'diplomacy',mode:'gift',factionId:f.id});
      if(path==='dynasty' && rel.score>=60) order({type:'diplomacy',mode:'vasal',factionId:f.id});
      
    }
    s.paused=false; advance(s,120);
    const c=getCampaign(s);
    if(c.stage!==lastStage){log.stages.push({stage:c.stage,time:s.time});lastStage=c.stage;}
    if(c.paths.some(x=>x.ready)&&s.time<10000)log.early=true;
    const ai=s.factions.slice(1).map(f=>s.settlements.filter(t=>t.ownerId===f.id).length);
    log.maxAITowns=Math.max(log.maxAITowns,...ai);log.maxAIShare=Math.max(log.maxAIShare,...ai.map(n=>n/s.settlements.length));
    if(c.paths.find(x=>x.id===path).ready){order({type:'victory',path});break;}
  }
  const verdict=validateState(s); if(!verdict.ok)throw Error(verdict.errors.join(';'));
  return {...log,time:s.time,victory:s.campaign.victory,oneXHours:s.time/3600,twelveXHours:s.time/43200,towns:getPlayerSettlements(s).length,projects:progressOf(s).projects,blockers:getPlayerSettlements(s).map(t=>({town:t.name,region:regionOf(s,t),missing:projectRequirements(s,t,path).requirements.filter(x=>!x.done)})),requirements:getCampaign(s).paths.find(x=>x.id===path).requirements,resourcesFinite:s.settlements.every(t=>resources.every(k=>Number.isFinite(t.resources[k])&&t.resources[k]>=0&&t.resources[k]<=getCapacity(t))),playerPower:getMilitaryPower(s,'player'),...(snapshot?{state:s}:{})};
}
if(import.meta.url===pathToFileURL(process.argv[1]).href) {
  const count=Number(process.env.SEEDS||20), chosen=process.env.PATHS?.split(',')||['wealth','dominion','dynasty'];
  const results=[];
  for(let i=0;i<count;i++)for(const path of chosen){const r=runCampaign(`TL-CAMPAIGN-${i}`,path,{limit:Number(process.env.LIMIT||100000)});results.push(r);console.log(JSON.stringify({...r,projects:undefined}));writeFileSync(process.env.PROBE_OUTPUT||'/tmp/hanedanian-campaign-probe.json',JSON.stringify(results,null,2));}
  if(results.some(r=>!r.victory||r.early||!r.resourcesFinite))process.exitCode=1;
}
