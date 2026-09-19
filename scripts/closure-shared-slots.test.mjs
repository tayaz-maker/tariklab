import test from 'node:test';
import assert from 'node:assert/strict';
import { loadStrategy } from './strategy-harness.mjs';
import { loadGame } from './racon-harness.mjs';

test('Hanedan actual saves roundtrip between slot 1 and 2', () => {
  const g = loadStrategy('public/games/hanedan/legacy.html');
  for (const n of [1, 2]) g.ev(`bindHanedanSlot(${n}); S=newState("klasik","Slot${n}",{r:0,d:0},[],42); S.kasa=${n * 10000}; saveNow();`);
  for (const n of [1, 2]) {
    g.ev(`bindHanedanSlot(${n}); S=loadSave();`);
    assert.equal(g.ev('S.name'), `Slot${n}`);
    assert.equal(g.ev('S.kasa'), n * 10000);
  }
});

test('Bukucu actual saves roundtrip between slot 1 and 2', () => {
  const g = loadStrategy('public/games/bukucu/index.html');
  for (const n of [1, 2]) g.ev(`bindBukucuSlot(${n}); newGame("hotseat",2); S.cash[0]=${n * 1000}; persist();`);
  for (const n of [1, 2]) {
    g.ev(`bindBukucuSlot(${n}); S=migrate(JSON.parse(loadRaw()));`);
    assert.equal(g.ev('S.cash[0]'), n * 1000);
  }
});

test('Racon actual saves roundtrip between slot 1 and 2', () => {
  const g = loadGame();
  for (const n of [1, 2]) g.ev(`bindRaconSlot(${n}); blank("Slot${n}"); enterPlay(); writeSave();`);
  for (const n of [1, 2]) {
    g.ev(`bindRaconSlot(${n}); S=loadSave();`);
    assert.ok(g.ev('S'));
    assert.equal(g.ev('JSON.stringify(S)').includes(`Slot${n}`), true);
  }
});
