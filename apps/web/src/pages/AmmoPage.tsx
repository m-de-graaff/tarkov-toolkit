import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { AmmoRound } from '@raidplanner/data';
import { snapshot } from '@raidplanner/data';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AmmoSortKey, Effectiveness } from '../lib/ammoSort';
import { classEffectiveness, filterAmmo, sortAmmo, totalDamage } from '../lib/ammoSort';

const ALL = '__all__';
const calibers = [...new Set(snapshot.ammo.map((a) => a.caliber))].sort();

const EFFECT_STYLE: Record<Effectiveness, { cls: string; glyph: string; label: string }> = {
  excellent: { cls: 'bg-ok/60 text-white', glyph: '●', label: 'penetrates reliably' },
  good: { cls: 'bg-ok/30 text-ok', glyph: '◕', label: 'penetrates well' },
  fair: { cls: 'bg-primary/25 text-primary', glyph: '◑', label: 'inconsistent' },
  poor: { cls: 'bg-destructive/20 text-destructive', glyph: '◔', label: 'mostly bounces' },
  none: { cls: 'bg-secondary text-muted-foreground', glyph: '·', label: 'does not penetrate' },
};

function ClassBlocks({ round }: { round: AmmoRound }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={armorSummary(round)}>
      {[1, 2, 3, 4, 5, 6].map((armorClass) => {
        const effect = classEffectiveness(round.penetrationPower, armorClass);
        const style = EFFECT_STYLE[effect];
        return (
          <span
            key={armorClass}
            title={`Class ${armorClass}: ${style.label}`}
            className={cn(
              'flex h-6 w-7 items-center justify-center rounded-[3px] text-[11px] leading-none',
              style.cls,
            )}
          >
            {style.glyph}
          </span>
        );
      })}
    </div>
  );
}

function armorSummary(round: AmmoRound): string {
  const best = [6, 5, 4, 3, 2, 1].find(
    (c) => classEffectiveness(round.penetrationPower, c) !== 'none',
  );
  return best ? `effective up to armor class ${best}` : 'flesh damage only';
}

const COLUMNS: { key: AmmoSortKey; label: string; title: string }[] = [
  { key: 'damage', label: 'Damage', title: 'Flesh damage (× pellets for buckshot)' },
  { key: 'penetrationPower', label: 'Pen', title: 'Penetration power' },
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
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Ammo chart</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The C1–C6 blocks show how each round handles armor classes 1 through 6 — solid green
            means it goes straight through, dim means it bounces.
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
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Round</th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      title={col.title}
                      className={cn(
                        'flex w-full items-center gap-1 whitespace-nowrap rounded px-2 py-1 text-left text-xs font-medium hover:bg-secondary',
                        sortKey === col.key ? 'text-primary' : 'text-muted-foreground',
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
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span className="flex gap-0.5">
                    {[1, 2, 3, 4, 5, 6].map((c) => (
                      <span key={c} className="flex h-5 w-7 items-center justify-center text-[10px]">
                        C{c}
                      </span>
                    ))}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => (
                <tr key={round.id} className="border-b last:border-0 hover:bg-secondary/40">
                  <td className="px-3 py-1.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {round.iconLink && (
                        <img
                          src={round.iconLink}
                          alt=""
                          loading="lazy"
                          className="size-6 shrink-0 rounded-sm border bg-black/40 object-contain"
                        />
                      )}
                      <span className="min-w-0 truncate font-medium" title={round.name}>
                        {round.shortName}
                      </span>
                      {round.tracer && (
                        <span className="shrink-0 text-[10px] uppercase text-muted-foreground">tracer</span>
                      )}
                      {caliber === ALL && (
                        <span className="shrink-0 text-xs text-muted-foreground">{round.caliber}</span>
                      )}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                    {totalDamage(round)}
                    {round.projectileCount > 1 && (
                      <span className="text-xs text-muted-foreground"> ({round.damage}×{round.projectileCount})</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-medium tabular-nums">
                    {round.penetrationPower}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{round.armorDamage}%</td>
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                    {Math.round(round.fragmentationChance * 100)}%
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{round.initialSpeed}</td>
                  <td className="px-3 py-1.5">
                    <ClassBlocks round={round} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
