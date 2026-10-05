// Read-only diagnostic; run from repository root. No forced hands, fields or draws.
// node docs/evidence/probes/darbe-natural-boundary.mjs /path/to/new-result.json
// Preserved sampling logic from the recorded probe; paths/output destination made portable.
import fs from 'node:fs';
import { createDuel, dispatch } from '../../../public/games/duel-core/rules.js';
import { legalActions } from '../../../public/games/duel-core/actions.js';
import { publicView } from '../../../public/games/duel-core/projection.js';
import { chooseAction, AI_PROFILE_IDS } from '../../../public/games/duel-core/ai.js';
import { expandDeck } from '../../../public/games/duel-core/decks.js';
import { pools } from '../../../scripts/duel-pools.mjs';
const presets=JSON.parse(fs.readFileSync('public/games/darbe-h/decks.json')).decks;
const ids=['DRB-237','DRB-238','DRB-239','DRB-240'];
const matches=[];
const fields=['presentMain','presentAuxiliary','seenHand','seenBoard','legalSpecial','chosenSpecial','legalActivate','chosenActivate'];
for(let presetIndex=0;presetIndex<presets.length;presetIndex++) for(let rep=0;rep<5;rep++) for(const first of [0,1]) {
  const seed=151000+presetIndex*100+rep;
  const seedFor=(p)=>(seed+Math.imul(p+1,2654435761))>>>0;
  const deckA=presets[presetIndex],deckB=presets[seedFor(1)%presets.length];
  let state=createDuel(pools['darbe-h'],'darbe-h',seed,first,[expandDeck(deckA,pools['darbe-h'],seedFor(0)),expandDeck(deckB,pools['darbe-h'],seedFor(1))]);
  const row={seed,first,deckA:deckA.id,deckB:deckB.id,profileA:AI_PROFILE_IDS[rep],profileB:AI_PROFILE_IDS[(rep+2)%5],steps:0,byCard:Object.fromEntries(ids.map(id=>[id,Object.fromEntries(fields.map(f=>[f,0]))])),actions:[]};
  const printed=(uid)=>state.cards[uid]?.id;
  const snapshot=()=>{for(const p of state.players) {for(const uid of p.hand)if(ids.includes(printed(uid)))row.byCard[printed(uid)].seenHand=1;for(const uid of p.units.filter(Boolean))if(ids.includes(printed(uid)))row.byCard[printed(uid)].seenBoard=1;}};
  for(const p of state.players){for(const uid of [...p.deck,...p.hand])if(ids.includes(printed(uid)))row.byCard[printed(uid)].presentMain++;for(const uid of p.auxiliary)if(ids.includes(printed(uid)))row.byCard[printed(uid)].presentAuxiliary++;}
  snapshot();
  while(!state.result && row.steps++<4000){
    const actor=state.choice?.player??state.pending?.responding??state.active;
    const legal=legalActions(state,actor);
    if(!legal.length){row.error='no legal action';break;}
    for(const id of ids){if(legal.some(a=>a.type==='special'&&printed(a.card)===id))row.byCard[id].legalSpecial++;if(legal.some(a=>a.type==='activate'&&printed(a.card)===id))row.byCard[id].legalActivate++;}
    const pick=chooseAction(publicView(state,actor),legal,actor===0?row.profileA:row.profileB);
    const id=printed(pick?.card),beforePoints=state.players[actor].points;
    const res=dispatch(state,pick);
    if(!res.ok){row.error=res.why||res.error||'dispatch rejected';break;}
    state=res.state;
    if(ids.includes(id)&&['special','activate'].includes(pick.type)){
      row.byCard[id][pick.type==='special'?'chosenSpecial':'chosenActivate']++;
      row.actions.push({step:row.steps,turn:state.turn,actor,id,type:pick.type,pointsBefore:beforePoints,pointsAfter:state.players[actor].points,choiceKind:state.choice?.kind??null,pending:Boolean(state.pending)});
    }
    snapshot();
  }
  row.result=state.result;row.finalTurn=state.turn;row.finalPhase=state.phase;
  matches.push(row);
}
const aggregate=Object.fromEntries(ids.map(id=>[id,{...Object.fromEntries(fields.map(f=>[f,matches.reduce((n,r)=>n+r.byCard[id][f],0)])),matchesWith:Object.fromEntries(fields.map(f=>[f,matches.filter(r=>r.byCard[id][f]>0).length]))}]));
const report={createdAt:new Date().toISOString(),productionBaseline:'be160c95eb5283e5ed2ce8bf139ef7aa714d329d',method:'50 natural seeded matches; real authored presets; UI prepare seed/opponent algorithm; unchanged public-projection AI decisions; no state placement, forced draw or preferred target decisions',limits:['Node engine sample, not browser/human play','No affected old user save','An accepted activation count does not assert unnegated final resolution','No claim about frequency beyond this sample'],matchCount:matches.length,finished:matches.filter(r=>r.result).length,errors:matches.filter(r=>r.error||!r.result).map(r=>({seed:r.seed,first:r.first,error:r.error??'guard'})),aggregate,matches};
if (!process.argv[2]) throw new Error('Pass a new output JSON path; run from the repo root at the recorded baseline.');
fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n', { flag: 'wx' });
console.log(JSON.stringify({matchCount:report.matchCount,finished:report.finished,errors:report.errors,aggregate},null,2));
