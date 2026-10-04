import test from 'node:test';
import assert from 'node:assert/strict';
import {withDeadline} from './route-performance-deadline.mjs';

test('a never-settling operation reports its stage and deadline', async () => {
  await assert.rejects(withDeadline('hanedanian/390/sizes', new Promise(() => {}), 10), error => {
    assert.equal(error.name, 'DiagnosticTimeoutError');
    assert.equal(error.stage, 'hanedanian/390/sizes');
    assert.equal(error.timeoutMs, 10);
    assert.match(error.message, /hanedanian\/390\/sizes/);
    assert.match(error.message, /10 ms/);
    return true;
  });
});

test('completed promises and functions preserve their result', async () => {
  const value = {bytes: 123};
  assert.equal(await withDeadline('sizes', Promise.resolve(value)), value);
  assert.equal(await withDeadline('close', () => value), value);
});

test('rejected operations preserve the original error', async () => {
  const error = new Error('request failed');
  await assert.rejects(withDeadline('sizes', Promise.reject(error)), actual => actual === error);
});

test('synchronous function failures preserve the original error', async () => {
  const error = new Error('close failed');
  await assert.rejects(withDeadline('close', () => {throw error;}), actual => actual === error);
});

test('rejections after the deadline remain observed', async () => {
  let reject;
  const operation = new Promise((_, rejectOperation) => {reject = rejectOperation;});
  await assert.rejects(withDeadline('sizes', operation, 10), {name: 'DiagnosticTimeoutError'});
  reject(new Error('late request failure'));
  await new Promise(resolve => setImmediate(resolve));
});
