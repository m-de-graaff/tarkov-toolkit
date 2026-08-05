// Dev-time snapshot: pulls quest/map/trader data from json.tarkov.dev plus map
// calibration from the-hideout/tarkov-dev, and downloads per-map SVGs. The app
// itself never touches the network - it imports generated/snapshot.json.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTileNav } from './tile-nav.mjs';
import { applyWikiRenames, fetchWikiRenames } from './wikiRenames.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(here, '..');
const repoRoot = path.join(dataRoot, '..', '..');
const svgOutDir = path.join(repoRoot, 'apps', 'web', 'public', 'maps');
const generatedDir = path.join(dataRoot, 'generated');

const JSON_BASE = 'https://json.tarkov.dev/';
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

async function fetchTranslated(name, prefix = 'regular') {
  const [payload, en] = await Promise.all([
    fetchJson(`${JSON_BASE}${prefix}/${name}`),
    // some datasets (barters, crafts) are pure id references with no dict
    fetchJson(`${JSON_BASE}${prefix}/${name}_en`).catch(() => null),
  ]);
  return en ? applyTranslations(payload.data, en.data) : payload.data;
}

// Replace any string value that is a key in the translation dict. Keys whose
// value is an identifier ('id', 'normalizedName', reference ids) are skipped so
// cross-references stay intact - but ONLY when the value actually is an id
// (a string or an array of strings). Objects always recurse: the API's
// top-level collections share names with reference keys (e.g. data.maps vs
// objective.maps), and skipping the collection leaves its subtree untranslated.
// factionName is an enum (Any/USEC/BEAR) - the blind dictionary substitution
// once "translated" the value 'Any' into the unrelated string 'any target',
// which made every common quest look faction-locked.
const UNTRANSLATED_KEYS = new Set([
  'id',
  'normalizedName',
  'map',
  'maps',
  'task',
  'trader',
  'factionName',
]);

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
      if (variant.svgLayer) calibration.svgLayer = variant.svgLayer;
      if (Array.isArray(variant.heightRange)) calibration.heightRange = variant.heightRange;
      const layers = (variant.layers ?? [])
        .map((l) => ({
          name: l.name,
          ...(l.svgLayer ? { svgLayer: l.svgLayer } : {}),
          ...(l.tilePath ? { tileUrl: l.tilePath } : {}),
          ...(Array.isArray(l.extents?.[0]?.height)
            ? { heightRange: l.extents[0].height }
            : {}),
        }))
        .filter((l) => l.svgLayer || l.tileUrl);
      if (layers.length > 0) calibration.layers = layers;
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

    // Merged variants keep their own nameId/scenePath in the logs - collect
    // them all so log-based map detection resolves variants to the canonical map.
    const logSources = spawnSources;
    const extracts = (raw.extracts ?? [])
      .filter((e) => e.position && e.faction !== 'scav')
      .map((e) => ({
        id: e.id,
        name: e.name,
        faction: e.faction,
        position: e.position,
        conditional: (e.switches ?? []).length > 0,
      }));

    maps.push({
      id: raw.id,
      name: raw.name,
      normalizedName: raw.normalizedName,
      ...(raw.nameId ? { nameId: raw.nameId } : {}),
      ...(raw.scenePath ? { scenePath: raw.scenePath } : {}),
      ...(logSources.length > 1
        ? { altNameIds: logSources.slice(1).map((s) => s.nameId).filter(Boolean) }
        : {}),
      ...(calibration ? { calibration } : {}),
      spawns,
      extracts,
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
    // normalize defensively: anything that isn't a real faction means "Any"
    factionName: ['USEC', 'BEAR'].includes(raw.factionName) ? raw.factionName : 'Any',
    kappaRequired: raw.kappaRequired ?? false,
    ...(raw.wikiLink ? { wikiLink: raw.wikiLink } : {}),
    experience: raw.experience ?? 0,
    taskRequirements: (raw.taskRequirements ?? []).map((req) => ({
      taskId: req.task,
      status: req.status ?? [],
    })),
    objectives: (raw.objectives ?? [])
      .filter((obj) => !DROPPED_OBJECTIVE_TYPES.has(obj.type))
      .map((obj) => {
        const handIn = ['giveItem', 'findItem', 'plantItem'].includes(obj.type);
        const itemIds = handIn
          ? (obj.items ?? (obj.item ? [obj.item] : [])).filter(Boolean)
          : [];
        return {
          id: obj.id,
          type: obj.type,
          description: obj.description ?? '',
          optional: obj.optional ?? false,
          maps: [...new Set((obj.maps ?? []).map(remapId))],
          points: buildObjectivePoints(obj, remapId),
          ...(obj.count !== undefined ? { count: obj.count } : {}),
          ...(itemIds.length > 0
            ? {
                neededItems: {
                  itemIds,
                  count: obj.count ?? 1,
                  foundInRaid: obj.foundInRaid ?? false,
                },
              }
            : {}),
        };
      }),
  }));
}

// Hand-maintained corrections for task data the API lags behind on (see the
// comment field in manual/task-overrides.json). The wiki rename pass heals
// titles; this pass fixes levels, prerequisites, objectives, and XP that
// game patches changed. Each entry patches the task with the matching id and
// self-retires once the API reports the expected player level, so a stale
// entry can never fight fresh upstream data.
async function applyManualOverrides(tasks) {
  const { overrides } = JSON.parse(
    await readFile(path.join(dataRoot, 'manual', 'task-overrides.json'), 'utf8'),
  );
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const entry of overrides) {
    const task = byId.get(entry.id);
    if (!task) {
      console.warn(`  override ${entry.id}: task absent from API data, skipped`);
      continue;
    }
    if (task.minPlayerLevel <= entry.retireWhenApiMinPlayerLevelAtMost) {
      console.log(
        `  override for "${task.name}" retired - the API caught up, delete it from task-overrides.json`,
      );
      continue;
    }
    Object.assign(task, entry.set);
  }
}

function buildAmmo(itemsData) {
  return Object.values(itemsData.items)
    .filter((item) => item.properties?.propertiesType === 'ItemPropertiesAmmo')
    .map((item) => ({
      id: item.id,
      name: item.name,
      shortName: item.shortName,
      ...(item.iconLink ? { iconLink: item.iconLink } : {}),
      caliber: (item.properties.caliber ?? '').replace(/^Caliber/, ''),
      damage: item.properties.damage ?? 0,
      penetrationPower: item.properties.penetrationPower ?? 0,
      armorDamage: item.properties.armorDamage ?? 0,
      fragmentationChance: item.properties.fragmentationChance ?? 0,
      initialSpeed: item.properties.initialSpeed ?? 0,
      tracer: item.properties.tracer ?? false,
      projectileCount: item.properties.projectileCount ?? 1,
    }))
    .filter((round) => round.caliber && round.damage > 0)
    .sort((a, b) => a.caliber.localeCompare(b.caliber) || b.penetrationPower - a.penetrationPower);
}

function buildHideout(hideoutData, traderNames) {
  return Object.values(hideoutData.hideoutStations ?? hideoutData).map((station) => ({
    id: station.id,
    name: station.name,
    normalizedName: station.normalizedName,
    levels: (station.levels ?? []).map((level) => ({
      level: level.level,
      constructionTime: level.constructionTime ?? 0,
      itemRequirements: (level.itemRequirements ?? []).map((req) => ({
        itemId: req.item,
        count: req.count ?? 1,
        foundInRaid: req.attributes?.foundInRaid ?? false,
      })),
      stationLevelRequirements: (level.stationLevelRequirements ?? []).map((req) => ({
        stationId: req.station,
        level: req.level,
      })),
      traderRequirements: (level.traderRequirements ?? []).map((req) => ({
        traderName: traderNames.get(req.trader) ?? 'Unknown',
        level: req.level ?? req.value ?? 1,
      })),
    })),
  }));
}

const stacks = (list) =>
  (list ?? [])
    .filter((entry) => entry.item)
    .map((entry) => ({
      itemId: entry.item,
      count: entry.count ?? 1,
      ...(entry.attributes?.tool ? { tool: true } : {}),
    }));

// The API gives a single result item per trade: barters have `offeredItem`,
// crafts have `productItem`.
function buildBarters(bartersData, traderNames) {
  return Object.values(bartersData.barters ?? bartersData).map((barter) => ({
    id: barter.id,
    traderName: traderNames.get(barter.trader) ?? 'Unknown',
    traderLevel: barter.minTraderLevel ?? 1,
    taskLocked: barter.taskUnlock != null,
    buyLimit: barter.buyLimit ?? 0,
    requiredItems: stacks(barter.requiredItems),
    rewardItems: stacks(barter.offeredItem ? [barter.offeredItem] : []),
  }));
}

function buildCrafts(craftsData) {
  return Object.values(craftsData.crafts ?? craftsData).map((craft) => ({
    id: craft.id,
    stationId: craft.station,
    stationLevel: craft.level ?? 1,
    durationSeconds: craft.duration ?? 0,
    requiredItems: stacks(craft.requiredItems),
    rewardItems: stacks(craft.productItem ? [craft.productItem] : []),
  }));
}

function buildItemsLite(itemsData, referencedIds) {
  const lite = {};
  for (const id of referencedIds) {
    const item = itemsData.items[id];
    if (!item) continue;
    lite[id] = {
      name: item.name,
      shortName: item.shortName,
      ...(item.iconLink ? { iconLink: item.iconLink } : {}),
    };
  }
  return lite;
}

async function downloadSvgs(svgDownloads) {
  await mkdir(svgOutDir, { recursive: true });
  const seen = new Set();
  for (const { url, file } of svgDownloads) {
    if (seen.has(file)) continue;
    seen.add(file);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    // ship tarkov.dev's own styling so SVG maps match the tile maps' look
    const raw = Buffer.from(await res.arrayBuffer()).toString('utf8');
    await writeFile(path.join(svgOutDir, file), raw);
    console.log(`  svg ${file} (${(raw.length / 1024).toFixed(0)} KB)`);
  }
}

async function main() {
  console.log('Fetching tarkov.dev data...');
  const [tasksData, pveTasksData, mapsData, tradersData, calibrationJson] = await Promise.all([
    fetchTranslated('tasks'),
    fetchTranslated('tasks', 'pve'),
    fetchTranslated('maps'),
    fetchTranslated('traders'),
    fetchJson(CALIBRATION_URL),
  ]);
  console.log('Fetching items/hideout/barters/crafts...');
  const [itemsData, hideoutData, bartersData, craftsData] = await Promise.all([
    fetchTranslated('items'),
    fetchTranslated('hideout'),
    fetchTranslated('barters'),
    fetchTranslated('crafts'),
  ]);

  const traderNames = new Map(
    Object.values(tradersData.traders ?? tradersData).map((t) => [t.id, t.name]),
  );

  const calibrationIndex = buildCalibrationIndex(calibrationJson);
  const { maps, svgDownloads, idRemap } = buildMaps(mapsData.maps, calibrationIndex);

  // Union of both game modes' quest sets, each task tagged with the modes it
  // exists in (~95% overlap; PvP-only and PvE-only tails are real).
  const pveIds = new Set(Object.keys(pveTasksData.tasks));
  const tasks = buildTasks(tasksData.tasks, traderNames, idRemap).map((task) => ({
    ...task,
    modes: pveIds.has(task.id) ? ['pvp', 'pve'] : ['pvp'],
  }));
  const pvpIds = new Set(tasks.map((t) => t.id));
  const pveOnlyRaw = Object.fromEntries(
    Object.entries(pveTasksData.tasks).filter(([id]) => !pvpIds.has(id)),
  );
  const pveOnlyTasks = buildTasks(pveOnlyRaw, traderNames, idRemap).map((task) => ({
    ...task,
    modes: ['pve'],
  }));
  tasks.push(...pveOnlyTasks);

  // Game patches rename quests and tarkov.dev lags; the wiki has the
  // in-game names within hours and leaves redirects from the old titles.
  // Best-effort: a wiki outage must not block the snapshot.
  try {
    console.log('Checking the wiki for quest renames...');
    const renames = await fetchWikiRenames(tasks.map((t) => t.name), fetchJson);
    const renamed = applyWikiRenames(tasks, renames);
    console.log(`  ${renamed} quest name(s) updated to their current in-game titles.`);
  } catch (err) {
    console.log(`  wiki rename pass skipped: ${err.message}`);
  }

  console.log('Applying manual task overrides...');
  await applyManualOverrides(tasks);

  console.log(`Downloading ${svgDownloads.length} map SVGs...`);
  await downloadSvgs(svgDownloads);

  console.log('Generating walkability masks for tile-only maps...');
  await generateTileNav(maps);

  const ammo = buildAmmo(itemsData);
  const hideout = buildHideout(hideoutData, traderNames);
  const barters = buildBarters(bartersData, traderNames);
  const crafts = buildCrafts(craftsData);

  const referencedIds = new Set([
    ...tasks.flatMap((t) => t.objectives.flatMap((o) => o.neededItems?.itemIds ?? [])),
    ...hideout.flatMap((s) =>
      s.levels.flatMap((l) => l.itemRequirements.map((r) => r.itemId)),
    ),
    ...barters.flatMap((b) => [...b.requiredItems, ...b.rewardItems].map((s) => s.itemId)),
    ...crafts.flatMap((c) => [...c.requiredItems, ...c.rewardItems].map((s) => s.itemId)),
  ]);
  const itemsLite = buildItemsLite(itemsData, referencedIds);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    gameMode: 'regular',
    maps,
    tasks,
    ammo,
    hideout,
    barters,
    crafts,
    itemsLite,
    traders: Object.fromEntries(traderNames),
  };
  await mkdir(generatedDir, { recursive: true });
  await writeFile(
    path.join(generatedDir, 'snapshot.json'),
    JSON.stringify(snapshot, null, 1),
  );
  console.log(
    `Snapshot written: ${maps.length} maps (${maps.filter((m) => m.calibration).length} renderable), ` +
      `${tasks.length} tasks, ${ammo.length} ammo, ${hideout.length} stations, ` +
      `${barters.length} barters, ${crafts.length} crafts, ${Object.keys(itemsLite).length} lite items.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
