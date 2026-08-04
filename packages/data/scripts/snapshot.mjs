// Dev-time snapshot: pulls quest/map/trader data from json.tarkov.dev plus map
// calibration from the-hideout/tarkov-dev, and downloads per-map SVGs. The app
// itself never touches the network — it imports generated/snapshot.json.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(here, '..');
const repoRoot = path.join(dataRoot, '..', '..');
const svgOutDir = path.join(repoRoot, 'apps', 'web', 'public', 'maps');
const generatedDir = path.join(dataRoot, 'generated');

const JSON_BASE = 'https://json.tarkov.dev/regular/';
const CALIBRATION_URL =
  'https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/maps.json';

// Objective types that are not actionable at a location during a raid plan.
const DROPPED_OBJECTIVE_TYPES = new Set([
  'taskStatus',
  'traderLevel',
  'traderStanding',
  'experience',
  'skill',
  'dialogue',
  'globalVariable',
]);

// API map normalizedNames that reuse another map's calibration/SVG.
const CALIBRATION_ALIASES = { 'night-factory': 'factory' };

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchTranslated(name) {
  const [payload, en] = await Promise.all([
    fetchJson(`${JSON_BASE}${name}`),
    fetchJson(`${JSON_BASE}${name}_en`),
  ]);
  return applyTranslations(payload.data, en.data);
}

// Replace any string value that is a key in the translation dict. Keys whose
// value is an identifier ('id', 'normalizedName', reference ids) are skipped so
// cross-references stay intact.
const UNTRANSLATED_KEYS = new Set(['id', 'normalizedName', 'map', 'maps', 'task', 'trader']);

function applyTranslations(node, dict, parentKey) {
  if (Array.isArray(node)) {
    return node.map((v) => applyTranslations(v, dict, parentKey));
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] = UNTRANSLATED_KEYS.has(key) ? value : applyTranslations(value, dict, key);
    }
    return out;
  }
  if (typeof node === 'string' && dict[node] !== undefined) {
    return dict[node];
  }
  return node;
}

function buildCalibrationIndex(calibrationJson) {
  const index = new Map();
  for (const entry of calibrationJson) {
    const variant = (entry.maps ?? []).find((m) => m.svgPath);
    if (variant) index.set(entry.normalizedName, variant);
  }
  return index;
}

function buildMaps(rawMaps, calibrationIndex) {
  const maps = [];
  const svgDownloads = [];
  for (const raw of Object.values(rawMaps)) {
    const calKey =
      CALIBRATION_ALIASES[raw.normalizedName] ??
      (calibrationIndex.has(raw.normalizedName) ? raw.normalizedName : undefined);
    const variant = calKey ? calibrationIndex.get(calKey) : undefined;
    let calibration;
    if (variant) {
      const svgFile = `${calKey}.svg`;
      calibration = {
        transform: variant.transform,
        coordinateRotation: variant.coordinateRotation ?? 0,
        bounds: variant.bounds,
        ...(variant.svgBounds ? { svgBounds: variant.svgBounds } : {}),
        svgFile,
      };
      svgDownloads.push({ url: variant.svgPath, file: svgFile });
    }
    maps.push({
      id: raw.id,
      name: raw.name,
      normalizedName: raw.normalizedName,
      ...(raw.wiki ? { wiki: raw.wiki } : {}),
      ...(calibration ? { calibration } : {}),
      spawns: (raw.spawns ?? [])
        .filter((s) => (s.categories ?? []).includes('player'))
        .map((s) => ({
          position: s.position,
          sides: s.sides ?? [],
          categories: s.categories ?? [],
          zoneName: s.zoneName ?? '',
        })),
    });
  }
  return { maps, svgDownloads };
}

function buildObjectivePoints(obj) {
  const points = [];
  for (const zone of obj.zones ?? []) {
    if (zone.position && zone.map) {
      points.push({ id: zone.id, map: zone.map, position: zone.position });
    }
  }
  (obj.possibleLocations ?? []).forEach((loc, locIndex) => {
    (loc.positions ?? []).forEach((position, posIndex) => {
      points.push({ id: `${obj.id}-loc-${locIndex}-${posIndex}`, map: loc.map, position });
    });
  });
  return points;
}

function buildTasks(rawTasks, traderNames) {
  return Object.values(rawTasks).map((raw) => ({
    id: raw.id,
    name: raw.name,
    normalizedName: raw.normalizedName,
    trader: { id: raw.trader, name: traderNames.get(raw.trader) ?? 'Unknown' },
    mapId: raw.map ?? null,
    minPlayerLevel: raw.minPlayerLevel ?? 1,
    factionName: raw.factionName ?? 'Any',
    kappaRequired: raw.kappaRequired ?? false,
    ...(raw.wikiLink ? { wikiLink: raw.wikiLink } : {}),
    experience: raw.experience ?? 0,
    taskRequirements: (raw.taskRequirements ?? []).map((req) => ({
      taskId: req.task,
      status: req.status ?? [],
    })),
    objectives: (raw.objectives ?? [])
      .filter((obj) => !DROPPED_OBJECTIVE_TYPES.has(obj.type))
      .map((obj) => ({
        id: obj.id,
        type: obj.type,
        description: obj.description ?? '',
        optional: obj.optional ?? false,
        maps: obj.maps ?? [],
        points: buildObjectivePoints(obj),
        ...(obj.count !== undefined ? { count: obj.count } : {}),
      })),
  }));
}

async function downloadSvgs(svgDownloads) {
  await mkdir(svgOutDir, { recursive: true });
  const seen = new Set();
  for (const { url, file } of svgDownloads) {
    if (seen.has(file)) continue;
    seen.add(file);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(svgOutDir, file), buf);
    console.log(`  svg ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
  }
}

async function main() {
  console.log('Fetching tarkov.dev data...');
  const [tasksData, mapsData, tradersData, calibrationJson] = await Promise.all([
    fetchTranslated('tasks'),
    fetchTranslated('maps'),
    fetchTranslated('traders'),
    fetchJson(CALIBRATION_URL),
  ]);

  const traderNames = new Map(
    Object.values(tradersData.traders ?? tradersData).map((t) => [t.id, t.name]),
  );

  const calibrationIndex = buildCalibrationIndex(calibrationJson);
  const { maps, svgDownloads } = buildMaps(mapsData.maps, calibrationIndex);
  const tasks = buildTasks(tasksData.tasks, traderNames);

  console.log(`Downloading ${svgDownloads.length} map SVGs...`);
  await downloadSvgs(svgDownloads);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    gameMode: 'regular',
    maps,
    tasks,
  };
  await mkdir(generatedDir, { recursive: true });
  await writeFile(
    path.join(generatedDir, 'snapshot.json'),
    JSON.stringify(snapshot, null, 1),
  );
  console.log(
    `Snapshot written: ${maps.length} maps (${maps.filter((m) => m.calibration).length} renderable), ${tasks.length} tasks.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
