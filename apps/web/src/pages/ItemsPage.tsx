import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { snapshot } from '@raidplanner/data';
import { Check, Minus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { snapshotForMode } from '../lib/modeTasks';
import type { NeededItemRow } from '../lib/neededItems';
import { neededItems } from '../lib/neededItems';
import { usePlanner } from '../store';

function HaveStepper({ row }: { row: NeededItemRow }) {
  const have = usePlanner((s) => Math.min(s.tracker.itemsHave?.[row.itemId] ?? 0, row.total));
  const setItemHave = usePlanner((s) => s.setItemHave);
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-6"
        aria-label="One fewer collected"
        disabled={have === 0}
        onClick={() => setItemHave(row.itemId, have - 1)}
      >
        <Minus aria-hidden="true" className="size-3" />
      </Button>
      <Input
        type="number"
        min={0}
        max={row.total}
        value={have}
        onChange={(e) => setItemHave(row.itemId, Math.min(row.total, Number(e.target.value) || 0))}
        aria-label={`Collected ${snapshot.itemsLite[row.itemId]?.name ?? 'item'}`}
        className="h-6 w-14 px-1 text-center text-xs tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-6"
        aria-label="One more collected"
        disabled={have >= row.total}
        onClick={() => setItemHave(row.itemId, have + 1)}
      >
        <Plus aria-hidden="true" className="size-3" />
      </Button>
    </span>
  );
}

function ItemRow({ row }: { row: NeededItemRow }) {
  const have = usePlanner((s) => Math.min(s.tracker.itemsHave?.[row.itemId] ?? 0, row.total));
  const item = snapshot.itemsLite[row.itemId];
  const done = have >= row.total;
  const remaining = row.total - have;
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b py-2 last:border-0',
        done && 'opacity-70',
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {item?.iconLink && (
          <img
            src={item.iconLink}
            alt=""
            loading="lazy"
            className="size-6 shrink-0 rounded-sm border bg-black/40 object-contain"
          />
        )}
        <span className={cn('min-w-0 truncate text-[13px]', done && 'line-through')} title={item?.name}>
          {item?.name ?? 'Unknown item'}
        </span>
        {done && <Check aria-hidden="true" className="size-3.5 shrink-0 text-ok" />}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground" title={row.sources.join(' · ')}>
        {row.sources.length} source{row.sources.length > 1 ? 's' : ''}
      </span>
      {row.firCount > 0 && (
        <Badge
          variant="outline"
          className="shrink-0 px-1.5 text-[10px] text-primary"
          title="This many must be found in raid"
        >
          {row.firCount} FIR
        </Badge>
      )}
      <span
        className={cn(
          'w-24 shrink-0 text-right text-xs tabular-nums',
          done ? 'text-ok' : 'text-muted-foreground',
        )}
      >
        {done ? 'complete' : `${remaining} still needed`}
      </span>
      <HaveStepper row={row} />
    </li>
  );
}

export function ItemsPage() {
  const tracker = usePlanner((s) => s.tracker);
  const gameMode = usePlanner((s) => s.gameMode);
  const [search, setSearch] = useState('');

  const rows = useMemo(
    () => neededItems(snapshotForMode(snapshot, gameMode), tracker, tracker.hideoutLevels ?? {}),
    [tracker, gameMode],
  );

  const visible = rows.filter((row) => {
    if (!search) return true;
    return (snapshot.itemsLite[row.itemId]?.name ?? '').toLowerCase().includes(search.toLowerCase());
  });
  const itemsHave = tracker.itemsHave ?? {};
  const open = visible.filter((r) => (itemsHave[r.itemId] ?? 0) < r.total);
  const covered = visible.filter((r) => (itemsHave[r.itemId] ?? 0) >= r.total);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Items to keep</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything your open quests and next{' '}
            <Link to="/hideout" className="text-primary underline-offset-2 hover:underline">
              hideout
            </Link>{' '}
            upgrades consume. Count what you've collected — stations turn "ready to build" when
            you have everything.
          </p>
        </div>

        <Input
          type="search"
          placeholder="Search items…"
          aria-label="Search items"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />

        {open.length === 0 && covered.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
            Nothing needed right now — set up your progress and hideout levels first.
          </p>
        ) : (
          <>
            <ul className="needed-items m-0 flex list-none flex-col p-0">
              {open.map((row) => (
                <ItemRow key={row.itemId} row={row} />
              ))}
            </ul>
            {covered.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[13px] text-muted-foreground">
                  Fully collected ({covered.length})
                </summary>
                <ul className="m-0 flex list-none flex-col p-0">
                  {covered.map((row) => (
                    <ItemRow key={row.itemId} row={row} />
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
