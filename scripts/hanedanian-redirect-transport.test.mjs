import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { sendFixtureResponse } from './hanedanian-redirect-transport.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const html = Buffer.from('<!doctype html><p>Hanedan — ışık</p>\r\n'.repeat(4096));

// Use HTTP's raw response stream: fetch transparently decompresses gzip and
// would hide a wrong Content-Length or a body sent without its encoding header.
async function roundTrip(t, options, requestHeaders = {}) {
  const record = {};
  let finishServer, failServer;
  const handled = new Promise((resolve, reject) => { finishServer = resolve; failServer = reject; });
  const server = createServer(async (req, res) => {
    try {
      await sendFixtureResponse(req, res, options, record);
      finishServer(res.getHeaders());
    } catch (error) {
      res.destroy(error);
      failServer(error);
    }
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const received = new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path: '/', headers: requestHeaders }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('Fixture transport timed out')));
    req.end();
  });
  const [response, actualHeaders] = await Promise.all([received, handled]);
  return { ...response, actualHeaders, record };
}

function assertTransport(result, decoded, encoding) {
  assert.equal(Number(result.headers['content-length']), result.bytes.length, 'Wire Content-Length must describe the transmitted bytes');
  assert.equal(Number(result.actualHeaders['content-length']), result.bytes.length, 'Diagnostic headers must match the wire');
  assert.deepEqual(result.record.transport, {
    encoding,
    decodedBytes: decoded.length,
    encodedBytes: result.bytes.length,
    decodedSHA256: digest(decoded),
    encodedSHA256: digest(result.bytes),
  });
}

test('gzip text response preserves decoded bytes, status and custom headers while recording the actual wire size', { timeout: 5000 }, async t => {
  const result = await roundTrip(t, {
    status: 203,
    headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': html.length, 'x-fixture-marker': 'real-game' },
    body: html,
  }, { 'accept-encoding': 'gzip' });
  assert.equal(result.status, 203);
  assert.equal(result.headers['x-fixture-marker'], 'real-game');
  assert.equal(result.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(result.headers['content-encoding'], 'gzip');
  assert.equal(result.actualHeaders['content-encoding'], 'gzip');
  assert.ok(result.bytes.length < html.length / 4, 'Fixture should actually compress its repetitive text payload');
  assert.deepEqual(gunzipSync(result.bytes), html);
  assertTransport(result, html, 'gzip');
});

test('absent gzip support and explicit gzip q=0 both send exact identity bytes', { timeout: 5000 }, async t => {
  for (const headers of [{}, { 'accept-encoding': 'gzip;q=0' }, { 'accept-encoding': 'gzip;q=0, *;q=1' }]) {
    const result = await roundTrip(t, { headers: { 'content-type': 'text/javascript' }, body: html }, headers);
    assert.equal(result.headers['content-encoding'], undefined);
    assert.equal(result.actualHeaders['content-encoding'], undefined);
    assert.equal(result.headers.vary.toLowerCase(), 'accept-encoding');
    assert.deepEqual(result.bytes, html);
    assertTransport(result, html, 'identity');
  }
});

test('encoding negotiation retains existing Vary fields without duplicating Accept-Encoding', { timeout: 5000 }, async t => {
  for (const vary of ['Origin', 'Origin, Accept-Encoding']) {
    const result = await roundTrip(t, {
      headers: { 'content-type': 'text/css', vary }, body: html,
    }, { 'accept-encoding': 'gzip' });
    const tokens = result.headers.vary.split(',').map(value => value.trim().toLowerCase());
    assert.deepEqual(tokens.sort(), ['accept-encoding', 'origin']);
    assert.equal(result.actualHeaders.vary, result.headers.vary);
    assert.deepEqual(gunzipSync(result.bytes), html);
  }
});

test('binary response remains identity even when the client accepts gzip', { timeout: 5000 }, async t => {
  const bytes = Buffer.from([0, 0xff, 0x89, 0x50, 0x4e, 0x47, 0x80, 0, 0xc3, 0x28]);
  const result = await roundTrip(t, { headers: { 'content-type': 'image/png' }, body: bytes }, { 'accept-encoding': 'gzip' });
  assert.equal(result.status, 200);
  assert.equal(result.headers['content-encoding'], undefined);
  assert.deepEqual(result.bytes, bytes);
  assertTransport(result, bytes, 'identity');
});
