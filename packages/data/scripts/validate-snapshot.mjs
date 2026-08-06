// Sanity checks on the generated snapshot; run as the data package's test.
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.join(here, '..');
const repoRoot = path.join(dataRoot, '..', '..');
const svgDir = path.join(repoRoot, 'apps', 'web', 'public', 'maps');

const failures = [];
const check = (cond, message) => {
  if (!cond) failures.push(message);
};

const snapshot = JSON.parse(
  await readFile(path.join(dataRoot, 'generated', 'snapshot.json'), 'utf8'),
);

check(snapshot.maps.length >= 13, `expected >= 13 maps, got ${snapshot.maps.length}`);
check(
  !snapshot.maps.some((m) => ['night-factory', 'ground-zero-21', 'the-lab-dark'].includes(m.normalizedName)),
  'merged map variants must not appear in the map list',
);
const renderable = snapshot.maps.filter(
  (m) => m.calibration && (m.calibration.svgFile || m.calibration.tiles),
);
check(renderable.length >= 12, `expected >= 12 renderable maps, got ${renderable.length}`);
check(snapshot.tasks.length >= 520, `expected >= 520 union tasks, got ${snapshot.tasks.length}`);
const pvpOnly = snapshot.tasks.filter((t) => t.modes.length === 1 && t.modes[0] === 'pvp');
const pveOnly = snapshot.tasks.filter((t) => t.modes.length === 1 && t.modes[0] === 'pve');
check(pvpOnly.length >= 15, `expected >= 15 pvp-only tasks, got ${pvpOnly.length}`);
check(pveOnly.length >= 15, `expected >= 15 pve-only tasks, got ${pveOnly.length}`);
check(
  snapshot.tasks.every((t) => Array.isArray(t.modes) && t.modes.length > 0),
  'every task must carry a modes tag',
);
check(
  snapshot.tasks.every((t) => ['Any', 'USEC', 'BEAR'].includes(t.factionName)),
  'factionName must be the Any/USEC/BEAR enum (blind translation once turned Any into "any target")',
);
check(
  snapshot.tasks.filter((t) => t.factionName === 'Any').length > snapshot.tasks.length / 2,
  'most tasks must be faction-neutral',
);

// EFT 1.1 Ragman LL1 quests, covered by manual/task-overrides.json until the
// API catches up. Availability must not depend on the (best-effort) wiki
// rename pass, so the level check keys on ids. Each new-era name may appear
// at most once: twice means the API added a fresh task alongside the patched
// one and the override must be deleted.
const RAGMAN_11_QUESTS = {
  '5ae4493d86f7744b8e15aa8f': 'A Big Loss',
  '5ae448f286f77448d73c0131': 'Fuel Crisis',
  '5ae449c386f7744bde357697': 'Pathfinder',
  '5c10f94386f774227172c572': 'Small Things, Big Help',
  '5ae449b386f77446d8741719': 'Gratitude',
  '5ae4490786f7744ca822adcc': 'Dressed to Kill',
  '60e71dc0a94be721b065bbfc': 'Long Line',
  '5ae448bf86f7744d733e55ee': 'Make ULTRA Great Again',
};
for (const [id, newName] of Object.entries(RAGMAN_11_QUESTS)) {
  const task = snapshot.tasks.find((t) => t.id === id);
  check(task !== undefined, `Ragman 1.1 quest ${id} ("${newName}") missing from snapshot`);
  if (task) {
    check(
      task.minPlayerLevel <= 7,
      `"${newName}" is LL1 in-game but has minPlayerLevel ${task.minPlayerLevel} - override not applied?`,
    );
  }
  const named = snapshot.tasks.filter((t) => t.name === newName);
  check(named.length <= 1, `expected at most one task named "${newName}", got ${named.length}`);
}

const tasksWithPoints = snapshot.tasks.filter((t) =>
  t.objectives.some((o) => o.points.length > 0),
);
check(
  tasksWithPoints.length >= 200,
  `expected >= 200 tasks with located objectives, got ${tasksWithPoints.length}`,
);

const unresolved = snapshot.tasks.filter((t) => /^[0-9a-f]{20,}/.test(t.name));
check(
  unresolved.length === 0,
  `unresolved task names (translation merge failed): ${unresolved
    .slice(0, 3)
    .map((t) => t.id)
    .join(', ')}`,
);

const unresolvedMaps = snapshot.maps.filter((m) => /^[0-9a-f]{20,}/.test(m.name));
check(
  unresolvedMaps.length === 0,
  `unresolved map names (translation merge failed): ${unresolvedMaps
    .slice(0, 3)
    .map((m) => m.normalizedName)
    .join(', ')}`,
);

const mapIds = new Set(snapshot.maps.map((m) => m.id));
const mapsWithTransits = snapshot.maps.filter((m) => (m.transits ?? []).length > 0);
check(
  mapsWithTransits.length >= 5,
  `expected >= 5 maps with transits, got ${mapsWithTransits.length}`,
);
for (const map of snapshot.maps) {
  for (const transit of map.transits ?? []) {
    if (!mapIds.has(transit.targetMapId)) {
      failures.push(`transit ${transit.id} targets unknown map ${transit.targetMapId}`);
    }
  }
}
for (const task of snapshot.tasks) {
  for (const obj of task.objectives) {
    for (const point of obj.points) {
      if (!mapIds.has(point.map)) {
        failures.push(`objective ${obj.id} references unknown map ${point.map}`);
      }
    }
  }
}

for (const map of snapshot.maps) {
  if (!map.calibration?.svgFile) continue;
  try {
    await access(path.join(svgDir, map.calibration.svgFile));
  } catch {
    failures.push(`missing SVG for ${map.normalizedName}: ${map.calibration.svgFile}`);
  }
}

check(snapshot.ammo.length >= 150, `expected >= 150 ammo rounds, got ${snapshot.ammo.length}`);
check(
  new Set(snapshot.ammo.map((a) => a.caliber)).size >= 20,
  'expected >= 20 calibers',
);
check(
  !snapshot.ammo.some((a) => /^[0-9a-f]{20,}/.test(a.name)),
  'ammo names must be translated',
);
check(snapshot.hideout.length >= 20, `expected >= 20 hideout stations, got ${snapshot.hideout.length}`);
check(snapshot.barters.length >= 100, `expected >= 100 barters, got ${snapshot.barters.length}`);
check(snapshot.crafts.length >= 100, `expected >= 100 crafts, got ${snapshot.crafts.length}`);
check(
  snapshot.barters.filter((b) => b.traderName === 'Unknown').length < snapshot.barters.length / 10,
  'too many barters with unknown traders',
);
check(
  snapshot.barters.every((b) => b.rewardItems.length > 0),
  'every barter must offer a reward item',
);
check(
  snapshot.crafts.every((c) => c.rewardItems.length > 0),
  'every craft must produce an item',
);
check(
  snapshot.barters.some((b) => b.traderLevel > 1),
  'barter trader levels must not all be 1 (minTraderLevel parsing)',
);
const missingLite = [
  ...snapshot.hideout.flatMap((s) => s.levels.flatMap((l) => l.itemRequirements.map((r) => r.itemId))),
  ...snapshot.barters.flatMap((b) => b.requiredItems.map((s) => s.itemId)),
].filter((id) => !snapshot.itemsLite[id]);
check(missingLite.length === 0, `itemsLite missing ${missingLite.length} referenced items`);
const neededCount = snapshot.tasks.filter((t) =>
  t.objectives.some((o) => o.neededItems),
).length;
check(neededCount >= 100, `expected >= 100 tasks with needed items, got ${neededCount}`);

if (failures.length > 0) {
  console.error(`snapshot validation FAILED:\n- ${[...new Set(failures)].join('\n- ')}`);
  process.exit(1);
}
console.log(
  `snapshot OK: ${snapshot.maps.length} maps, ${snapshot.tasks.length} tasks, ${tasksWithPoints.length} with located objectives (generated ${snapshot.generatedAt})`,
);
