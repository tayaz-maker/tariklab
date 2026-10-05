import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { HOSTS, validateTarget, verifyHost, hash, requestPathFor } from './gate.mjs';

const main = { GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'push' };
test('production only accepts two exact hosts on main, never PR or preview', () => {
  for (const origin of Object.values(HOSTS)) assert.equal(validateTarget('production', origin, main), origin);
  for (const origin of ['https://tariklab.com', 'http://www.tariklab.com',
    'https://www.tariklab.com:444', 'https://u:p@www.tariklab.com',
    'https://www.tariklab.com/path', 'https://www.tariklab.com?x=1', 'https://www.tariklab.com#x'])
    assert.throws(() => validateTarget('production', origin, main));
  assert.throws(() => validateTarget('production', HOSTS.www, { ...main, GITHUB_REF: 'refs/pull/1/merge' }));
  assert.throws(() => validateTarget('production', HOSTS.www, { ...main, GITHUB_EVENT_NAME: 'pull_request' }));
});
test('built mode requires explicit numeric loopback origin and port', () => {
  assert.equal(validateTarget('built', 'http://127.0.0.1:8097'), 'http://127.0.0.1:8097');
  for (const origin of ['http://localhost:8097', 'http://127.0.0.1', HOSTS.www, 'http://0.0.0.0:8097'])
    assert.throws(() => validateTarget('built', origin));
});
test('hash gate rejects mismatch, redirects, HTTP error and empty expected list', async () => {
  const manifest = [{ path: 'games/darbe-h/app.js', sha256: hash('expected') }];
  const response = (body, status = 200, url = `${HOSTS.www}/games/darbe-h/app.js`) => ({
    url, status, async arrayBuffer() { return Buffer.from(body); },
  });
  let options;
  const evidence = [];
  await verifyHost(HOSTS.www, manifest, evidence, async (_url, opts) => { options = opts; return response('expected'); });
  assert.equal(options.redirect, 'error'); assert.equal(evidence[0].actualSHA256, manifest[0].sha256);
  for (const bad of [response('different'), response('expected', 404), response('expected', 200, HOSTS.workers)])
    await assert.rejects(verifyHost(HOSTS.www, manifest, [], async () => bad));
  await assert.rejects(verifyHost(HOSTS.www, [], []));
});

test('canonical HTML URL retains the built index source hash and redirects remain hard failures', async t => {
  const sourcePath = 'games/darbe-h/index.html';
  const html = Buffer.from('<main>Exact built game entry</main>');
  const manifest = [{ path: sourcePath, requestPath: requestPathFor(sourcePath), sha256: hash(html) }];
  assert.equal(manifest[0].requestPath, '/games/darbe-h/');
  assert.equal(requestPathFor('games/darbe-h/app.js'), '/games/darbe-h/app.js');
  const requested = [];
  let redirect = false;
  const server = createServer((req, res) => {
    requested.push(req.url);
    if (redirect) { res.writeHead(302, { location: '/unexpected/' }).end(); return; }
    if (req.url !== '/games/darbe-h/') { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': 'text/html' }).end(html);
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(done => server.close(done));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const evidence = [];
  await verifyHost(origin, manifest, evidence);
  assert.equal(evidence[0].path, sourcePath);
  assert.equal(evidence[0].actualURL, `${origin}/games/darbe-h/`);
  assert.equal(evidence[0].actualSHA256, hash(html));
  assert.deepEqual(requested, ['/games/darbe-h/']);
  redirect = true;
  await assert.rejects(verifyHost(origin, manifest, []), /fetch failed/);
  assert.deepEqual(requested, ['/games/darbe-h/', '/games/darbe-h/'], 'redirect destination is never followed');
});
