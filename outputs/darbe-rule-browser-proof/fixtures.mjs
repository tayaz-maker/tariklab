// Synthetic test saves only. Production data and engine are imported unchanged.
import assert from 'node:assert/strict';
import { fixture, place, act, decisions } from '../../scripts/duel-fixture.mjs';
import { pools } from '../../scripts/duel-pools.mjs';
import { legalActions } from '../../public/games/duel-core/actions.js';
import { validateState, locate } from '../../public/games/duel-core/model.js';
import { serialize, deserialize, saveKey } from '../../public/games/duel-core/save.js';

export const KEY = saveKey('darbe-h');
export const CASES = [
  { id: 'DRB-237', materials: ['DRB-005', 'DRB-006'], cost: 900 },
  { id: 'DRB-238', materials: ['DRB-007', 'DRB-008'], cost: 1000 },
  { id: 'DRB-239', materials: ['DRB-009', 'DRB-010'], cost: 1100 },
  { id: 'DRB-240', materials: ['DRB-011', 'DRB-012'], cost: 1200 },
];
export function decode(raw) {
  const result = deserialize(raw, pools['darbe-h'], 'darbe-h');
  assert.equal(result.ok, true, result.error);
  assert.equal(validateState(result.state), true);
  return result.state;
}
export function buildFixture(spec) {
  const state = fixture('darbe-h');
  const boss = state.players[0].auxiliary.find(uid => state.cards[uid].id === spec.id)
    || place(state, spec.id, 0, 'auxiliary');
  const materials = spec.materials.map((id, slot) => place(state, id, 0, 'units', slot));
  const target = place(state, 'DRB-097', 1, 'support', 0);
  state.cards[target].face = 'up';
  state.cards[target].knownTo = [true, true];
  const definition = state.catalog[spec.id];
  assert.equal(definition.subtype, 'fusion', 'these cards use special material summon, not ritual');
  assert.equal(definition.costs.find(op => op.op === 'points').amount, -spec.cost);
  assert.equal(state.players[0].points, 8000);
  assert.equal(validateState(state), true);
  const plans = legalActions(state, 0).filter(a => a.type === 'special' && a.card === boss);
  assert.equal(plans.length, 1, 'one valid material combination for the public UI');
  const special = plans[0];
  assert.ok(special, 'real legalActions offers a special summon into an empty slot');
  assert.deepEqual([...special.materials].sort(), [...materials].sort());
  const raw = serialize(state);
  const loaded = decode(raw);
  assert.equal(serialize(loaded), raw, 'exact checksum-envelope round trip');
  return { ...spec, name: definition.name, sourceText: definition.text, boss, materials, target,
    materialIds: spec.materials, raw, special, state };
}
export function verifyStage(state, fixture, stage) {
  const { boss, target, materials, cost } = fixture;
  assert.equal(validateState(state), true);
  assert.equal(state.active, 0);
  assert.equal(state.turn, 3);
  assert.equal(state.phase, 'main1');
  assert.equal(state.result, null);
  assert.equal(state.players[1].points, 8000);
  if (stage === 'before') {
    assert.equal(locate(state, boss).zone, 'auxiliary');
    materials.forEach(uid => assert.equal(locate(state, uid).zone, 'units'));
  } else {
    assert.equal(locate(state, boss).zone, 'units');
    materials.forEach(uid => assert.equal(locate(state, uid).zone, 'grave'));
    assert.equal(state.players[0].normalUsed, 0);
  }
  assert.equal(state.players[0].points, ['choice', 'after'].includes(stage) ? 8000 - cost : 8000);
  assert.equal(locate(state, target).zone, stage === 'after' ? 'hand' : 'support');
  assert.equal(locate(state, target).player, 1);
  if (stage === 'choice') {
    assert.deepEqual(state.choice.ids, [target]);
    assert.equal(state.choice.player, 0);
  }
  if (stage === 'after') {
    assert.equal(state.choice, null);
    assert.equal(state.pending, null);
    assert.equal(state.cards[boss].used.activate, state.turn);
  }
  return { revision: state.revision, points: state.players.map(p => p.points),
    boss: locate(state, boss), target: locate(state, target),
    materials: materials.map(uid => locate(state, uid)), choice: state.choice, pending: state.pending };
}
export function nodeCounterproof(fixture) {
  let state = decode(fixture.raw);
  const stages = { before: verifyStage(state, fixture, 'before') };
  state = decisions(act(state, fixture.special));
  stages.summoned = verifyStage(state, fixture, 'summoned');
  state = decode(serialize(state));
  const activation = legalActions(state, 0).find(a => a.type === 'activate' && a.card === fixture.boss);
  assert.ok(activation);
  state = act(state, activation);
  // No automatic target selection: preserve and reload the exact pending choice.
  while (state.pending && !state.choice) state = act(state, { type: 'pass' });
  stages.choice = verifyStage(state, fixture, 'choice');
  state = decode(serialize(state));
  const choose = legalActions(state, 0).find(a => a.type === 'choose' && a.targets?.includes(fixture.target));
  assert.ok(choose);
  state = decisions(act(state, choose));
  stages.after = verifyStage(decode(serialize(state)), fixture, 'after');
  return stages;
}
