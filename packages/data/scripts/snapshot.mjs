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

// Map variants that are the same place gameplay-wise: fold them into the
// canonical map (their quests, points, and spawns move over; the variant
// disappears from the map list).
const MERGED_INTO = {
  'night-factory': 'factory',
  'ground-zero-21': 'ground-zero',
  'the-lab-dark': 'the-lab',
};

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
// cross-references stay intact — but ONLY when the value actually is an id
// (a string or an array of strings). Objects always recurse: the API's
// top-level collections share names with reference keys (e.g. data.maps vs
// objective.maps), and skipping the collection leaves its subtree untranslated.
const UNTRANSLATED_KEYS = new Set(['id', 'normalizedName', 'map', 'maps', 'task', 'trader']);

function isIdValue(value) {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((v) => typeof v === 'string'))
  );
}

function applyTranslations(node, dict, parentKey) {
  if (Array.isArray(node)) {
    return node.map((v) => applyTranslations(v, dict, parentKey));
  }
  if (node && typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      out[key] =
        UNTRANSLATED_KEYS.has(key) && isIdValue(value)
          ? value
          : applyTranslations(value, dict, key);
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
    // The "interactive" variant carries the calibration; it may have an SVG,
    // a tile pyramid, or both.
    const variant = (entry.maps ?? []).find((m) => m.svgPath || m.tilePath);
    if (variant) index.set(entry.normalizedName, variant);
  }
  return index;
}

function buildMaps(rawMaps, calibrationIndex) {
  const maps = [];
  const svgDownloads = [];
  /** merged-variant map id -> canonical map id */
  const idRemap = new Map();
  const byNormalized = new Map(
    Object.values(rawMaps).map((raw) => [raw.normalizedName, raw]),
  );

  for (const raw of Object.values(rawMaps)) {
    const mergeTarget = MERGED_INTO[raw.normalizedName];
    if (mergeTarget && byNormalized.has(mergeTarget)) {
      idRemap.set(raw.id, byNormalized.get(mergeTarget).id);
      continue;
    }

    const variant = calibrationIndex.get(raw.normalizedName);
    let calibration;
    if (variant) {
      calibration = {
        transform: variant.transform,
        coordinateRotation: variant.coordinateRotation ?? 0,
        bounds: variant.bounds,
        ...(variant.svgBounds ? { svgBounds: variant.svgBounds } : {}),
      };
      if (variant.svgPath) {
        const svgFile = `${raw.normalizedName}.svg`;
        calibration.svgFile = svgFile;
        svgDownloads.push({ url: variant.svgPath, file: svgFile });
      }
      if (variant.tilePath) {
        calibration.tiles = {
          url: variant.tilePath,
          tileSize: variant.tileSize ?? 256,
          minZoom: variant.minZoom ?? 1,
          maxZoom: variant.maxZoom ?? 6,
        };
      }
    }

    const spawnSources = [raw, ...Object.entries(MERGED_INTO)
      .filter(([, target]) => target === raw.normalizedName)
      .map(([variantName]) => byNormalized.get(variantName))
      .filter(Boolean)];
    const seenSpawns = new Set();
    const spawns = [];
    for (const source of spawnSources) {
      for (const s of (source.spawns ?? []).filter((sp) =>
        (sp.categories ?? []).includes('player'),
      )) {
        const key = s.zoneName || `${s.position.x},${s.position.z}`;
        if (seenSpawns.has(key)) continue;
        seenSpawns.add(key);
        spawns.push({
          position: s.position,
          sides: s.sides ?? [],
          categories: s.categories ?? [],
          zoneName: s.zoneName ?? '',
        });
      }
    }

    maps.push({
      id: raw.id,
      name: raw.name,
      normalizedName: raw.normalizedName,
      ...(raw.wiki ? { wiki: raw.wiki } : {}),
      ...(calibration ? { calibration } : {}),
      spawns,
    });
  }
  return { maps, svgDownloads, idRemap };
}

function buildObjectivePoints(obj, remapId) {
  const points = [];
  const seen = new Set();
  const push = (id, map, position) => {
    const mapped = remapId(map);
    const key = `${mapped}:${position.x},${position.y},${position.z}`;
    if (seen.has(key)) return; // merged map variants often duplicate points
    seen.add(key);
    points.push({ id, map: mapped, position });
  };
  for (const zone of obj.zones ?? []) {
    if (zone.position && zone.map) push(zone.id, zone.map, zone.position);
  }
  (obj.possibleLocations ?? []).forEach((loc, locIndex) => {
    (loc.positions ?? []).forEach((position, posIndex) => {
      push(`${obj.id}-loc-${locIndex}-${posIndex}`, loc.map, position);
    });
  });
  return points;
}

function buildTasks(rawTasks, traderNames, idRemap) {
  const remapId = (id) => idRemap.get(id) ?? id;
  return Object.values(rawTasks).map((raw) => ({
    id: raw.id,
    name: raw.name,
    normalizedName: raw.normalizedName,
    trader: { id: raw.trader, name: traderNames.get(raw.trader) ?? 'Unknown' },
    mapId: raw.map ? remapId(raw.map) : null,
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
        maps: [...new Set((obj.maps ?? []).map(remapId))],
        points: buildObjectivePoints(obj, remapId),
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
  const { maps, svgDownloads, idRemap } = buildMaps(mapsData.maps, calibrationIndex);
  const tasks = buildTasks(tasksData.tasks, traderNames, idRemap);

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
