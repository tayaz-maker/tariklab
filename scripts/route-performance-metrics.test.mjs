import test from 'node:test';
import assert from 'node:assert/strict';
import {responseTransferBytes} from './route-performance-metrics.mjs';

test('ordinary headers and body retain their exact total', () => {
  assert.equal(responseTransferBytes({responseHeadersSize: 200, responseBodySize: 345}), 545);
});

test('a negative body may exactly cancel reported headers', () => {
  assert.equal(responseTransferBytes({responseHeadersSize: 200, responseBodySize: -200}), 0);
});

test('a negative body preserves a positive reported total without clamping', () => {
  assert.equal(responseTransferBytes({responseHeadersSize: 200, responseBodySize: -150}), 50);
});

for (const [name, sizes, expectedRaw] of [
  ['negative total', {responseHeadersSize: 200, responseBodySize: -201}, /responseBodySize: -201/],
  ['negative headers', {responseHeadersSize: -1, responseBodySize: 200}, /responseHeadersSize: -1/],
  ['NaN body', {responseHeadersSize: 200, responseBodySize: NaN}, /responseBodySize: NaN/],
  ['undefined body', {responseHeadersSize: 200}, /responseBodySize: undefined/],
  ['undefined headers', {responseBodySize: 200}, /responseHeadersSize: undefined/],
  ['fractional body', {responseHeadersSize: 200, responseBodySize: 0.5}, /responseBodySize: 0\.5/],
  ['unsafe field', {responseHeadersSize: Number.MAX_SAFE_INTEGER + 1, responseBodySize: 0}, /responseHeadersSize: 9007199254740992/],
  ['unsafe sum', {responseHeadersSize: Number.MAX_SAFE_INTEGER, responseBodySize: 1}, /responseBodySize: 1/],
]) {
  test(`${name} is rejected with the raw fields`, () => {
    assert.throws(() => responseTransferBytes(sizes), error => {
      assert.match(error.message, /^Invalid response sizes:/);
      assert.match(error.message, expectedRaw);
      assert.match(error.message, /requestBodySize:/);
      assert.match(error.message, /requestHeadersSize:/);
      assert.match(error.message, /responseHeadersSize:/);
      assert.match(error.message, /responseBodySize:/);
      return true;
    });
  });
}
