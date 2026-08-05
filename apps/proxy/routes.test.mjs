import { describe, expect, it } from 'vitest';
import { resolvePricePath } from './routes.mjs';

describe('resolvePricePath', () => {
  it('accepts the four price payloads, with or without /prices prefix', () => {
    expect(resolvePricePath('/regular/items')).toBe('regular/items');
    expect(resolvePricePath('/prices/regular/items_en')).toBe('regular/items_en');
    expect(resolvePricePath('/pve/items')).toBe('pve/items');
    expect(resolvePricePath('/prices/pve/items_en')).toBe('pve/items_en');
  });

  it('rejects everything else - the proxy must never become an open relay', () => {
    expect(resolvePricePath('/')).toBeNull();
    expect(resolvePricePath('/healthz')).toBeNull();
    expect(resolvePricePath('/regular/items/../../etc/passwd')).toBeNull();
    expect(resolvePricePath('/prices/regular/barters')).toBeNull();
    expect(resolvePricePath('/anything')).toBeNull();
    expect(resolvePricePath('//regular/items')).toBeNull();
  });
});
