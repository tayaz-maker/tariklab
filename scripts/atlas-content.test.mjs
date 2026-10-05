import test from 'node:test';
import assert from 'node:assert/strict';
import { FOUNDATION } from '../public/atlas/yapi/content.js';
import { validateFoundation, LOCALES, STRUCTURE_IDS, REQUIRED_NOTICES } from '../public/atlas/yapi/content-schema.js';

const copy = () => structuredClone(FOUNDATION);
const rejects = (mutate, expected) => {
  const value = copy();
  mutate(value);
  const result = validateFoundation(value);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes(expected)), result.errors.join('\n'));
};

test('Atlas offline-serializable foundation contains exactly seven skeletal groups and six organ examples', () => {
  const restored = JSON.parse(JSON.stringify(FOUNDATION));
  assert.deepEqual(validateFoundation(restored), { valid: true, errors: [] });
  assert.deepEqual(restored.structures.map(item => item.id), STRUCTURE_IDS);
  assert.equal(restored.structures.filter(item => item.systems[0] === 'skeleton').length, 7);
  assert.equal(restored.structures.filter(item => item.systems[0] === 'organs').length, 6);
  assert.deepEqual(restored.systems.map(item => item.id), ['surface', 'skeleton', 'organs']);
});

test('Atlas every displayed anatomical field has known sources and explicit unreviewed metadata', () => {
  const ids = new Set(FOUNDATION.sources.map(source => source.id));
  for (const item of [...FOUNDATION.structures, ...FOUNDATION.systems]) {
    assert.equal(item.review.status, 'NOT_REVIEWED');
    assert.equal(item.releaseEligible, false);
    assert.equal(item.review.reviewer, null);
    assert.equal(item.review.reviewedAt, null);
    assert.equal(item.review.contentHash, null);
    assert.equal(item.review.geometryHash, null);
    for (const refs of Object.values(item.fieldSources)) assert.ok(refs.length > 0 && refs.every(id => ids.has(id)));
  }
  rejects(value => { delete value.structures[0].fieldSources.label; }, 'fieldSources.label');
  rejects(value => { value.structures[0].fieldSources.description = ['fabricated-source']; }, 'fieldSources.description');
  rejects(value => { value.systems[0].sourceRefs = []; }, 'sourceRefs');
});

test('Atlas required notices and structure text exist in TR/EN/PL, including offline JSON', () => {
  for (const locale of LOCALES) {
    for (const name of REQUIRED_NOTICES) assert.ok(FOUNDATION.notices[name][locale].trim());
    for (const item of FOUNDATION.structures) {
      for (const field of ['label', 'description', 'function', 'location', 'uncertainty']) assert.ok(item[field][locale].trim());
      assert.ok(item.searchTerms[locale].length > 0);
    }
  }
  rejects(value => { delete value.notices.draft.pl; }, 'notices.draft.pl');
  rejects(value => { value.structures[12].description.en = ''; }, 'description.en');
  rejects(value => { value.structures[4].searchTerms.tr = []; }, 'searchTerms.tr');
});

test('Atlas does not silently replace source date with access date or invent month-day precision', () => {
  for (const item of FOUNDATION.sources.filter(source => source.id.startsWith('nci-'))) {
    assert.equal(item.sourceDate, null);
    assert.equal(item.datePrecision, null);
    assert.equal(item.dateKind, null);
    assert.equal(item.accessedAt, '2026-10-05');
  }
  assert.equal(FOUNDATION.sources.find(source => source.id === 'niddk-kidneys').sourceDate, '2018-06');
  assert.equal(FOUNDATION.sources.find(source => source.id === 'niddk-digestion').sourceDate, '2017-12');
  rejects(value => { value.sources[0].datePrecision = 'day'; }, 'unknown date');
  rejects(value => { value.sources[8].datePrecision = 'day'; }, 'recorded precision');
  rejects(value => { value.sources[6].sourceDate = '2022-02-30'; }, 'recorded precision');
  rejects(value => { value.sources[0].accessedAt = '2026-02-30'; }, 'real calendar date');
  rejects(value => { value.sources[6].sourceDate = '2027-01-01'; }, 'cannot postdate');
});

test('Atlas v1 cannot promote model-authored drafts to expert-approved content', () => {
  rejects(value => { value.releaseEligible = true; }, 'releaseEligible=false');
  rejects(value => { value.structures[0].review.status = 'APPROVED'; }, 'NOT_REVIEWED');
  rejects(value => { value.systems[0].review.reviewer = 'model'; }, 'review.reviewer');
  rejects(value => { value.structures[0].review.geometryHash = 'fake-approval'; }, 'review.geometryHash');
  rejects(value => { value.publicationMode = 'CLINICAL_ATLAS'; }, 'draft learning preview');
});

test('Atlas contractual education, scope and accuracy notices cannot be silently weakened', () => {
  assert.equal(FOUNDATION.notices.scope.tr, 'Tam anatomi sistemleri daha sonra ayrı içerik dalgalarında eklenecek.');
  assert.equal(FOUNDATION.notices.education.tr, 'Eğitim amaçlıdır; kişisel tıbbi tavsiye, tanı veya tedavi aracı değildir.');
  for (const name of ['education', 'scope', 'accuracy']) rejects(value => { value.notices[name].tr = 'Onaylı tam atlas'; }, 'required publication notice altered');
  rejects(value => { delete value.notices.polishReview; }, 'notices.polishReview');
});

test('Atlas schema rejects missing or repeated semantic IDs and wrong layer assignment', () => {
  rejects(value => { value.structures.pop(); }, '13 stable');
  rejects(value => { value.structures[1].id = 'skull'; }, '13 stable');
  rejects(value => { value.structures[0].systems = ['organs']; }, 'layer does not match');
  rejects(value => { value.systems[0].id = 'complete-skin-system'; }, 'required exactly once');
});

test('Atlas factual links use primary HTTPS sources; links do not grant image rights or endorsement', () => {
  for (const source of FOUNDATION.sources) {
    assert.equal(source.owner, 'Astra');
    assert.ok(source.claim.tr && source.claim.en && source.claim.pl);
  }
  rejects(value => { value.sources[0].url = 'https://unknown.example/model.glb'; }, 'primary factual source');
  rejects(value => { value.sources[0].url = 'http://training.seer.cancer.gov/anatomy/'; }, 'primary factual source');
  rejects(value => { value.sources[0].url = 'javascript:alert(1)'; }, 'primary factual source');
  rejects(value => { value.sources[1].id = value.sources[0].id; }, 'unique source ID');
  rejects(value => { delete value.sources[0].owner; }, 'title and owner');
});

test('Atlas later systems stay explicitly deferred and current title makes no completeness claim', () => {
  assert.equal(FOUNDATION.title.tr, 'TarikLab Beden Katmanları');
  assert.ok(FOUNDATION.later.length >= 6);
  rejects(value => { value.later[0].status = 'DONE'; }, 'explicitly deferred');
  rejects(value => { value.later = []; }, 'future system plan');
});

test('Atlas validation is pure and rejects malformed offline data without throwing', () => {
  const before = JSON.stringify(FOUNDATION);
  assert.equal(validateFoundation(FOUNDATION).valid, true);
  assert.equal(JSON.stringify(FOUNDATION), before);
  for (const input of [undefined, null, false, [], {}, { version: 1 }]) assert.equal(validateFoundation(input).valid, false);
  rejects(value => { value.sources[0] = null; }, 'sources.?');
  rejects(value => { value.structures[0] = null; }, 'structures.?');
  rejects(value => { value.systems[0].sourceRefs = 7; }, 'sourceRefs');
});
