// Walkability masks for maps that have no SVG (The Lab, The Labyrinth,
// Icebreaker): tarkov.dev's baked tile renders draw floor pixels opaque and
// leave walls/void transparent, so alpha alone separates walkable space.
// Generated in Node because the tile CDN sends no CORS headers - the browser
// could display the tiles but never read their pixels back.
//
// Standalone: `node scripts/tile-nav.mjs` patches generated/snapshot.json in
// place and writes masks to apps/web/public/nav/. snapshot.mjs also calls
// generateTileNav() during a full refresh.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const navOutDir = path.resolve(here, '../../../apps/web/public/nav');
const snapshotFile = path.resolve(here, '../generated/snapshot.json');

/** target long side of a mask in pixels (~1-2 game meters per cell) */
const TARGET_RASTER = 1200;
/** opaque enough to count as drawn floor */
const ALPHA_WALKABLE = 160;

/** projected-unit rectangle of the calibrated bounds (zoom-0 CRS space) */
function projectedRect(cal) {
  const [scaleX, marginX, rawScaleY, marginY] = cal.transform;
  const rot = ((cal.coordinateRotation ?? 0) * Math.PI) / 180;
  const project = (x, z) => {
    const rx = x * Math.cos(rot) - z * Math.sin(rot);
    const rz = x * Math.sin(rot) + z * Math.cos(rot);
    return [scaleX * rx + marginX, -rawScaleY * rz + marginY];
  };
  const [a, b] = cal.bounds;
  const [pa, pb] = [project(a[0], a[1]), project(b[0], b[1])];
  return {
    minX: Math.min(pa[0], pb[0]),
    maxX: Math.max(pa[0], pb[0]),
    minY: Math.min(pa[1], pb[1]),
    maxY: Math.max(pa[1], pb[1]),
  };
}

async function fetchTile(urlTemplate, z, x, y) {
  const url = urlTemplate
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
  const res = await fetch(url);
  if (!res.ok) return null; // outside the drawn pyramid - fully blocked
  return PNG.sync.read(Buffer.from(await res.arrayBuffer()));
}

/**
 * Composite the pyramid over the calibrated bounds at a zoom that lands near
 * TARGET_RASTER and threshold alpha into a walkability bitmap.
 */
async function buildMask(cal, tiles) {
  const rect = projectedRect(cal);
  const extent = Math.max(rect.maxX - rect.minX, rect.maxY - rect.minY);
  const minZoom = tiles.minZoom ?? 1;
  const maxZoom = tiles.maxZoom ?? 6;
  const zoom = Math.max(
    minZoom,
    Math.min(maxZoom, Math.round(Math.log2(TARGET_RASTER / extent))),
  );
  const scale = 2 ** zoom;
  const tileSize = tiles.tileSize ?? 256;
  const width = Math.ceil((rect.maxX - rect.minX) * scale);
  const height = Math.ceil((rect.maxY - rect.minY) * scale);
  const cells = new Uint8Array(width * height); // 0 = blocked

  const x0 = Math.floor((rect.minX * scale) / tileSize);
  const x1 = Math.floor((rect.maxX * scale) / tileSize);
  const y0 = Math.floor((rect.minY * scale) / tileSize);
  const y1 = Math.floor((rect.maxY * scale) / tileSize);
  let drawn = 0;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const png = await fetchTile(tiles.url, zoom, tx, ty);
      if (!png) continue;
      drawn++;
      const offX = tx * tileSize - Math.round(rect.minX * scale);
      const offY = ty * tileSize - Math.round(rect.minY * scale);
      for (let py = 0; py < png.height; py++) {
        const gy = offY + py;
        if (gy < 0 || gy >= height) continue;
        for (let px = 0; px < png.width; px++) {
          const gx = offX + px;
          if (gx < 0 || gx >= width) continue;
          const alpha = png.data[(py * png.width + px) * 4 + 3];
          if (alpha >= ALPHA_WALKABLE) cells[gy * width + gx] = 1;
        }
      }
    }
  }
  if (drawn === 0) return null;
  return { width, height, cells };
}

function maskToPng({ width, height, cells }) {
  const png = new PNG({ width, height });
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i] ? 255 : 0;
    png.data[i * 4] = v;
    png.data[i * 4 + 1] = v;
    png.data[i * 4 + 2] = v;
    png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}

/**
 * For every map with tiles but no SVG: write a base mask (and one per tiled
 * layer) into outDir and record the file names on the calibration. Mutates
 * the map objects; returns the number of masks written.
 */
export async function generateTileNav(maps, outDir = navOutDir) {
  await mkdir(outDir, { recursive: true });
  let written = 0;
  for (const map of maps) {
    const cal = map.calibration;
    if (!cal || cal.svgFile || !cal.tiles) continue;
    const mask = await buildMask(cal, cal.tiles);
    if (!mask) {
      console.log(`  nav ${map.normalizedName}: no tiles reachable, skipped`);
      continue;
    }
    const file = `${map.normalizedName}.png`;
    await writeFile(path.join(outDir, file), maskToPng(mask));
    cal.navFile = file;
    written++;
    console.log(`  nav ${file} (${mask.width}x${mask.height})`);

    for (const [i, layer] of (cal.layers ?? []).entries()) {
      if (!layer.tileUrl) continue;
      const layerMask = await buildMask(cal, { ...cal.tiles, url: layer.tileUrl });
      if (!layerMask) continue;
      const layerFile = `${map.normalizedName}-layer${i}.png`;
      await writeFile(path.join(outDir, layerFile), maskToPng(layerMask));
      layer.navFile = layerFile;
      written++;
      console.log(`  nav ${layerFile} (${layerMask.width}x${layerMask.height})`);
    }
  }
  return written;
}

// standalone: patch the existing snapshot in place
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const snapshot = JSON.parse(await readFile(snapshotFile, 'utf8'));
  const written = await generateTileNav(snapshot.maps);
  await writeFile(snapshotFile, JSON.stringify(snapshot, null, 1));
  console.log(`${written} masks written; snapshot updated.`);
}
