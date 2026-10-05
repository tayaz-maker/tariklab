import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildManifest, sourceUrl, SOURCE_SHA } from './build-semantic-manifest.mjs';
import { designs } from '../../public/games/gett-oh/designs.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = readFileSync(sourceUrl);
const cards = JSON.parse(source);
const artifact = JSON.parse(readFileSync(new URL('./semantic-art-briefs.json', import.meta.url)));

test('immutable 300-card source, IDs and every mechanical/localization field survive preparation verbatim', () => {
  assert.equal(hash(source), SOURCE_SHA);
  assert.equal(cards.length,300);
  assert.deepEqual(artifact.briefs.map(b=>b.sourceCard),cards);
  assert.deepEqual(artifact.briefs.map(b=>b.id), cards.map(c=>c.id));
  assert.equal(new Set(artifact.briefs.map(b=>b.id)).size,300);
});

test('all 300 explicit semantic briefs are complete and output is deterministic, not accepted artwork', () => {
  assert.deepEqual(buildManifest(),artifact);
  assert.deepEqual(buildManifest(),buildManifest());
  assert.equal(artifact.preparation,true);
  assert.equal(artifact.acceptedArtCount,0);
  const signatures = new Set();
  const classes = new Set();
  for(const brief of artifact.briefs){
    assert.equal(brief.accepted,false);
    assert.equal(brief.status,'BRIEF_ONLY_NOT_ACCEPTED_ART');
    assert.deepEqual(brief.illustrationDimensions,[400,300]);
    classes.add(brief.sceneClass);
    for(const key of ['subjects','actionAndEffectBridge','setting','composition']) {
      assert.ok(brief[key].length>=20,`${brief.id}.${key}`);
      assert.doesNotMatch(brief[key],/TODO|TBD|placeholder|generic scene/i);
    }
    signatures.add([brief.subjects,brief.actionAndEffectBridge,brief.setting,brief.composition].join('|'));
  }
  assert.equal(signatures.size,300);
  assert.deepEqual([...classes].sort(),['action','character','event','institution','location','object']);
  assert.equal(hash(readFileSync(sourceUrl)),SOURCE_SHA);
});

test('ambiguous source semantics stay explicit instead of being silently repaired by art planning', () => {
  const byId=Object.fromEntries(artifact.briefs.map(b=>[b.id,b]));
  assert.equal(byId['RCN-147'].sourceCard.name,'Zabıta Yoldı');
  assert.equal(byId['RCN-090'].sourceCard.kind,'unit');
  assert.equal(byId['RCN-239'].sourceCard.series,'Borç');
  for(const id of ['RCN-094','RCN-095','RCN-119','RCN-135','RCN-140'])
    assert.ok(byId[id].unresolved.length,id);
  for(const id of ['RCN-010','RCN-037','RCN-090']) {
    assert.equal(byId[id].interpretationReview.status,'RESOLVED_BRIEF_INTERPRETATION_ONLY');
    assert.deepEqual(byId[id].unresolved,[]);
  }
  for(const id of ['RCN-010','RCN-037','RCN-090','RCN-094','RCN-095','RCN-119','RCN-135','RCN-140']) {
    const review=byId[id].interpretationReview.authorDraftReview;
    assert.equal(review.status,'AUTHOR_DRAFT');
    assert.equal(review.drawingStatus,'PLANNED_NOT_DRAWN');
    assert.equal(review.artAccepted,false);
    assert.equal(review.humanApproval,false);
    assert.equal(review.engineEvidenceStatus,'SOURCE_INSPECTED_NOT_RUNTIME_TESTED');
  }
  assert.equal(byId['RCN-147'].interpretationReview.sourceFacts.name,'Zabıta Yoldı');
  assert.equal(byId['RCN-149'].interpretationReview.status,'RESOLVED_BRIEF_INTERPRETATION_ONLY');
  assert.equal(byId['RCN-239'].interpretationReview.status,'RESOLVED_BRIEF_INTERPRETATION_ONLY');
  assert.equal(byId['RCN-035'].sceneClass,'location');
  assert.equal(byId['RCN-044'].sceneClass,'location');
  assert.equal(byId['RCN-059'].sceneClass,'location');
  assert.equal(byId['RCN-076'].sceneClass,'object');
});

test('all 30 dispositions separate immutable rule facts from nonliteral scenes and retain genuine open questions', () => {
  const reviewed=artifact.briefs.filter(b=>b.interpretationReview);
  assert.equal(reviewed.length,30);
  assert.deepEqual(artifact.interpretationReviewSummary,{reviewed:30,resolvedAtBriefLevel:25,open:5,noArtworkOrHumanApproval:true});
  for(const b of reviewed){
    const r=b.interpretationReview,c=b.sourceCard;
    assert.deepEqual(r.sourceFacts,{name:c.name,kind:c.kind,subtype:c.subtype,series:c.series,effectText:c.text});
    assert.equal(r.artAccepted,false);
    assert.equal(r.humanApproval,false);
    assert.ok(r.proposedSceneInterpretation.length>30);
    assert.ok(r.groundedDisposition.length>30);
    assert.ok(r.noMechanicalClaim.length>30);
    assert.equal(Boolean(r.openQuestion),b.unresolved.length>0);
  }
  assert.equal(designs[90].traits.ritualEnabler,true);
  assert.equal(designs[90].effects[0].op,'ritual');
  assert.equal(designs[10].triggers[0].event,'summon');
  assert.equal(designs[10].triggers[0].effects[0].selector.kind,'trap');
  assert.equal(designs[37].triggers[0].event,'battle-kill');
  assert.equal(designs[37].triggers[0].effects[0].random,true);
  assert.deepEqual(designs[94].effects[1].value,{attack:800,endGrave:true});
  assert.equal(designs[95].effects[0].selector.owner,'both');
  assert.equal(designs[95].effects[1].op,'move');
  assert.equal(designs[119].effects[0].selector.owner,'opponent');
  assert.deepEqual(designs[119].effects[1].value,{defense:-800});
  assert.deepEqual(designs[135].traits.responseTypes,['battle-start']);
  assert.equal(designs[140].effects[0].selector.owner,'both');
  assert.deepEqual(designs[140].effects[1].value,{cannotAttack:true});
  assert.equal(designs[140].effects[2].op,'draw');
  assert.equal(designs[149].effects[0].op,'targetOrBattleNegate');
  assert.deepEqual(designs[239].traits.materials.series,['Borç','Haber']);
  assert.equal(designs[239].effects[0].amount,-1100);
  assert.equal(designs[239].effects[1].selector.face,'up');
  assert.equal(designs[239].effects[2].to,'hand');
});

test('missing explicit direction fails closed rather than filling an ID with a generic template', () => {
  assert.throws(()=>buildManifest('001|character|adult|action|setting|camera'),/300 explicit/);
});
