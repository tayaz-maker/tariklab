import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {hasReadableBody} from './route-performance-surface.mjs';

const probe = document => runInNewContext(`(${hasReadableBody.toString()})()`, {document});

test('an attached iframe without a body waits instead of throwing the CI TypeError', () => {
  const document = {body: null};
  assert.throws(() => runInNewContext('document.body.innerText.trim().length > 20', {document}), /Cannot read properties of null/);
  assert.equal(probe(document), false);
  document.body = {innerText: ''};
  assert.equal(probe(document), false);
  document.body.innerText = 'x'.repeat(21);
  assert.equal(probe(document), true);
});

test('the original strict 20-character trimmed threshold is preserved', () => {
  for (const text of ['', '   ', 'x'.repeat(20), `  ${'x'.repeat(20)}  `]) {
    assert.equal(probe({body: {innerText: text}}), false);
  }
  assert.equal(probe({body: {innerText: `  ${'x'.repeat(21)}  `}}), true);
});

test('actual document errors still fail rather than being swallowed', () => {
  const body = {get innerText() {throw new Error('document access failed');}};
  assert.throws(() => probe({body}), /document access failed/);
});
