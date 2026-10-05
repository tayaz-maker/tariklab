import http from 'node:http';

// Observe browser-facing HTTP bytes without Playwright's response extra-info waits.
// Socket totals include HTTP framing; bodyBytes records only the raw encoded payload.
export async function createResponseByteMeter(upstreamOrigin) {
  const upstream = new URL(upstreamOrigin);
  if (upstream.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(upstream.hostname) || upstream.username || upstream.password) {
    throw new Error('Response byte meter requires a fixed loopback HTTP upstream');
  }
  const agent = new http.Agent({keepAlive: true});
  const socketStates = new Set(), upstreamSockets = new Set(), upstreamRequests = new Set();
  const responseCompletions = new Set();
  const records = [], errors = [];
  let activeRequests = 0, origin, closing;
  const noteError = (record, message) => errors.push({url: record?.url ?? null, message});
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, origin);
    const record = {url: url.href, method: request.method, status: null, bodyBytes: 0, finished: false};
    records.push(record);
    activeRequests++;
    let settled = false, failed = false, forwarded;
    let resolveCompletion;
    const completion = new Promise(resolve => {resolveCompletion = resolve;});
    responseCompletions.add(completion);
    const settle = (finished) => {
      if (settled) return;
      settled = true;
      record.finished = finished;
      activeRequests--;
      responseCompletions.delete(completion);
      resolveCompletion();
    };
    const fail = (error) => {
      if (failed) return;
      failed = true;
      noteError(record, error.message || String(error));
      if (response.destroyed) return;
      if (response.headersSent) response.destroy(error);
      else {
        record.status = 502;
        const body = Buffer.from('Upstream response failed\n');
        record.bodyBytes = body.length;
        response.writeHead(502, {'content-type': 'text/plain; charset=utf-8', 'content-length': body.length});
        response.end(body);
      }
    };
    response.on('finish', () => settle(true));
    response.on('close', () => {
      if (!response.writableFinished) {
        noteError(record, 'Browser response closed before finishing');
        forwarded?.destroy(new Error('Browser response closed before finishing'));
      }
      settle(response.writableFinished);
    });
    response.on('error', fail);
    request.on('aborted', () => {
      fail(new Error('Browser request aborted'));
      forwarded?.destroy();
    });
    request.on('error', fail);
    forwarded = http.request({
      hostname: upstream.hostname,
      port: upstream.port,
      method: request.method,
      path: url.pathname + url.search,
      headers: {...request.headers, host: upstream.host},
      agent,
    }, incoming => {
      record.status = incoming.statusCode;
      if (incoming.statusCode >= 400) noteError(record, `Upstream HTTP ${incoming.statusCode}`);
      incoming.on('aborted', () => fail(new Error('Upstream response aborted')));
      incoming.on('error', fail);
      incoming.on('data', chunk => {record.bodyBytes += chunk.length;});
      response.writeHead(incoming.statusCode, incoming.statusMessage, incoming.rawHeaders);
      incoming.pipe(response);
    });
    upstreamRequests.add(forwarded);
    forwarded.once('close', () => upstreamRequests.delete(forwarded));
    forwarded.on('socket', socket => {
      if (upstreamSockets.has(socket)) return;
      upstreamSockets.add(socket);
      socket.once('close', () => upstreamSockets.delete(socket));
    });
    forwarded.on('error', fail);
    request.pipe(forwarded);
  });
  server.on('connection', socket => {
    const state = {socket, finalBytes: null};
    socketStates.add(state);
    socket.once('close', () => {
      state.finalBytes = socket.bytesWritten;
      state.socket = null;
    });
  });
  server.on('clientError', (error, socket) => {
    noteError(null, `Browser HTTP error: ${error.message}`);
    socket.destroy();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  server.on('error', error => noteError(null, `Proxy server error: ${error.message}`));
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    snapshot() {
      return {
        responseBytes: [...socketStates].reduce((total, state) => total + (state.finalBytes ?? state.socket.bytesWritten), 0),
        requestCount: records.length,
        activeRequests,
        records: records.map(record => ({...record})),
        errors: errors.map(error => ({...error})),
      };
    },
    close() {
      if (closing) return closing;
      closing = (async () => {
        const completions = [...responseCompletions];
        const sockets = [...upstreamSockets, ...[...socketStates].map(state => state.socket).filter(Boolean)];
        const socketClosures = sockets.filter(socket => !socket.closed).map(socket => new Promise(resolve => socket.once('close', resolve)));
        const serverClosed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        for (const request of upstreamRequests) request.destroy(new Error('Response byte meter closed'));
        agent.destroy();
        for (const socket of sockets) socket.destroy();
        await Promise.all([serverClosed, ...socketClosures, ...completions]);
      })();
      return closing;
    },
  };
}
