import type { GamePosition, RpMap, RpSpawn } from '@raidplanner/data';
import { useMemo } from 'react';
import { usePlanner } from '../store';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}/i;

export interface SpawnOption {
  key: string;
  label: string;
  position: GamePosition;
}

function cardinal(p: GamePosition, center: { x: number; z: number }): string {
  const dx = p.x - center.x;
  const dz = p.z - center.z;
  const angle = (Math.atan2(dx, dz) * 180) / Math.PI; // 0 = +z ("N")
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(((angle + 360) % 360) / 45) % 8];
}

/**
 * PMC spawn options for a map. The API's PMC zoneNames are mostly UUIDs, so
 * labels are derived from the spawn's position (cardinal direction relative to
 * the map centre) unless the zone name is human-readable.
 */
export function spawnOptions(map: RpMap): SpawnOption[] {
  const pmc = map.spawns.filter(
    (s: RpSpawn) => s.sides.includes('pmc') || s.sides.includes('all'),
  );
  const bounds = map.calibration?.bounds;
  const center = bounds
    ? { x: (bounds[0][0] + bounds[1][0]) / 2, z: (bounds[0][1] + bounds[1][1]) / 2 }
    : { x: 0, z: 0 };

  const seen = new Set<string>();
  const options: SpawnOption[] = [];
  const counts = new Map<string, number>();
  for (const spawn of pmc) {
    const dedupeKey = spawn.zoneName || `${spawn.position.x},${spawn.position.z}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const readable = spawn.zoneName && !UUID_RE.test(spawn.zoneName);
    const base = readable ? spawn.zoneName : `Spawn ${cardinal(spawn.position, center)}`;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    options.push({
      key: dedupeKey,
      label: n > 1 ? `${base} ${n}` : base,
      position: spawn.position,
    });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function SpawnPicker({ map }: { map: RpMap }) {
  const spawn = usePlanner((s) => s.spawn);
  const setSpawn = usePlanner((s) => s.setSpawn);

  const options = useMemo(() => spawnOptions(map), [map]);

  const currentKey =
    spawn?.kind === 'zone' ? spawn.zoneName : spawn?.kind === 'custom' ? 'custom' : '';

  return (
    <label className="spawn-picker">
      <span>Spawn</span>
      <select
        value={currentKey}
        onChange={(e) => {
          const option = options.find((o) => o.key === e.target.value);
          setSpawn(
            option ? { kind: 'zone', zoneName: option.key, position: option.position } : null,
          );
        }}
      >
        <option value="">— none (or click the map) —</option>
        {spawn?.kind === 'custom' && (
          <option value="custom">
            Custom ({spawn.position.x.toFixed(0)}, {spawn.position.z.toFixed(0)})
          </option>
        )}
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
