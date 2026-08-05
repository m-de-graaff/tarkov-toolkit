// Builds walkability NavGrids by rasterizing a bundled map SVG in the
// browser. The SVGs (from the-hideout/tarkov-dev) tag every surface with a
// material class, and paint in document order - so a cement bridge drawn
// after the river it crosses genuinely reads as walkable. We recolor the
// document (walkable = white, blocking = black, background = black),
// rasterize it, and threshold the pixels.
//
// Multi-level maps (Factory, Shoreline resort, Streets interiors...) draw
// each floor as a separate layer group. Rasterizing them stacked would let
// upper floors erase ground-floor walls, so each level gets its own grid:
// non-layer content plus exactly one layer group visible at a time.
import type { MapCalibration, MapLayer } from '@raidplanner/data';
import type { NavGrid } from './navGrid';
import { makeProjector } from './navGrid';

/** longest raster dimension; ~1.5-2.5 game meters per cell on big maps.
 * Small SVGs (Factory's viewBox is in whole meters) get upscaled so indoor
 * walls and doorways survive rasterization. */
const MAX_RASTER = 900;
const MAX_UPSCALE = 8;

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
 * Recoloring stylesheet. Specificity tiers so the right paint wins:
 * 1. universal reset (paints nothing),
 * 2. descendant rules (`.land *`) - children of a classed group render with
 *    the group's classification even though the reset killed inheritance;
 *    blocked descendants come later, so unknown children of e.g. a water
 *    group stay blocked,
 * 3. doubled own-class rules (`.cement.cement`) - an element's own class
 *    always beats any ancestor's classification (a cement bridge drawn
 *    inside/after the river stays walkable),
 * 4. named exceptions last: swamps are water you can wade through, so any
 *    element (or group) whose id starts with "Swamp" is walkable.
 */
const navStyle = (blockedStrokeUnits: number) => `
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
  ${BLOCKED_STROKES.map((c) => `.${c}.${c}`).join(', ')} { stroke: #000 !important; stroke-width: ${blockedStrokeUnits} !important; }
  [id^="Swamp"][id], [id^="Swamp"][id] * { fill: #fff !important; stroke: none !important; }
`;

/** Paints ONLY stairs, for extracting per-level stair masks. */
const stairStyle = `
  * {
    fill: none !important;
    stroke: none !important;
    filter: none !important;
    opacity: 1 !important;
    fill-opacity: 1 !important;
  }
  .stairs *, .stairs.stairs { fill: #fff !important; }
`;

export interface NavLevelGrid {
  grid: NavGrid;
  /** cells on stairways - portals between floors */
  stairs?: Uint8Array;
  heightRange?: [number, number];
}

export interface MultiNavGrid {
  base: NavLevelGrid;
  layers: NavLevelGrid[];
}

function svgSize(svg: SVGSVGElement): { width: number; height: number } {
  const vb = svg.viewBox.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) return { width: vb.width, height: vb.height };
  return {
    width: Number(svg.getAttribute('width')) || 1000,
    height: Number(svg.getAttribute('height')) || 1000,
  };
}

/** Layer groups are marked with data-layer (or fall back to a matching id). */
export function findLayerGroups(root: Element, names: string[]): Map<string, Element> {
  const groups = new Map<string, Element>();
  for (const el of root.querySelectorAll('[data-layer]')) {
    const name = el.getAttribute('data-layer');
    if (name) groups.set(name, el);
  }
  for (const name of names) {
    if (groups.has(name)) continue;
    const byId = root.querySelector(`#${CSS.escape(name)}`);
    if (byId) groups.set(name, byId);
  }
  return groups;
}

/** Show exactly one layer group (null = none); non-layer content stays visible. */
function applyLayerVisibility(groups: Map<string, Element>, visible: string | null): void {
  for (const [name, el] of groups) {
    if (name === visible) el.setAttribute('display', '');
    else el.setAttribute('display', 'none');
  }
}

async function drawToCells(
  svg: SVGSVGElement,
  width: number,
  height: number,
): Promise<Uint8Array | null> {
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
    const data = ctx.getImageData(0, 0, width, height).data;
    const cells = new Uint8Array(width * height);
    for (let i = 0; i < cells.length; i++) {
      // green channel is as good as luminance for black/white
      cells[i] = data[i * 4 + 1] > 127 ? 1 : 0;
    }
    return cells;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function build(cal: MapCalibration): Promise<MultiNavGrid | null> {
  if (!cal.svgFile) return null;
  const res = await fetch(`/maps/${cal.svgFile}`);
  if (!res.ok) return null;
  const doc = new DOMParser().parseFromString(await res.text(), 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;
  if (svg.nodeName !== 'svg') return null;

  const { width: srcW, height: srcH } = svgSize(svg);
  const scale = Math.min(MAX_UPSCALE, MAX_RASTER / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  const projector = makeProjector(cal, width, height);

  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
  // barrier strokes should land ~2 raster px wide regardless of svg scale,
  // but never thinner than 1 svg unit
  const walkabilityStyle = navStyle(Math.max(1, 2 / scale));
  style.textContent = walkabilityStyle;
  svg.appendChild(style);

  const layerDefs = (cal.layers ?? []).filter((l): l is MapLayer & { svgLayer: string } =>
    Boolean(l.svgLayer),
  );
  const groupNames = [cal.svgLayer, ...layerDefs.map((l) => l.svgLayer)].filter(
    (n): n is string => Boolean(n),
  );
  const groups = findLayerGroups(svg, groupNames);

  const rasterLevel = async (visible: string | null): Promise<NavLevelGrid | null> => {
    if (groups.size > 0) applyLayerVisibility(groups, visible);
    style.textContent = walkabilityStyle;
    const cells = await drawToCells(svg, width, height);
    if (!cells) return null;
    style.textContent = stairStyle;
    const stairs = (await drawToCells(svg, width, height)) ?? undefined;
    return { grid: { width, height, cells, projector }, stairs };
  };

  // base level: non-layer content + the ground layer group
  const base = await rasterLevel(cal.svgLayer ?? null);
  if (!base) return null;
  base.heightRange = cal.heightRange;

  const layers: NavLevelGrid[] = [];
  if (groups.size > 0) {
    for (const def of layerDefs) {
      if (!groups.has(def.svgLayer)) continue;
      const level = await rasterLevel(def.svgLayer);
      if (level) {
        level.heightRange = def.heightRange;
        layers.push(level);
      }
    }
  }
  return { base, layers };
}

const cache = new Map<string, Promise<MultiNavGrid | null>>();

/** Load (and memoize) the walkability grids for a map; null when unavailable. */
export function loadNavGrid(
  mapId: string,
  cal: MapCalibration | undefined,
): Promise<MultiNavGrid | null> {
  if (!cal?.svgFile) return Promise.resolve(null);
  let entry = cache.get(mapId);
  if (!entry) {
    entry = build(cal).catch(() => null);
    cache.set(mapId, entry);
  }
  return entry;
}

// --- display variants for the floor selector -------------------------------

const svgTextCache = new Map<string, Promise<string>>();
const displayUrlCache = new Map<string, Promise<string | null>>();

function fetchSvgText(svgFile: string): Promise<string> {
  let entry = svgTextCache.get(svgFile);
  if (!entry) {
    entry = fetch(`/maps/${svgFile}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    });
    svgTextCache.set(svgFile, entry);
  }
  return entry;
}

function toBlobUrl(svg: SVGSVGElement): string {
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
    type: 'image/svg+xml',
  });
  return URL.createObjectURL(blob);
}

/**
 * A display URL for the map SVG with one floor selected.
 * - 'fallback': the full map with only the chosen layer group visible among
 *   the layer groups (base image for maps with no tile render).
 * - 'overlay': ONLY the chosen layer group (plus styles/defs), for stacking
 *   on top of the base tile render; everything else is transparent.
 */
export function layerDisplayUrl(
  cal: MapCalibration,
  layerName: string,
  mode: 'fallback' | 'overlay',
): Promise<string | null> {
  const svgFile = cal.svgFile;
  if (!svgFile) return Promise.resolve(null);
  const key = `${svgFile}:${mode}:${layerName}`;
  let entry = displayUrlCache.get(key);
  if (!entry) {
    entry = fetchSvgText(svgFile)
      .then((text) => {
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        const svg = doc.documentElement as unknown as SVGSVGElement;
        if (svg.nodeName !== 'svg') return null;
        const names = [cal.svgLayer, ...(cal.layers ?? []).map((l) => l.svgLayer)].filter(
          (n): n is string => Boolean(n),
        );
        const groups = findLayerGroups(svg, names);
        const target = groups.get(layerName);
        if (!target) return null;
        if (mode === 'fallback') {
          applyLayerVisibility(groups, layerName);
        } else {
          // keep styles and defs, drop everything else, re-add the floor group
          for (const child of [...svg.children]) {
            const tag = child.nodeName.toLowerCase();
            if (tag !== 'style' && tag !== 'defs') child.remove();
          }
          target.removeAttribute('display');
          svg.appendChild(target);
        }
        return toBlobUrl(svg);
      })
      .catch(() => null);
    displayUrlCache.set(key, entry);
  }
  return entry;
}