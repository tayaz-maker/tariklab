import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildManifest, sourceUrl, SOURCE_SHA } from './build-semantic-manifest.mjs';

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
  for(const id of ['RCN-010','RCN-090','RCN-094','RCN-095','RCN-135','RCN-140','RCN-147','RCN-149','RCN-239'])
    assert.ok(byId[id].unresolved.length,id);
  assert.equal(byId['RCN-035'].sceneClass,'location');
  assert.equal(byId['RCN-044'].sceneClass,'location');
  assert.equal(byId['RCN-059'].sceneClass,'location');
  assert.equal(byId['RCN-076'].sceneClass,'object');
});

test('missing explicit direction fails closed rather than filling an ID with a generic template', () => {
  assert.throws(()=>buildManifest('001|character|adult|action|setting|camera'),/300 explicit/);
});
