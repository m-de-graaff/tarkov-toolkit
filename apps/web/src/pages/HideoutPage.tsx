import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HideoutStation } from '@raidplanner/data';
import { snapshot } from '@raidplanner/data';
import { Minus, Plus } from 'lucide-react';
import { maxLevel, nextLevel } from '../lib/neededItems';
import { usePlanner } from '../store';

const stations = [...snapshot.hideout].sort((a, b) => a.name.localeCompare(b.name));

function StationCard({ station }: { station: HideoutStation }) {
  const tracker = usePlanner((s) => s.tracker);
  const setHideoutLevel = usePlanner((s) => s.setHideoutLevel);
  const levels = tracker.hideoutLevels ?? {};
  const current = levels[station.id] ?? 0;
  const max = maxLevel(station);
  const next = nextLevel(station, current);

  return (
    <section className="hideout-station flex flex-col gap-2 rounded-lg border bg-card p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold" title={station.name}>
          {station.name}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-6"
            aria-label={`Lower ${station.name} level`}
            disabled={current === 0}
            onClick={() => setHideoutLevel(station.id, current - 1)}
          >
            <Minus aria-hidden="true" className="size-3" />
          </Button>
          <span className="min-w-10 text-center text-sm font-medium tabular-nums">
            {current} / {max}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-6"
            aria-label={`Raise ${station.name} level`}
            disabled={current >= max}
            onClick={() => setHideoutLevel(station.id, current + 1)}
          >
            <Plus aria-hidden="true" className="size-3" />
          </Button>
        </div>
      </div>

      {next ? (
        <div className="flex flex-col gap-1 text-[13px]">
          <span className="text-xs text-muted-foreground">Level {next.level} needs:</span>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {next.itemRequirements.map((req) => (
              <li key={`${req.itemId}-${req.count}`} className="flex items-center gap-1.5">
                <span className="min-w-0 truncate">
                  {snapshot.itemsLite[req.itemId]?.name ?? 'Unknown item'}
                </span>
                <span className="text-muted-foreground tabular-nums">×{req.count.toLocaleString()}</span>
                {req.foundInRaid && (
                  <Badge variant="outline" className="shrink-0 px-1 text-[9px] text-primary" title="Must be found in raid">
                    FIR
                  </Badge>
                )}
              </li>
            ))}
            {next.stationLevelRequirements.map((req) => {
              const other = snapshot.hideout.find((s) => s.id === req.stationId);
              const met = (levels[req.stationId] ?? 0) >= req.level;
              return (
                <li
                  key={req.stationId}
                  className={cn('text-xs', met ? 'text-ok' : 'text-muted-foreground')}
                >
                  requires {other?.name ?? 'station'} L{req.level} {met ? '✓' : ''}
                </li>
              );
            })}
            {next.traderRequirements.map((req) => (
              <li key={req.traderName} className="text-xs text-muted-foreground">
                requires {req.traderName} LL{req.level}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <span className="text-xs text-ok">Fully built</span>
      )}
    </section>
  );
}

function usePlannerLevels() {
  return usePlanner((s) => s.tracker.hideoutLevels ?? {});
}

export function HideoutPage() {
  const levels = usePlannerLevels();
  const built = stations.filter((s) => (levels[s.id] ?? 0) >= maxLevel(s)).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Hideout</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            Track your station levels — {built} of {stations.length} fully built. What each next
            level needs feeds the Items page.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stations.map((station) => (
            <StationCard key={station.id} station={station} />
          ))}
        </div>
      </div>
    </div>
  );
}
