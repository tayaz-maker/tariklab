import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=fileURLToPath(new URL('./',import.meta.url));
const root=resolve(here,'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>readFileSync(resolve(root,p));
const source=JSON.parse(read('public/games/darbe-h/source-cards.json'));
const manifestPath=resolve(here,'semantic-art-briefs.json');
const manifest=JSON.parse(readFileSync(manifestPath));
const protectedFiles=JSON.parse(readFileSync(resolve(here,'protected-source-files.json')));
const expected='222916020ef176ced6ad72d4c61038bf045757e7ae9d7a6bfa6d8f99c657f3f9';
function validateCards(m){
 assert.equal(m.cards.length,300);
 assert.equal(new Set(m.cards.map(x=>x.card.id)).size,300);
 assert.deepEqual(m.cards.map(x=>x.card),source,'Every original field and order must survive unchanged.');
 for(const x of m.cards){
  assert.equal(x.sourceCardSha256,sha(JSON.stringify(x.card)));
  assert.equal(x.artAccepted,false);
  assert.equal(x.artAsset,null);
  assert.equal(x.review.productionEligible,false);
 }
 assert.equal(m.acceptance.acceptedArt,0);
}
test('source is pinned to the reviewed 300-card SHA, IDs and original fields',()=>{
 assert.equal(sha(read(manifest.source.path)),expected);
 assert.equal(manifest.source.sha256,expected);
 validateCards(manifest);
 assert.deepEqual(source.map(c=>c.id),Array.from({length:300},(_,i)=>`DRB-${String(i+1).padStart(3,'0')}`));
});
test('all 652 existing game, art, data and engine files remain unchanged',()=>{
 const tracked=execFileSync('git',['ls-files','public/games/darbe-h','public/games/duel-core'],{cwd:root,encoding:'utf8'}).trim().split('\n');
 assert.equal(tracked.length,652);
 assert.deepEqual(protectedFiles.files.map(x=>x.path),tracked);
 for(const x of protectedFiles.files)assert.equal(sha(read(x.path)),x.sha256,x.path);
 const changed=execFileSync('git',['diff','--name-only',protectedFiles.baseCommit,'--','public/games/darbe-h','public/games/duel-core'],{cwd:root,encoding:'utf8'}).trim();
 assert.equal(changed,'','No source/public change relative to pinned base.');
});
test('300 authored semantic briefs have unique complete scene specifications',()=>{
 const classes=new Set(['character','object','location','event','institution','action']);
 const specs=new Set();const distribution={};
 for(const {brief} of manifest.cards){
  assert(classes.has(brief.sceneClass));
  for(const key of ['subject','action','setting','composition','effectLink'])assert(brief[key].trim().length>=8,key);
  const key=JSON.stringify([brief.subject,brief.action,brief.setting,brief.composition]);
  assert(!specs.has(key),'Exact repeated scene specification');specs.add(key);
  distribution[brief.sceneClass]=(distribution[brief.sceneClass]??0)+1;
 }
 assert.deepEqual(distribution,manifest.acceptance.distribution);
 assert.equal(specs.size,300);
 assert.deepEqual(manifest.acceptance.unresolvedMissingBriefs,[]);
});
test('authored inputs and builder are reproducible with hashes',()=>{
 for(const x of manifest.authoredInputs)assert.equal(sha(readFileSync(resolve(here,x.path))),x.sha256,x.path);
 assert.equal(sha(readFileSync(resolve(here,manifest.generation.script))),manifest.generation.sha256);
 const before=readFileSync(manifestPath);
 execFileSync(process.execPath,[resolve(here,'build-semantic-briefs.mjs')],{cwd:root});
 assert.deepEqual(readFileSync(manifestPath),before);
});
test('preparation cannot claim art completion or close the separate fusion-rule P1',()=>{
 assert.equal(manifest.purpose,'PREPARATION_ONLY_NOT_300_ACCEPTED_ART');
 assert.equal(manifest.acceptance.qualityGate,'BLOCKED_BY_FAILED_DRB_001_VECTOR_PROBE');
 assert.deepEqual(manifest.acceptance.unverifiedRuleIds,['DRB-237','DRB-238','DRB-239','DRB-240']);
 for(const id of manifest.acceptance.unverifiedRuleIds)assert.equal(manifest.cards.find(x=>x.card.id===id).ruleStatus,'P1_TRIGGER_REPRO_REQUIRED_SEPARATE_RULE_FIX');
 assert.equal(manifest.constraints.medium,'ORIGINAL_PROCEDURAL_SVG_VECTOR_LAYERED_GEOMETRY_ONLY');
});
test('validator rejects ID, gameplay, effect and approval drift',()=>{
 for(const mutate of [m=>m.cards[1].card.id='DRB-001',m=>m.cards[0].card.attack++,m=>m.cards[0].card.text+=' Changed',m=>m.cards[0].artAccepted=true]){
  const altered=structuredClone(manifest);mutate(altered);assert.throws(()=>validateCards(altered));
 }
});
