import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {gzipSync} from 'node:zlib';
import {once} from 'node:events';
import {createResponseByteMeter} from './response-byte-meter.mjs';

async function fixture(t, handler) {
  const sockets = new Set();
  const upstream = http.createServer(handler);
  upstream.on('connection', socket => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const meter = await createResponseByteMeter(`http://127.0.0.1:${upstream.address().port}`);
  t.after(async () => {
    await meter.close();
    await new Promise(resolve => {
      upstream.close(resolve);
      for (const socket of sockets) socket.destroy();
    });
  });
  return {meter, upstream};
}

async function rawGet(origin, path = '/') {
  const {port} = new URL(origin), socket = net.connect({host: '127.0.0.1', port: Number(port)});
  const chunks = [];
  socket.on('data', chunk => chunks.push(chunk));
  const ended = once(socket, 'close');
  await once(socket, 'connect');
  socket.write(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`);
  await ended;
  return Buffer.concat(chunks);
}

function get(origin, path, agent) {
  return new Promise((resolve, reject) => {
    http.get(origin + path, {agent}, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks)}));
      response.on('error', reject);
    }).on('error', reject);
  });
}

test('raw TCP received bytes equal the meter delta and snapshots are detached', {timeout: 5000}, async t => {
  const body = Buffer.from('raw\0payload\xff', 'latin1');
  const {meter} = await fixture(t, (_req, res) => {
    res.writeHead(200, {'content-type': 'application/octet-stream', 'content-length': body.length});
    res.end(body);
  });
  const before = meter.snapshot();
  const received = await rawGet(meter.origin);
  const after = meter.snapshot();
  assert.equal(after.responseBytes - before.responseBytes, received.length);
  assert.equal(after.requestCount, 1);
  assert.equal(after.activeRequests, 0);
  assert.deepEqual(after.records.map(({bodyBytes, finished}) => ({bodyBytes, finished})), [{bodyBytes: body.length, finished: true}]);
  assert.deepEqual(after.errors, []);
  after.records[0].bodyBytes = -1;
  after.errors.push({message: 'mutated'});
  assert.equal(meter.snapshot().records[0].bodyBytes, body.length);
  assert.deepEqual(meter.snapshot().errors, []);
});

test('consecutive keepalive cases count each response once', {timeout: 5000}, async t => {
  const {meter} = await fixture(t, (_req, res) => {
    res.writeHead(200, {'content-length': '4'});
    res.end('same');
  });
  const socket = net.connect({host: '127.0.0.1', port: Number(new URL(meter.origin).port)});
  t.after(() => socket.destroy());
  await once(socket, 'connect');
  async function one(path) {
    const chunks = [];
    await new Promise((resolve, reject) => {
      const onData = chunk => {
        chunks.push(chunk);
        const bytes = Buffer.concat(chunks), split = bytes.indexOf('\r\n\r\n');
        if (split >= 0 && bytes.length >= split + 4 + 4) {
          socket.removeListener('data', onData);
          socket.removeListener('error', reject);
          resolve();
        }
      };
      socket.on('data', onData);
      socket.once('error', reject);
      socket.write(`GET ${path} HTTP/1.1\r\nHost: localhost\r\nConnection: keep-alive\r\n\r\n`);
    });
    return Buffer.concat(chunks).length;
  }
  const firstStart = meter.snapshot().responseBytes;
  const first = await one('/one'), middle = meter.snapshot().responseBytes;
  const second = await one('/two'), end = meter.snapshot();
  assert.equal(middle - firstStart, first);
  assert.equal(end.responseBytes - middle, second);
  assert.equal(end.responseBytes, first + second);
  assert.equal(end.requestCount, 2);
  assert.equal(end.activeRequests, 0);
});

test('concurrent closed connections retain all observed bytes', {timeout: 5000}, async t => {
  const {meter} = await fixture(t, (req, res) => {
    const body = Buffer.from(req.url.repeat(31));
    res.writeHead(200, {'content-length': body.length});
    setImmediate(() => res.end(body));
  });
  const responses = await Promise.all(['/a', '/bb', '/ccc'].map(path => rawGet(meter.origin, path)));
  const snapshot = meter.snapshot();
  assert.equal(snapshot.responseBytes, responses.reduce((sum, bytes) => sum + bytes.length, 0));
  assert.equal(snapshot.requestCount, 3);
  assert.equal(snapshot.activeRequests, 0);
  assert.ok(snapshot.records.every(record => record.finished));
});

test('encoded body and content/cache/service-worker headers pass through', {timeout: 5000}, async t => {
  const body = gzipSync(Buffer.from('self.addEventListener("fetch", () => {});'));
  const {meter} = await fixture(t, (_req, res) => {
    res.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8', 'content-encoding': 'gzip',
      'content-length': body.length, 'cache-control': 'no-cache', 'service-worker-allowed': '/',
    });
    res.end(body);
  });
  const result = await get(meter.origin, '/games/hanedanian/sw.js');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, body);
  assert.equal(result.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(result.headers['content-encoding'], 'gzip');
  assert.equal(result.headers['content-length'], String(body.length));
  assert.equal(result.headers['cache-control'], 'no-cache');
  assert.equal(result.headers['service-worker-allowed'], '/');
  assert.equal(meter.snapshot().records[0].bodyBytes, body.length);
});

test('upstream reset yields a visible 502 and recorded error', {timeout: 5000}, async t => {
  const {meter} = await fixture(t, req => req.socket.destroy());
  const received = await rawGet(meter.origin, '/reset');
  const snapshot = meter.snapshot();
  assert.match(received.toString(), /^HTTP\/1\.1 502 /);
  assert.equal(snapshot.responseBytes, received.length);
  assert.equal(snapshot.records[0].status, 502);
  assert.equal(snapshot.activeRequests, 0);
  assert.ok(snapshot.errors.some(error => /socket hang up|reset/i.test(error.message)));
  snapshot.errors[0].message = 'mutated';
  assert.notEqual(meter.snapshot().errors[0].message, 'mutated');
});

test('HTTP failures stay visible while redirects and 304 retain their status', {timeout: 5000}, async t => {
  const {meter} = await fixture(t, (req, res) => {
    const status = Number(req.url.slice(1));
    res.writeHead(status, {'content-length': '0', location: '/next', etag: 'same'});
    res.end();
  });
  for (const status of [302, 304, 503]) assert.equal((await get(meter.origin, '/' + status)).status, status);
  const snapshot = meter.snapshot();
  assert.deepEqual(snapshot.records.map(record => record.status), [302, 304, 503]);
  assert.deepEqual(snapshot.errors.map(error => error.message), ['Upstream HTTP 503']);
  assert.equal(snapshot.activeRequests, 0);
});

test('an upstream abort during a body stays incomplete and visible', {timeout: 5000}, async t => {
  const {meter} = await fixture(t, (req, res) => {
    res.writeHead(200, {'content-length': '100'});
    res.write('partial');
    setTimeout(() => req.socket.destroy(), 10);
  });
  await new Promise((resolve, reject) => {
    http.get(meter.origin + '/abort', response => {
      response.resume();
      response.on('error', () => {});
      response.once('close', resolve);
    }).on('error', reject);
  });
  await meter.close();
  const snapshot = meter.snapshot();
  assert.equal(snapshot.records[0].status, 200);
  assert.equal(snapshot.records[0].bodyBytes, Buffer.byteLength('partial'));
  assert.equal(snapshot.records[0].finished, false);
  assert.equal(snapshot.activeRequests, 0);
  assert.ok(snapshot.errors.some(error => /Upstream response aborted/.test(error.message)));
});

test('closing cancels active upstream work and is idempotent', {timeout: 5000}, async t => {
  let started;
  const ready = new Promise(resolve => {started = resolve;});
  const {meter} = await fixture(t, () => started());
  const request = http.get(meter.origin + '/never');
  request.on('error', () => {});
  await ready;
  assert.equal(meter.snapshot().activeRequests, 1);
  await meter.close();
  await meter.close();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(meter.snapshot().activeRequests, 0);
});
