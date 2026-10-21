import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewGame } from '../public/games/tc-sim/js/state.js';
import { CLOSED_LIFE_CASE_LIMIT, processLifetimeWeek } from '../public/games/tc-sim/js/lifetime.js';

function caseHistory(age) {
  const state = createNewGame({ seed: 17 });
  state.player.age = age;
  state.openCases = [
    ...Array.from({ length: 130 }, (_, i) => ({ id: `closed-${i}`, type: 'social-obligation', status: 'resolved', payload: { reason: `history-${i}` } })),
    { id: 'pending-live', type: 'social-obligation', status: 'pending', payload: { reason: 'still owed' } },
    { id: 'triggered-live', type: 'social-obligation', status: 'triggered', payload: { reason: 'player choice' } },
  ];
  return state;
}

test('age 70 preserves existing closed history and every live obligation', () => {
  const state = caseHistory(70), before = structuredClone(state.openCases);
  processLifetimeWeek(state);
  assert.deepEqual(state.openCases, before);
});

test('after age 70 retention keeps exactly the newest 128 closed records and all live cases', () => {
  assert.equal(CLOSED_LIFE_CASE_LIMIT, 128);
  const state = caseHistory(71), live = structuredClone(state.openCases.slice(-2));
  processLifetimeWeek(state);
  assert.deepEqual(state.openCases.filter(c => c.status === 'resolved').map(c => c.id),
    Array.from({ length: 128 }, (_, i) => `closed-${i + 2}`));
  assert.deepEqual(state.openCases.filter(c => c.status !== 'resolved'), live);
  const once = structuredClone(state.openCases);
  processLifetimeWeek(state);
  assert.deepEqual(state.openCases, once);
});

test('terminal closure keeps the final live cases after pruning and never replays cleanup', () => {
  const state = caseHistory(98);
  processLifetimeWeek(state);
  assert.ok(state.lifetime.death);
  assert.equal(state.openCases.length, 130);
  assert.ok(state.openCases.every(c => c.status === 'resolved'));
  assert.deepEqual(state.openCases.slice(-2).map(c => c.id), ['pending-live', 'triggered-live']);
  const terminal = JSON.stringify(state);
  processLifetimeWeek(state);
  assert.equal(JSON.stringify(state), terminal);
});
