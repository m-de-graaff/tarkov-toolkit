/** exact allow-list: this proxy serves price payloads and nothing else */
export const ALLOWED = new Set([
  'regular/items',
  'regular/items_en',
  'pve/items',
  'pve/items_en',
]);

/**
 * Map a request pathname to an allowed upstream path, or null.
 * Accepts both /regular/items and /prices/regular/items.
 */
export function resolvePricePath(pathname) {
  const path = pathname.replace(/^\/(prices\/)?/, '');
  return ALLOWED.has(path) ? path : null;
}
