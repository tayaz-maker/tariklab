import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildManifest, protectedSourceSha256 } from './build-semantic-briefs.mjs';
const sourceBytes=readFileSync(new URL('../../public/games/veto-h/source-cards.json',import.meta.url));
const source=JSON.parse(sourceBytes);
const saved=JSON.parse(readFileSync(new URL('./semantic-art-briefs.json',import.meta.url)));

test('canonical 300-card source and every original field are preserved exactly',()=>{
  assert.equal(createHash('sha256').update(sourceBytes).digest('hex'),protectedSourceSha256);
  assert.equal(saved.cards.length,300);
  assert.deepEqual(saved.cards.map(e=>e.source),source);
  assert.deepEqual(saved.cards.map(e=>e.id),source.map(e=>e.id));
  assert.equal(new Set(saved.cards.map(e=>e.id)).size,300);
});

test('all300 explicit semantic rows have concrete subjects, settings, effect relationships and valid scene classes',()=>{
  const allowed=new Set(['character','object','location','event','institution','action']);
  for(const entry of saved.cards){
    assert.ok(allowed.has(entry.sceneClass),entry.id);
    assert.ok(entry.subjectAction.length>=35,entry.id);
    assert.ok(entry.setting.length>=12,entry.id);
    assert.ok(entry.effectRelationship.description.length>=20,entry.id);
    assert.equal(entry.effectRelationship.mechanicalAuthority,'source.text');
    assert.equal(entry.effectRelationship.kind,'visual_metaphor_not_rule_rewrite');
    assert.equal(entry.sourceRecordSha256,createHash('sha256').update(JSON.stringify(entry.source)).digest('hex'));
  }
  assert.equal(new Set(saved.cards.map(e=>e.subjectAction)).size,300);
  assert.equal(new Set(saved.cards.map(e=>e.setting)).size,300);
});

test('measured distribution is accurate and no camera category dominates the plan',()=>{
  const count=key=>saved.cards.reduce((counts,e)=>(counts[e[key]]=(counts[e[key]]??0)+1,counts),{});
  assert.deepEqual(saved.coverage.sceneClasses,count('sceneClass'));
  assert.deepEqual(saved.coverage.compositions,count('composition'));
  assert.ok(Object.keys(saved.coverage.sceneClasses).length===6);
  assert.ok(Object.keys(saved.coverage.compositions).length>=12);
  assert.ok(Math.max(...Object.values(saved.coverage.compositions))<=40);
});

test('preparation cannot masquerade as completed, approved or tested production art',()=>{
  assert.equal(saved.status,'ART_PREPARATION_ONLY');
  assert.equal(saved.reviewStatus,'AUTHOR_DRAFT');
  assert.equal(saved.production.completedCards,0);
  assert.equal(saved.production.approvedCards,0);
  assert.equal(saved.production.publishedCards,0);
  assert.equal(saved.production.PR,null);
  for(const entry of saved.cards){
    assert.equal(entry.implementationStatus,'PLANNED_NOT_DRAWN');
    assert.equal(entry.qualityGate,'BLOCKED_BY_FAILED_VECTOR_REALISM_PROBE');
    assert.equal(entry.reviewStatus,entry.unresolved?'SEMANTIC_REVIEW_REQUIRED':'ASSISTANT_BRIEF_ONLY_NOT_ART_APPROVAL');
  }
  assert.deepEqual(saved.coverage.unresolvedIds,saved.cards.filter(e=>e.unresolved).map(e=>e.id));
  assert.equal(saved.coverage.unresolvedIds.length,3);
  assert.equal(saved.constraints.noImageGeneration,true);
  assert.equal(saved.constraints.noRasterPlate,true);
  assert.deepEqual(saved.constraints.intrinsicArtDimensions,[576,384]);
});

test('13 source-grounding records keep exact evidence and separate10bounded interpretations from3real ambiguities',()=>{
  const records=saved.cards.filter(e=>e.sourceGrounding);
  assert.equal(records.length,13);
  assert.deepEqual(saved.coverage.sourceGrounding.reviewedIds,records.map(e=>e.id));
  assert.equal(saved.coverage.sourceGrounding.sourceBoundedCount,10);
  assert.equal(saved.coverage.sourceGrounding.unresolvedCount,3);
  assert.equal(saved.coverage.sourceGrounding.artApprovedCount,0);
  assert.deepEqual(saved.coverage.unresolvedIds,['SND-017','SND-046','SND-132']);
  for(const entry of records){
    const g=entry.sourceGrounding;
    assert.deepEqual(g.evidence,{name:entry.source.name,kind:entry.source.kind,subtype:entry.source.subtype,effectText:entry.source.text});
    assert.equal(g.disposition,entry.unresolved?'UNRESOLVED_SOURCE_AMBIGUITY':'SOURCE_BOUNDED_NOT_ART_APPROVED');
    for(const key of ['sourceFacts','visualInterpretation','notImpliedBySource'])assert.ok(g[key].length>30,`${entry.id}:${key}`);
    assert.ok(g.retainedConstraints.length>=2,entry.id);
    assert.equal(entry.implementationStatus,'PLANNED_NOT_DRAWN');
  }
  // The exact undefined term remains untouched; the brief must not silently rewrite the card.
  assert.ok(saved.cards.find(e=>e.id==='SND-017').source.text.includes('“Sandık” yemini'));
  assert.equal(source.some(c=>c.name==='Sandık Yemini'),false);
});

test('manifest regenerates byte-for-byte without random scene assignments',()=>{
  assert.deepEqual(saved,buildManifest());
  assert.equal(JSON.stringify(buildManifest()),JSON.stringify(buildManifest()));
});
