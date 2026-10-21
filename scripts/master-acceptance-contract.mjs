import assert from 'node:assert/strict';
import {resolve,sep} from 'node:path';

export const CANONICAL_WIDTHS = [390,1280];
export const CRITICAL_WIDTHS = [320,1440];
export function widthsFrom(value, critical=false) {
  const widths=value?value.split(',').map(Number):critical?CRITICAL_WIDTHS:CANONICAL_WIDTHS;
  assert.ok(widths.length>0&&widths.every(width=>[320,390,1280,1440].includes(width)),'viewports must be 320,390,1280 or 1440');
  assert.equal(new Set(widths).size,widths.length,'duplicate viewport');return widths;
}
export function languagesFrom(value) {
  const languages=value?value.split(','):['tr','en','pl'];
  assert.ok(languages.length>0&&languages.every(lang=>['tr','en','pl'].includes(lang)),'languages must be tr,en or pl');
  assert.equal(new Set(languages).size,languages.length,'duplicate language');return languages;
}
export function acceptedAssetPath(root,pathname) {
  const decoded=decodeURIComponent(pathname),path=resolve(root,'.'+decoded);
  assert.ok(path.startsWith(resolve(root)+sep),'asset escapes accepted build root');return path;
}
export function gamePathMatches(url,origin,game) {
  const parsed=new URL(url);
  return parsed.origin===origin&&(parsed.pathname===`/games/${game}`||parsed.pathname.startsWith(`/games/${game}/`));
}
export function exactEntryPath(url,origin,game) {
  assert.ok(gamePathMatches(url,origin,game),'game frame must be the requested game on the accepted host');
  const path=new URL(url).pathname;return path.endsWith('/')?path+'index.html':path;
}
export function stableSave(value,game) {
  if(!value||typeof value!=='object')return value;
  const result=structuredClone(value);
  if(typeof result.savedAt==='number')delete result.savedAt;
  // Cete's existing slot envelope stores its wall-clock metadata in state.
  // Nested game/event timestamps are progress, so never strip them recursively.
  if(game==='cete-savaslari'&&typeof result.state?.savedAt==='number')delete result.state.savedAt;
  return result;
}
// Only authored storage namespaces count as game-save evidence. Slug substrings
// can accidentally count preferences, or miss legacy names such as tektas.
const SAVE_POLICIES = {
 'cete-savaslari': {primary:/^(?:tariklab::cete:[1-3]|cete-savaslari-save-v1)$/, evidence:/^(?:tariklab::cete:[1-3](?::bak)?|cete-savaslari-save-v1)$/},
 racon: {primary:/^(?:tariklab::racon:[1-3]|racon_v1)$/, evidence:/^(?:tariklab::racon:[1-3](?::bak)?|racon_v1(?:_bak)?)$/},
 'tc-sim': {primary:/^(?:tariklab::tc-sim:[1-3]|tc-sim-save)$/, evidence:/^(?:tariklab::tc-sim:[1-3](?::bak)?|tc-sim-save(?:-backup)?)$/},
 hanedanian: {primary:/^idb:hanedanian:manual$/, evidence:/^idb:hanedanian:manual$/},
 'son-100-gun': {primary:/^tariklab\.son100\.pov\.v1\.slot[1-3]$/, evidence:/^(?:tariklab\.son100\.pov\.v1\.slot[1-3]|tariklab\.nextwave\.son-100-gun\.slot[1-3](?:\.backup)?)$/},
 'amiral-batti': {primary:/^tariklab\.amiral-batti\.match$/, evidence:/^tariklab\.amiral-batti\.(?:match|stats)$/},
 'jitem-derin-ag': {primary:/^jitem-derin-ag-v3$/, evidence:/^jitem-derin-ag-v3(?::bak)?$/},
 'peg-solitaire': {primary:null,evidence:/^tlab\.tektas\.v1$/},
 labirent: {primary:null,evidence:/^tlab\.labirent\.v1$/},
 satranc: {primary:null,evidence:/$a/},
};
for(const game of ['apartman','tc-sim-devlet','kayip-telefon','son-kasaba']){
 const prefix=game.replaceAll('-','\\-');
 SAVE_POLICIES[game]={primary:new RegExp(`^tariklab\\.nextwave\\.${prefix}\\.slot[1-3]$`),evidence:new RegExp(`^tariklab\\.nextwave\\.${prefix}\\.slot[1-3](?:\\.backup)?$`)};
}
for(const game of ['veto-h','gett-oh'])SAVE_POLICIES[game]={primary:new RegExp(`^tariklab\\.${game}\\.duel$`),evidence:new RegExp(`^tariklab\\.${game}\\.duel(?:\\.backup)?$`)};
function savePolicy(game){assert.ok(Object.hasOwn(SAVE_POLICIES,game),`missing authored save policy: ${game}`);return SAVE_POLICIES[game];}
export function readSaveEvidence(game,entries) {
 const policy=savePolicy(game);
 return Object.fromEntries(Object.entries(entries).filter(([key])=>policy.evidence.test(key)).map(([key,raw])=>{
  let data;try{data=stableSave(JSON.parse(raw),game);}catch{data=raw;}
  return [key,data];
 }));
}
export function assertPreparedSave(game,evidence){
 const policy=savePolicy(game);
 if(!policy.primary)return {required:false,reason:game==='satranc'?'no resumable save':'score-only persistence'};
 const primary=Object.entries(evidence).filter(([key,value])=>policy.primary.test(key)&&value&&typeof value==='object'&&Object.keys(value).length>0);
 assert.ok(primary.length>0,`real new-game flow must create nonempty primary saved progress: ${game}`);
 return {required:true,primaryKeys:primary.map(([key])=>key)};
}
export function assertSavedProgress(before,after) {
  for(const [key,value] of Object.entries(before)) {
    assert.ok(Object.hasOwn(after,key),`offline reload lost save ${key}`);
    assert.deepEqual(after[key],value,`offline reload changed saved progress ${key}`);
  }
}
