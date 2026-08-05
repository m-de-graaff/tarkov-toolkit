// Trimmed flea prices for the hosted deployment. The raw json.tarkov.dev
// items payload is ~16MB per mode; this function fetches it server-side,
// extracts the fields the app uses (~1-2MB, gzipped by the platform), and
// lets Vercel's edge cache absorb the refresh cadence: s-maxage=600 means
// upstream is hit at most once per 10 minutes per mode, not once per client.
//
// GET /api/prices?mode=regular|pve -> { formatVersion, fetchedAt, prices }
// (the exact CachedPrices shape the web client stores in IndexedDB)
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildPrices } from './_lib/buildPrices.js';

const UPSTREAM = 'https://json.tarkov.dev';
const MODES = new Set(['regular', 'pve']);
/** matches PRICES_FORMAT_VERSION in apps/web/src/lib/prices.ts */
const FORMAT_VERSION = 2;

const json = (res: ServerResponse, status: number, body: unknown, cache = 'no-store') => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', cache);
  res.end(JSON.stringify(body));
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    json(res, 405, { error: { code: 'method_not_allowed', message: 'GET only' } });
    return;
  }
  const url = new URL(req.url ?? '/', 'http://localhost');
  const mode = url.searchParams.get('mode') ?? 'regular';
  if (!MODES.has(mode)) {
    json(res, 400, {
      error: { code: 'invalid_mode', message: "mode must be 'regular' or 'pve'" },
    });
    return;
  }

  try {
    const get = async (path: string): Promise<{ data?: Record<string, unknown> }> => {
      const upstream = await fetch(`${UPSTREAM}/${path}`, {
        headers: { accept: 'application/json' },
      });
      if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
      return upstream.json() as Promise<{ data?: Record<string, unknown> }>;
    };
    // names in the items payload are translation keys; the _en dict resolves them
    const [payload, en] = await Promise.all([
      get(`${mode}/items`),
      get(`${mode}/items_en`).catch(() => null),
    ]);
    const items = (payload.data?.items ?? {}) as Parameters<typeof buildPrices>[0];
    const dict = (en?.data ?? {}) as Record<string, string>;
    const prices = buildPrices(items, dict);
    json(
      res,
      200,
      { formatVersion: FORMAT_VERSION, fetchedAt: Date.now(), prices },
      // edge-cached per URL (mode included); clients refresh every 10 minutes
      // and mostly hit the cache instead of the 16MB upstream
      'public, s-maxage=600, stale-while-revalidate=1800',
    );
  } catch {
    json(res, 502, {
      error: { code: 'upstream_failed', message: 'Price source is unavailable right now' },
    });
  }
}
