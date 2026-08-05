// Anonymous user feedback, stored in Postgres so it works without any
// third-party service. POST /api/feedback <- { message, email?, page? }
// -> 201 { ok: true }. Signed-in users get their id attached automatically.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './_lib/auth.js';
import { pool } from './_lib/db.js';

const MAX_BYTES = 8_192;
const MAX_MESSAGE = 4_000;
const MAX_EMAIL = 200;
const MAX_PAGE = 300;
const MAX_UA = 400;

// Best-effort throttle: per serverless instance, so the real ceiling scales
// with concurrent instances. Good enough to blunt casual spam; message and
// body caps bound the damage of anything that slips through.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const stamps = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (stamps.length >= MAX_PER_WINDOW) return true;
  stamps.push(now);
  recent.set(ip, stamps);
  if (recent.size > 5_000) recent.clear(); // bound memory on a hot instance
  return false;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!process.env.DATABASE_URL) {
    json(res, 503, { error: { code: 'not_configured', message: 'feedback is not configured' } });
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    json(res, 405, { error: { code: 'method_not_allowed', message: 'POST only' } });
    return;
  }
  const ip =
    (String(req.headers['x-forwarded-for'] ?? '').split(',')[0] || 'unknown').trim();
  if (throttled(ip)) {
    res.setHeader('retry-after', '600');
    json(res, 429, { error: { code: 'rate_limit_exceeded', message: 'Try again later' } });
    return;
  }

  let body: unknown;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    json(res, 400, { error: { code: 'bad_json', message: 'body must be JSON' } });
    return;
  }
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (message.length < 3 || message.length > MAX_MESSAGE) {
    json(res, 422, {
      error: {
        code: 'validation_error',
        message: 'Request validation failed',
        details: [
          { field: 'message', code: 'length', message: `3-${MAX_MESSAGE} characters` },
        ],
      },
    });
    return;
  }
  const email =
    typeof b.email === 'string' && b.email.trim().length > 0
      ? b.email.trim().slice(0, MAX_EMAIL)
      : null;
  const page = typeof b.page === 'string' ? b.page.slice(0, MAX_PAGE) : null;
  const userAgent = String(req.headers['user-agent'] ?? '').slice(0, MAX_UA) || null;

  // optional identity - anonymous feedback is fine
  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    userId = session?.user.id ?? null;
  } catch {
    /* auth unavailable - stay anonymous */
  }

  try {
    await pool.query(
      `INSERT INTO feedback (user_id, message, email, page, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, message, email, page, userAgent],
    );
    json(res, 201, { ok: true });
  } catch (err) {
    console.error('feedback insert failed:', err);
    json(res, 500, { error: { code: 'internal_error', message: 'Could not save feedback' } });
  }
}
