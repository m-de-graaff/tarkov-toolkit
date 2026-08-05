// Same-origin item icons for the hosted deployment. assets.tarkov.dev has
// outages that leave every item row with a broken image; routing icons
// through this function lets Vercel's edge cache absorb them - after the
// first load per icon, upstream flakiness is invisible for a month.
//
// GET /api/icons?id=<24-hex item id> -> image/webp
import type { IncomingMessage, ServerResponse } from 'node:http';

const UPSTREAM = 'https://assets.tarkov.dev';
// tarkov item ids are Mongo ObjectIds; anything else never reaches upstream
const ID_RE = /^[0-9a-f]{24}$/i;

const jsonError = (res: ServerResponse, status: number, code: string, message: string) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify({ error: { code, message } }));
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    jsonError(res, 405, 'method_not_allowed', 'GET only');
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  const id = url.searchParams.get('id') ?? '';
  if (!ID_RE.test(id)) {
    jsonError(res, 400, 'invalid_id', 'id must be a 24-character hex item id');
    return;
  }

  try {
    const upstream = await fetch(`${UPSTREAM}/${id.toLowerCase()}-icon.webp`);
    if (upstream.status === 404) {
      jsonError(res, 404, 'icon_not_found', 'No icon for this item');
      return;
    }
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const body = Buffer.from(await upstream.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('content-type', upstream.headers.get('content-type') ?? 'image/webp');
    // icons are immutable per item in practice; a stale one is cosmetic
    res.setHeader('cache-control', 'public, s-maxage=2592000, stale-while-revalidate=86400');
    res.end(body);
  } catch {
    jsonError(res, 502, 'upstream_failed', 'Icon source is unavailable right now');
  }
}
