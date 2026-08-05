// Price-caching proxy: the web app's flea-price payloads are ~16MB per game
// mode from json.tarkov.dev. This proxy fetches them once, stores the gzipped
// body in Redis (or process memory when no REDIS_URL is set), and serves every
// client from cache - kinder to tarkov.dev and much faster for users.
//
// Env:
//   PORT               listen port (default 8787)
//   REDIS_URL          e.g. redis://redis:6379 - optional, memory cache otherwise
//   PRICE_TTL_SECONDS  cache lifetime (default 600 = 10 minutes)
//   UPSTREAM           source base url (default https://json.tarkov.dev)
import { createServer } from 'node:http';
import { gzipSync, gunzipSync } from 'node:zlib';
import { resolvePricePath } from './routes.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const TTL = Number(process.env.PRICE_TTL_SECONDS ?? 600);
const UPSTREAM = process.env.UPSTREAM ?? 'https://json.tarkov.dev';

// --- cache backends --------------------------------------------------------

const memory = new Map(); // path -> { body: Buffer (gzipped), expires: number }

let redis = null;
if (process.env.REDIS_URL) {
  const { createClient } = await import('redis');
  redis = createClient({ url: process.env.REDIS_URL });
  redis.on('error', (err) => console.error('[redis]', err.message));
  await redis.connect();
  console.log('cache: redis', process.env.REDIS_URL);
} else {
  console.log('cache: in-memory (set REDIS_URL for a shared cache)');
}

async function cacheGet(path) {
  if (redis) {
    const buf = await redis.get(redis.commandOptions({ returnBuffers: true }), `prices:${path}`);
    return buf ?? null;
  }
  const hit = memory.get(path);
  if (hit && hit.expires > Date.now()) return hit.body;
  memory.delete(path);
  return null;
}

async function cacheSet(path, body) {
  if (redis) {
    await redis.set(`prices:${path}`, body, { EX: TTL });
    return;
  }
  memory.set(path, { body, expires: Date.now() + TTL * 1000 });
}

// --- upstream --------------------------------------------------------------

const inflight = new Map(); // path -> Promise<Buffer> - dedupe concurrent misses

function fetchUpstream(path) {
  let p = inflight.get(path);
  if (!p) {
    p = (async () => {
      const res = await fetch(`${UPSTREAM}/${path}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`upstream HTTP ${res.status} for ${path}`);
      const raw = Buffer.from(await res.arrayBuffer());
      const gz = gzipSync(raw, { level: 6 });
      await cacheSet(path, gz);
      return gz;
    })().finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  return p;
}

// --- server ----------------------------------------------------------------

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    return;
  }
  const path = resolvePricePath(url.pathname);
  if (req.method !== 'GET' || path === null) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    return;
  }
  try {
    const gz = (await cacheGet(path)) ?? (await fetchUpstream(path));
    const headers = {
      'content-type': 'application/json',
      'cache-control': `public, max-age=${Math.floor(TTL / 2)}`,
      'access-control-allow-origin': '*',
    };
    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
    if (acceptsGzip) {
      res.writeHead(200, { ...headers, 'content-encoding': 'gzip' }).end(gz);
    } else {
      res.writeHead(200, headers).end(gunzipSync(gz));
    }
  } catch (err) {
    console.error('[proxy]', err.message);
    res.writeHead(502, { 'content-type': 'text/plain' }).end('upstream unavailable');
  }
});

server.listen(PORT, () => console.log(`price proxy on :${PORT}, upstream ${UPSTREAM}, ttl ${TTL}s`));
