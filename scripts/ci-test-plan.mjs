import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

// Exhaustive population studies run unchanged in ci-full-regression nightly/manual.
// Boundary, migration, save, authored-content and rule tests in these files still run here.
export const EXTENDED_NAMES = [
  '40 seeds x 16 strategies x 720 weeks closes natural content reachability',
  '20x8 age 18–82 density: authored 65–75 and 75+ are non-zero',
];
export function owner(file) {
  if (/^(?:wave5-tc-sim-devlet|tc-sim-devlet)/.test(file)) return 'tc-sim-devlet';
  if (/^(?:tc-sim|wave4-tc-sim)/.test(file)) return 'tc-sim';
  if (/^(?:duel|darbe-h|veto-h|gett-oh)/.test(file)) return 'duel';
  for (const id of ['racon','hanedanian','ihtilal','esik','atlas','cete'])
    if (file.startsWith(id+'-') || file === id+'.test.mjs') return id;
  return null; // Unowned/shared tests are always critical, never silently omitted.
}
export function plan(files,{full=true,routes=[],shard=0,shards=4}={}) {
  if (!Number.isInteger(shard)||!Number.isInteger(shards)||shards<1||shard<0||shard>=shards)
    throw new Error('Invalid unit shard');
  const selected=new Set(routes);
  if(['veto-h','gett-oh','darbe-h'].some(id=>selected.has(id)))selected.add('duel');
  if(selected.has('cete-savaslari'))selected.add('cete');
  return [...files].sort().filter(file => {
    const game=owner(file);
    if (!full && game && !selected.has(game)) return false;
    let hash=0;for(const c of file) hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
    return hash%shards===shard;
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const shard=Number(process.env.CI_SHARD),full=process.env.CI_FULL==='true';
  const files=plan(readdirSync('scripts').filter(f=>f.endsWith('.test.mjs')),
    {full,routes:(process.env.CI_ROUTES||'').split(',').filter(Boolean),shard});
  console.log(JSON.stringify({full,shard,files,nightlyOnly:EXTENDED_NAMES}));
  const run=args=>{const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1);};
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(files.length)run(['--test',`--test-skip-pattern=^(?:${EXTENDED_NAMES.map(escape).join('|')})$`,...files.map(f=>'scripts/'+f)]);
  if(shard===0)run(['--experimental-strip-types','--import','./scripts/ts-alias.mjs','--test',
    'src/lib/app-data/app-data.test.ts','src/lib/auth/gate-identity.test.ts','src/lib/auth/preview-secret.test.ts',
    'src/game/formulas.test.ts','src/game/clock.test.ts','src/game/closure.test.ts','src/game/outcome-moment.test.ts','src/lib/save-slots.test.ts']);
}
