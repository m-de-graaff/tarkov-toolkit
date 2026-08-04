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

if (failures.length > 0) {
  console.error(`snapshot validation FAILED:\n- ${[...new Set(failures)].join('\n- ')}`);
  process.exit(1);
}
console.log(
  `snapshot OK: ${snapshot.maps.length} maps, ${snapshot.tasks.length} tasks, ${tasksWithPoints.length} with located objectives (generated ${snapshot.generatedAt})`,
);
