import test from 'node:test';
import assert from 'node:assert/strict';
import {packSave, unpackSave} from '../public/games/tc-sim-boardworld/save-codec.mjs';
test('lossless dictionary preserves historical prose, keys and independent copies', () => {
  const original = JSON.parse('{"__proto__":{"safe":true},"history":[{"text":"Sözünü tuttu · Łódź","day":365},{"text":"Sözünü tuttu · Łódź","day":730}],"nil":null,"flag":false}');
  const packed = packSave(original);
  assert.deepEqual(unpackSave(JSON.parse(JSON.stringify(packed))), original);
  assert.equal(packed.strings.filter(s => s === 'Sözünü tuttu · Łódź').length, 1);
  const decoded = unpackSave(packed); decoded.history[0].day = 1;
  assert.equal(original.history[0].day, 365);
  assert.equal(unpackSave(packed).history[0].day, 365);
  assert.equal(Object.prototype.safe, undefined);
});
test('decoder rejects malformed references, duplicate properties and excessive nesting', () => {
  assert.throws(() => unpackSave({codec:1, strings:[], root:['s',0]}));
  assert.throws(() => unpackSave({codec:1, strings:['x'], root:['o',[[0,1],[0,2]]]}));
  let root = null; for(let i=0;i<102;i++) root=['a',[root]];
  assert.throws(() => unpackSave({codec:1, strings:[], root}));
  assert.throws(() => packSave({bad:Infinity}));
});
