// HTTP transport for the local redirect fixture only; never imported by a game.
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

function acceptsGzip(header = '') {
  const qualities = new Map(String(header).split(',').map(value => {
    const [coding, ...parameters] = value.trim().toLowerCase().split(';');
    const quality = parameters.map(p => p.trim()).find(p => p.startsWith('q='));
    const q = quality === undefined ? 1 : Number(quality.slice(2));
    return [coding, Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0];
  }));
  return (qualities.get('gzip') ?? qualities.get('*') ?? 0) > 0;
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function sendFixtureResponse(req, res, {status = 200, headers = {}, body = Buffer.alloc(0)}, record = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const text = /^(text\/|application\/(?:javascript|json|manifest\+json)|image\/svg\+xml)/i.test(headers['content-type'] || '');
  const compressed = text && bytes.length > 0 && acceptsGzip(req.headers['accept-encoding']);
  const encoded = compressed ? gzipSync(bytes) : bytes;
  res.statusCode = status;
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  if (text) {
    const vary = String(res.getHeader('vary') || '').split(',').map(v => v.trim()).filter(Boolean);
    if (!vary.some(v => v.toLowerCase() === 'accept-encoding')) vary.push('Accept-Encoding');
    res.setHeader('vary', vary.join(', '));
  }
  if (compressed) res.setHeader('content-encoding', 'gzip');
  res.setHeader('content-length', encoded.length);
  record.transport = {encoding:compressed ? 'gzip' : 'identity', decodedBytes:bytes.length, encodedBytes:encoded.length, decodedSHA256:digest(bytes), encodedSHA256:digest(encoded)};
  res.end(req.method === 'HEAD' ? undefined : encoded);
}
