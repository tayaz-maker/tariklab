import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CASES, buildFixture, nodeCounterproof, decode } from './fixtures.mjs';
import { rejection } from '../../public/games/duel-core/rules.js';
import { verifyProductionUnchanged } from '../darbe-rule-ci/production-guard.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
for (const spec of CASES) {
  test(`${spec.id}: legal material summon, exact KP cost, target return and checksum reload`, () => {
    const fixture = buildFixture(spec);
    const stages = nodeCounterproof(fixture);
    assert.equal(stages.after.points[0], 8000 - spec.cost);
    assert.equal(stages.after.target.zone, 'hand');
    assert.equal(stages.after.target.player, 1);
    // Negative material control: same card IDs in hand do not satisfy on-field condition.
    const bad = decode(fixture.raw);
    for (const uid of fixture.materials) {
      bad.players[0].units[bad.players[0].units.indexOf(uid)] = null;
      bad.players[0].hand.push(uid);
    }
    assert.ok(rejection(bad, fixture.special));
  });
}
test('all duel production file inventories and blobs remain identical to 9e50404', () => {
  assert.ok(verifyProductionUnchanged(repo) > 600);
});
