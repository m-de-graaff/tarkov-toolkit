import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { HideoutStation } from '@raidplanner/data';
import { snapshot } from '@raidplanner/data';
import { Hammer, Minus, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { levelReadiness, nextLevelOf } from '../lib/hideoutReady';
import { maxLevel } from '../lib/neededItems';
import { usePlanner } from '../store';

const stations = [...snapshot.hideout].sort((a, b) => a.name.localeCompare(b.name));

const NO_LEVELS: Record<string, number> = {};
const NO_ITEMS: Record<string, number> = {};

function StationCard({ station }: { station: HideoutStation }) {
  const levels = usePlanner((s) => s.tracker.hideoutLevels ?? NO_LEVELS);
  const itemsHave = usePlanner((s) => s.tracker.itemsHave ?? NO_ITEMS);
  const setHideoutLevel = usePlanner((s) => s.setHideoutLevel);
  const consumeItems = usePlanner((s) => s.consumeItems);

  const current = levels[station.id] ?? 0;
  const max = maxLevel(station);
  const next = nextLevelOf(station, current);
  const readiness = next ? levelReadiness(next, itemsHave, levels) : null;

  const build = () => {
    if (!next) return;
    consumeItems(next.itemRequirements.map((r) => ({ itemId: r.itemId, count: r.count })));
    setHideoutLevel(station.id, current + 1);
  };

  return (
    <section
      className={cn(
        'hideout-station flex flex-col gap-2 rounded-lg border bg-card p-3.5',
        readiness?.ready && 'border-ok/60',
      )}
    >
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
            aria-label={`Undo ${station.name} level`}
            disabled={current === 0}
            title="Lower the built level (does not refund items)"
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
            aria-label={`Set ${station.name} one level higher`}
            disabled={current >= max}
            title="Set the level directly (e.g. already built in game) — uses up any matching materials you've collected, no requirements check"
            onClick={() => {
              if (next) {
                consumeItems(next.itemRequirements.map((r) => ({ itemId: r.itemId, count: r.count })));
              }
              setHideoutLevel(station.id, current + 1);
            }}
          >
            <Plus aria-hidden="true" className="size-3" />
          </Button>
        </div>
      </div>

      {next && readiness ? (
        <div className="flex flex-col gap-1.5 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Level {next.level}</span>
            {readiness.ready ? (
              <Badge className="bg-ok px-1.5 text-[10px] text-white">Ready to build</Badge>
            ) : (
              <span className="text-xs text-muted-foreground tabular-nums">
                {readiness.items.filter((i) => i.met).length}/{readiness.items.length} items
              </span>
            )}
          </div>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {readiness.items.map((item) => (
              <li key={item.itemId} className="flex items-center gap-1.5">
                {snapshot.itemsLite[item.itemId]?.iconLink && (
                  <img
                    src={snapshot.itemsLite[item.itemId].iconLink}
                    alt=""
                    loading="lazy"
                    className="size-5 shrink-0 rounded-sm border bg-black/40 object-contain"
                  />
                )}
                <span className="min-w-0 truncate" title={snapshot.itemsLite[item.itemId]?.name}>
                  {snapshot.itemsLite[item.itemId]?.name ?? 'Unknown item'}
                </span>
                {item.foundInRaid && (
                  <Badge variant="outline" className="shrink-0 px-1 text-[9px] text-primary" title="Must be found in raid">
                    FIR
                  </Badge>
                )}
                <span
                  className={cn(
                    'ml-auto shrink-0 text-xs tabular-nums',
                    item.met ? 'text-ok' : 'text-muted-foreground',
                  )}
                >
                  {item.have.toLocaleString()}/{item.need.toLocaleString()}
                </span>
              </li>
            ))}
            {next.stationLevelRequirements.map((req) => {
              const other = snapshot.hideout.find((s) => s.id === req.stationId);
              const met = (levels[req.stationId] ?? 0) >= req.level;
              return (
                <li key={req.stationId} className={cn('text-xs', met ? 'text-ok' : 'text-muted-foreground')}>
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
          <Button
            type="button"
            variant={readiness.ready ? 'default' : 'outline'}
            size="sm"
            className="mt-1 gap-1.5 self-start"
            disabled={!readiness.ready}
            title={
              readiness.ready
                ? 'Marks the level built and subtracts the materials from your collected items'
                : 'Collect the missing items first (tracked on the Items page)'
            }
            onClick={build}
          >
            <Hammer aria-hidden="true" className="size-3.5" />
            Build level {next.level}
          </Button>
        </div>
      ) : (
        <span className="text-xs text-ok">Fully built</span>
      )}
    </section>
  );
}

export function HideoutPage() {
  const levels = usePlanner((s) => s.tracker.hideoutLevels ?? NO_LEVELS);
  const built = stations.filter((s) => (levels[s.id] ?? 0) >= maxLevel(s)).length;
  const readyCount = usePlanner((s) => {
    const itemsHave = s.tracker.itemsHave ?? NO_ITEMS;
    const hideoutLevels = s.tracker.hideoutLevels ?? NO_LEVELS;
    return stations.filter((station) => {
      const next = nextLevelOf(station, hideoutLevels[station.id] ?? 0);
      return next && levelReadiness(next, itemsHave, hideoutLevels).ready;
    }).length;
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Hideout</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {built} of {stations.length} stations fully built
            {readyCount > 0 && (
              <span className="text-ok"> · {readyCount} ready to build</span>
            )}{' '}
            — collect materials on the{' '}
            <Link to="/items" className="text-primary underline-offset-2 hover:underline">
              Items page
            </Link>
            .
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
