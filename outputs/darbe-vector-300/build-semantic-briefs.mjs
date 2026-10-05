import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const here=fileURLToPath(new URL('./',import.meta.url));
const root=resolve(here,'../..');
const hash=(b)=>createHash('sha256').update(b).digest('hex');
const sourcePath='public/games/darbe-h/source-cards.json';
const expectedSourceHash='222916020ef176ced6ad72d4c61038bf045757e7ae9d7a6bfa6d8f99c657f3f9';
const sourceBytes=readFileSync(resolve(root,sourcePath));
assert.equal(hash(sourceBytes),expectedSourceHash,'Immutable source changed; review rather than regenerating silently.');
const cards=JSON.parse(sourceBytes);
assert.equal(cards.length,300);
const files=['briefs-001-150.tsv','briefs-151-240.tsv','briefs-241-300.tsv'];
const classes=new Set(['character','object','location','event','institution','action']);
const authored=new Map();
for(const file of files){
 for(const row of readFileSync(resolve(here,file),'utf8').trim().split('\n')){
  const fields=row.split(row.includes('\t')?'\t':'|');
  assert.equal(fields.length,7,`Malformed authored row: ${file}: ${row}`);
  const [number,sceneClass,subject,action,setting,composition,effectLink]=fields;
  const id=`DRB-${number.padStart(3,'0')}`;
  assert(!authored.has(id),`Duplicate authored brief ${id}`);
  assert(classes.has(sceneClass));
  for(const field of [subject,action,setting,composition,effectLink])assert(field.trim().length>=8);
  authored.set(id,{sceneClass,subject,action,setting,composition,effectLink,authoredInput:file});
 }
}
assert.equal(authored.size,300);
const ruleBlockers=new Set(['DRB-237','DRB-238','DRB-239','DRB-240']);
const entries=cards.map(card=>{
 const brief=authored.get(card.id);assert(brief,`Missing ${card.id}`);
 return {card,sourceCardSha256:hash(JSON.stringify(card)),brief,status:'SEMANTIC_DRAFT_ONLY',artAccepted:false,artAsset:null,
  ruleStatus:ruleBlockers.has(card.id)?'P1_TRIGGER_REPRO_REQUIRED_SEPARATE_RULE_FIX':'SOURCE_TEXT_PRESERVED_NOT_A_GAMEPLAY_REVIEW',
  review:{owner:'Astra',semanticReview:'AUTHOR_DRAFT_FROM_ACTUAL_CARD_NOT_APPROVED',visualReview:'NOT_CREATED',cropReview:'NOT_RUN',anatomyReview:'NOT_RUN',productionEligible:false},
 };
});
const counts={};for(const {brief} of entries)counts[brief.sceneClass]=(counts[brief.sceneClass]??0)+1;
const manifest={version:1,game:'DARBE-H!',purpose:'PREPARATION_ONLY_NOT_300_ACCEPTED_ART',baseCommit:'a534289490f502f68e12d91803fbc3883de7d790',
 source:{path:sourcePath,sha256:expectedSourceHash,count:cards.length},
 authoredInputs:files.map(path=>({path,sha256:hash(readFileSync(resolve(here,path)))})),
 generation:{script:'build-semantic-briefs.mjs',sha256:hash(readFileSync(fileURLToPath(import.meta.url))),method:'300 explicitly authored rows joined by exact ID; no name regex creates scene briefs'},
 acceptance:{semanticRows:300,acceptedArt:0,totalCards:300,qualityGate:'BLOCKED_BY_FAILED_DRB_001_VECTOR_PROBE',distribution:counts,unresolvedMissingBriefs:[],unverifiedRuleIds:[...ruleBlockers]},
 constraints:{medium:'ORIGINAL_PROCEDURAL_SVG_VECTOR_LAYERED_GEOMETRY_ONLY',forbidden:['AI-generated plates','raster embeds','external art','tracing reference pixels/composition','real people/institutions/parties/emblems','military insignia/uniforms','weapons/violence aesthetics','text, slogans or gibberish inside illustration'],
  preserved:'All source card fields, balance, deck relations, shared engine, save, localization, accessible text, card dimensions and behavior remain untouched.',
  civilianInterpretation:'Eri, Karargâh and similar source names are retained verbatim in data; scenes depict ordinary adult civilian administrative work, not soldiers or real institutions.',
  effects:'KP and card movement are planning metaphors for work capacity and file movement, never asserted as literal mechanics, monetary rewards or actual suffering. Existing UI explains exact effects.',
  characterDiversity:'At asset stage author distinct adult faces/body types/ages/clothes and hand poses per ID. Never recolor a shared person. This manifest does not claim faces have been produced or checked.',
  crop:'Existing manifest 400×560, card size and center 38% cover behavior unchanged. Per-card action/prop crop must pass 320/390/1440 before any acceptance; no probe imported into production.',
 },cards:entries};
writeFileSync(resolve(here,'semantic-art-briefs.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.acceptance));
