import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { snapshot } from '@raidplanner/data';
import { useMemo, useState } from 'react';
import { snapshotForMode } from '../lib/modeTasks';
import { neededItems } from '../lib/neededItems';
import { usePlanner } from '../store';

export function ItemsPage() {
  const tracker = usePlanner((s) => s.tracker);
  const gameMode = usePlanner((s) => s.gameMode);
  const [search, setSearch] = useState('');

  const rows = useMemo(
    () =>
      neededItems(snapshotForMode(snapshot, gameMode), tracker, tracker.hideoutLevels ?? {}),
    [tracker, gameMode],
  );

  const visible = rows.filter((row) => {
    if (!search) return true;
    const item = snapshot.itemsLite[row.itemId];
    return (item?.name ?? '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Items to keep</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything your open quests and next hideout upgrades consume — check it before you
            sell or discard loot. FIR counts must come out of a raid with you.
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

        {visible.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
            Nothing needed right now — set up your progress and hideout levels first.
          </p>
        ) : (
          <ul className="needed-items m-0 flex list-none flex-col p-0">
            {visible.map((row) => {
              const item = snapshot.itemsLite[row.itemId];
              return (
                <li
                  key={row.itemId}
                  className="flex items-center gap-2.5 border-b py-2 text-[13px] last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate" title={item?.name}>
                    {item?.name ?? 'Unknown item'}
                  </span>
                  <span
                    className="shrink-0 text-xs text-muted-foreground"
                    title={row.sources.join(' · ')}
                  >
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
                  <span className="w-16 shrink-0 text-right font-medium tabular-nums">
                    ×{row.total.toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
