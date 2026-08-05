// Walkability NavGrids for maps without an SVG: loads the precomputed masks
// that tile-nav.mjs derives from tarkov.dev's tile renders at snapshot time
// (white = walkable, black = blocked). Masks are same-origin files under
// /nav/, so canvas readback is allowed - the tile CDN itself sends no CORS
// headers, which is why this can't be done from the live tiles in the
// browser.
import type { MapCalibration } from '@raidplanner/data';
import { makeProjector } from './navGrid';
import type { MultiNavGrid, NavLevelGrid } from './svgNav';

async function maskLevel(
  cal: MapCalibration,
  file: string,
): Promise<NavLevelGrid | null> {
  const res = await fetch(`/nav/${file}`);
  if (!res.ok) return null;
  const img = await createImageBitmap(await res.blob());
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  const cells = new Uint8Array(img.width * img.height);
  for (let i = 0; i < cells.length; i++) {
    cells[i] = data[i * 4 + 1] > 127 ? 1 : 0;
  }
  return {
    grid: {
      width: img.width,
      height: img.height,
      cells,
      projector: makeProjector(cal, img.width, img.height),
    },
  };
}

async function build(cal: MapCalibration): Promise<MultiNavGrid | null> {
  if (!cal.navFile) return null;
  const base = await maskLevel(cal, cal.navFile);
  if (!base) return null;
  base.heightRange = cal.heightRange;

  const layers: NavLevelGrid[] = [];
  for (const def of cal.layers ?? []) {
    if (!def.navFile) continue;
    const level = await maskLevel(cal, def.navFile);
    if (level) {
      level.heightRange = def.heightRange;
      layers.push(level);
    }
  }
  return { base, layers };
}

const cache = new Map<string, Promise<MultiNavGrid | null>>();

/** Load (and memoize) mask-based walkability grids; null when unavailable. */
export function loadMaskNav(
  mapId: string,
  cal: MapCalibration,
): Promise<MultiNavGrid | null> {
  let pending = cache.get(mapId);
  if (!pending) {
    pending = build(cal).catch(() => null);
    cache.set(mapId, pending);
  }
  return pending;
}
