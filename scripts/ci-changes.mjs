// Unknown/shared changes fail closed to every game; known isolated owners route narrowly.
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const games=['tc-sim-devlet','tc-sim','hanedanian','ihtilal','racon','esik','bukucu',
  'labirent','peg-solitaire','satranc','amiral-batti','apartman','kayip-telefon',
  'son-100-gun','son-kasaba'];
const duel=['duel-core','veto-h','gett-oh'];
export function classifyChanges(files) {
  const documentation=f=>/^(docs\/|(?:README|LICENSE)(?:\.(?:md|txt))?$)/.test(f)||/^(?:[^/]+|outputs\/.+)\.md$/.test(f);
  const routes=new Set();let full=files.length===0;
  for(const file of files){
    if(documentation(file))continue;
    if(/^(?:wrangler\.json|scripts\/cloudflare-deploy(?:\.test)?\.mjs)$/.test(file))continue;
    if(file==='public/games/shared/management-desk.css'||file==='scripts/management-desk.test.mjs'){
      routes.add('tc-sim');routes.add('tc-sim-devlet');continue;
    }
    let game=[...games,...duel].find(id=>file.startsWith(`public/games/${id}/`));
    if(!game){const locale=file.match(/^public\/i18n\/pl\/([^/]+)\.json$/);if(locale&&[...games,...duel].includes(locale[1]))game=locale[1];}
    if(!game&&file.startsWith('scripts/')){
      const name=file.slice(8);
      if(/^wave4-tc-sim-/.test(name))game='tc-sim';
      else if(/^wave5-tc-sim-devlet-/.test(name))game='tc-sim-devlet';
      else game=[...games,...duel,'duel'].find(id=>name.startsWith(id+'-')||name===id+'.test.mjs');
    }
    if(game){routes.add(duel.includes(game)?'duel':game);continue;}
    full=true;
  }
  const ids=full?[]:[...routes].flatMap(id=>id==='duel'?['veto-h','gett-oh']:[id]);
  return {full:String(full),docs:String(files.length>0&&files.every(documentation)),routes:ids.join(','),
    browser:String(full||routes.size>0),tc:String(full||routes.has('tc-sim')),
    devlet:String(full||routes.has('tc-sim-devlet')),duel:String(full||routes.has('duel')),
    campaign:String(full||routes.has('hanedanian')||routes.has('ihtilal')),
    balance:String(full||routes.has('hanedanian'))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [base,head]=process.argv.slice(2);if(!base||!head)throw new Error('usage: ci-changes.mjs <base> <head>');
  const files=execFileSync('git',['diff','--name-only','-z',base,head],{encoding:'utf8'}).split('\0').filter(Boolean);
  const result=Object.entries(classifyChanges(files)).map(([key,value])=>`${key}=${value}`).join('\n')+'\n';
  process.stdout.write(result);if(process.env.GITHUB_OUTPUT){const {appendFile}=await import('node:fs/promises');await appendFile(process.env.GITHUB_OUTPUT,result);}
}
