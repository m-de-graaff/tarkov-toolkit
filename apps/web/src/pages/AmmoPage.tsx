import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { snapshot } from '@raidplanner/data';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AmmoSortKey } from '../lib/ammoSort';
import { filterAmmo, penTier, sortAmmo, totalDamage } from '../lib/ammoSort';

const ALL = '__all__';
const calibers = [...new Set(snapshot.ammo.map((a) => a.caliber))].sort();

const TIER_CLASSES = [
  'bg-destructive/20 text-destructive',        // 0 flesh only
  'bg-destructive/15 text-destructive/90',
  'bg-primary/10 text-primary/70',
  'bg-primary/20 text-primary',
  'bg-ok/15 text-ok',
  'bg-ok/25 text-ok',
  'bg-ok/40 text-ok',
];

const COLUMNS: { key: AmmoSortKey; label: string; title: string }[] = [
  { key: 'damage', label: 'Damage', title: 'Flesh damage (× pellets for buckshot)' },
  { key: 'penetrationPower', label: 'Pen', title: 'Penetration power — colored by the armor class it reliably defeats' },
  { key: 'armorDamage', label: 'Armor dmg', title: 'Armor durability damage %' },
  { key: 'fragmentationChance', label: 'Frag', title: 'Fragmentation chance' },
  { key: 'initialSpeed', label: 'Velocity', title: 'Muzzle velocity m/s' },
];

export function AmmoPage() {
  const [caliber, setCaliber] = useState<string>(ALL);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<AmmoSortKey>('penetrationPower');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  const rounds = useMemo(
    () => sortAmmo(filterAmmo(snapshot.ammo, caliber === ALL ? null : caliber, search), sortKey, direction),
    [caliber, search, sortKey, direction],
  );

  const onSort = (key: AmmoSortKey) => {
    if (key === sortKey) setDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setDirection('desc');
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Ammo chart</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pen color shows the armor class a round reliably defeats — green means it goes
            through.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select value={caliber} onValueChange={setCaliber}>
            <SelectTrigger className="h-9 w-52" aria-label="Caliber">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All calibers</SelectItem>
              {calibers.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="search"
            placeholder="Search rounds…"
            aria-label="Search rounds"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 max-w-56 flex-1"
          />
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {rounds.length} rounds
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="ammo-table w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b bg-card text-left">
                <th className="px-3 py-2 font-medium">Round</th>
                <th className="px-3 py-2 font-medium">Caliber</th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      title={col.title}
                      className={cn(
                        'flex w-full items-center gap-1 rounded px-2 py-1 text-left font-medium hover:bg-secondary',
                        sortKey === col.key && 'text-primary',
                      )}
                    >
                      {col.label}
                      {sortKey === col.key &&
                        (direction === 'desc' ? (
                          <ArrowDown aria-hidden="true" className="size-3" />
                        ) : (
                          <ArrowUp aria-hidden="true" className="size-3" />
                        ))}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => (
                <tr key={round.id} className="border-b last:border-0 hover:bg-secondary/50">
                  <td className="px-3 py-1.5" title={round.name}>
                    {round.shortName}
                    {round.tracer && (
                      <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">tracer</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{round.caliber}</td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {totalDamage(round)}
                    {round.projectileCount > 1 && (
                      <span className="text-xs text-muted-foreground"> ({round.damage}×{round.projectileCount})</span>
                    )}
                  </td>
                  <td className="px-1.5 py-1">
                    <span
                      className={cn(
                        'inline-block min-w-10 rounded px-2 py-0.5 text-center font-medium tabular-nums',
                        TIER_CLASSES[penTier(round.penetrationPower)],
                      )}
                      title={`Defeats armor class ${penTier(round.penetrationPower)}`}
                    >
                      {round.penetrationPower}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{round.armorDamage}%</td>
                  <td className="px-3 py-1.5 tabular-nums">{Math.round(round.fragmentationChance * 100)}%</td>
                  <td className="px-3 py-1.5 tabular-nums">{round.initialSpeed} m/s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
