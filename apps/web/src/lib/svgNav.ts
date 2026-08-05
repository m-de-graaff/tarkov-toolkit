// Builds a walkability NavGrid by rasterizing a bundled map SVG in the
// browser. The SVGs (from the-hideout/tarkov-dev) tag every surface with a
// material class, and paint in document order - so a cement bridge drawn
// after the river it crosses genuinely reads as walkable. We recolor the
// document (walkable = white, blocking = black, background = black),
// rasterize it, and threshold the pixels.
import type { MapCalibration } from '@raidplanner/data';
import type { NavGrid } from './navGrid';
import { makeProjector } from './navGrid';

/** longest raster dimension; ~1.5-2.5 game meters per cell on big maps */
const MAX_RASTER = 900;

/**
 * Surface classification. Anything not listed renders nothing and therefore
 * stays whatever was painted below it (base = blocked).
 */
const WALKABLE_FILLS = [
  'land',
  'trees',
  'rock',
  'gravel',
  'tarmac',
  'floor',
  'cement',
  'wood',
  'plane',
  'stairs',
  'structure',
  'misc',
];
const WALKABLE_STROKES = ['road_tarmac', 'road_gravel', 'railroad'];
const BLOCKED_FILLS = ['water', 'danger', 'danger_small', 'building', 'locked', 'chopper'];
const BLOCKED_STROKES = ['map_border', 'wall', 'fence'];

/**
 * Recoloring stylesheet. Three specificity tiers so the right paint wins:
 * 1. universal reset (paints nothing),
 * 2. descendant rules (`.land *`) - children of a classed group render with
 *    the group's classification even though the reset killed inheritance;
 *    blocked descendants come later, so unknown children of e.g. a water
 *    group stay blocked,
 * 3. doubled own-class rules (`.cement.cement`) - an element's own class
 *    always beats any ancestor's classification (a cement bridge drawn
 *    inside/after the river stays walkable).
 */
const NAV_STYLE = `
  * {
    fill: none !important;
    stroke: none !important;
    filter: none !important;
    opacity: 1 !important;
    fill-opacity: 1 !important;
    stroke-opacity: 1 !important;
    stroke-dasharray: none !important;
  }
  ${WALKABLE_FILLS.map((c) => `.${c} *`).join(', ')} { fill: #fff !important; }
  ${WALKABLE_STROKES.map((c) => `.${c} *`).join(', ')} { stroke: #fff !important; }
  ${BLOCKED_FILLS.map((c) => `.${c} *`).join(', ')} { fill: #000 !important; }
  ${BLOCKED_STROKES.map((c) => `.${c} *`).join(', ')} { stroke: #000 !important; }
  ${WALKABLE_FILLS.map((c) => `.${c}.${c}`).join(', ')} { fill: #fff !important; }
  ${WALKABLE_STROKES.map((c) => `.${c}.${c}`).join(', ')} { stroke: #fff !important; }
  ${BLOCKED_FILLS.map((c) => `.${c}.${c}`).join(', ')} { fill: #000 !important; }
  ${BLOCKED_STROKES.map((c) => `.${c}.${c}`).join(', ')} { stroke: #000 !important; stroke-width: 3 !important; }
`;

function svgSize(svg: SVGSVGElement): { width: number; height: number } {
  const vb = svg.viewBox.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) return { width: vb.width, height: vb.height };
  return {
    width: Number(svg.getAttribute('width')) || 1000,
    height: Number(svg.getAttribute('height')) || 1000,
  };
}

async function rasterize(svgSource: string): Promise<{
  data: Uint8ClampedArray;
  width: number;
  height: number;
} | null> {
  const doc = new DOMParser().parseFromString(svgSource, 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;
  if (svg.nodeName !== 'svg') return null;

  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = NAV_STYLE;
  svg.appendChild(style);

  const { width: srcW, height: srcH } = svgSize(svg);
  const scale = Math.min(1, MAX_RASTER / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
    type: 'image/svg+xml',
  });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    // undrawn = off-map or unclassified = blocked
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return { data: ctx.getImageData(0, 0, width, height).data, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function build(cal: MapCalibration): Promise<NavGrid | null> {
  if (!cal.svgFile) return null;
  const res = await fetch(`/maps/${cal.svgFile}`);
  if (!res.ok) return null;
  const raster = await rasterize(await res.text());
  if (!raster) return null;

  const { data, width, height } = raster;
  const cells = new Uint8Array(width * height);
  for (let i = 0; i < cells.length; i++) {
    // green channel is as good as luminance for black/white
    cells[i] = data[i * 4 + 1] > 127 ? 1 : 0;
  }
  return { width, height, cells, projector: makeProjector(cal, width, height) };
}

const cache = new Map<string, Promise<NavGrid | null>>();

/** Load (and memoize) the walkability grid for a map; null when unavailable. */
export function loadNavGrid(mapId: string, cal: MapCalibration | undefined): Promise<NavGrid | null> {
  if (!cal?.svgFile) return Promise.resolve(null);
  let entry = cache.get(mapId);
  if (!entry) {
    entry = build(cal).catch(() => null);
    cache.set(mapId, entry);
  }
  return entry;
}
