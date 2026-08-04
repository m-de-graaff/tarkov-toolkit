import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { snapshot } from '@raidplanner/data';
import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchPrices, loadCachedPrices, type CachedPrices } from '../lib/prices';
import { barterProfit, craftProfit, type TradeProfit } from '../lib/profit';

const rub = (n: number) => `₽${Math.round(n).toLocaleString()}`;

function ProfitCell({ profit }: { profit: TradeProfit }) {
  if (profit.profit === null) {
    return (
      <span className="text-xs text-muted-foreground" title="An item in this trade has no flea price">
        no price
      </span>
    );
  }
  return (
    <span
      className={cn('font-medium tabular-nums', profit.profit >= 0 ? 'text-ok' : 'text-destructive')}
    >
      {profit.profit >= 0 ? '+' : ''}
      {rub(profit.profit)}
    </span>
  );
}

function ItemsCell({ stacks }: { stacks: { itemId: string; count: number }[] }) {
  return (
    <span className="text-muted-foreground">
      {stacks
        .map((s) => `${snapshot.itemsLite[s.itemId]?.shortName ?? '?'}${s.count > 1 ? ` ×${s.count}` : ''}`)
        .join(' + ')}
    </span>
  );
}

export function MarketPage() {
  const [tab, setTab] = useState<'barters' | 'crafts'>('barters');
  const [cached, setCached] = useState<CachedPrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void loadCachedPrices().then((c) => setCached((prev) => prev ?? c));
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setCached(await fetchPrices());
    } catch {
      setError("Couldn't fetch prices — are you online?");
    } finally {
      setLoading(false);
    }
  };

  const prices = cached?.prices ?? null;

  const stationName = (id: string) =>
    snapshot.hideout.find((s) => s.id === id)?.name ?? 'Station';

  const matches = (stacks: { itemId: string }[]) =>
    !search ||
    stacks.some((s) =>
      (snapshot.itemsLite[s.itemId]?.name ?? '').toLowerCase().includes(search.toLowerCase()),
    );

  const barterRows = useMemo(() => {
    if (!prices) return [];
    return snapshot.barters
      .filter((b) => matches([...b.requiredItems, ...b.rewardItems]))
      .map((b) => ({ barter: b, profit: barterProfit(b, prices) }))
      .sort((a, b) => (b.profit.profit ?? -Infinity) - (a.profit.profit ?? -Infinity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, search]);

  const craftRows = useMemo(() => {
    if (!prices) return [];
    return snapshot.crafts
      .filter((c) => matches([...c.requiredItems, ...c.rewardItems]))
      .map((c) => ({ craft: c, profit: craftProfit(c, prices) }))
      .sort(
        (a, b) => (b.profit.profitPerHour ?? -Infinity) - (a.profit.profitPerHour ?? -Infinity),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, search]);

  const ageMinutes = cached ? Math.round((Date.now() - cached.fetchedAt) / 60000) : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Market — barters & crafts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Is the trade worth it? Costs and revenues use 24h-average flea prices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div role="group" aria-label="Trade type" className="flex items-center rounded-md border p-0.5">
            {(['barters', 'crafts'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-[5px] px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                  tab === t ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Input
            type="search"
            placeholder="Search items…"
            aria-label="Search trades by item"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 max-w-56 flex-1"
          />
          <div className="ml-auto flex items-center gap-2">
            {ageMinutes !== null && (
              <span className="text-xs text-muted-foreground tabular-nums">
                prices {ageMinutes < 60 ? `${ageMinutes}m` : `${Math.round(ageMinutes / 60)}h`} old
              </span>
            )}
            <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={loading} onClick={() => void refresh()}>
              <RefreshCw aria-hidden="true" className={cn('size-3.5', loading && 'animate-spin')} />
              {cached ? 'Refresh prices' : 'Load prices (~16 MB)'}
            </Button>
          </div>
        </div>

        {error && <p className="text-[13px] text-destructive">{error}</p>}
        {!cached && !loading && !error && (
          <p className="rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
            Flea prices are the one thing that can't ship offline — load them once and they're
            cached until you refresh.
          </p>
        )}

        {prices && tab === 'barters' && (
          <ul className="m-0 flex list-none flex-col p-0 text-[13px]">
            {barterRows.map(({ barter, profit }) => (
              <li key={barter.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 border-b py-2 last:border-0">
                <span className="shrink-0 text-xs text-muted-foreground">
                  {barter.traderName} LL{barter.traderLevel}
                </span>
                <ItemsCell stacks={barter.requiredItems} />
                <span aria-hidden="true" className="text-muted-foreground">→</span>
                <span className="min-w-0 font-medium">
                  {barter.rewardItems
                    .map((s) => `${snapshot.itemsLite[s.itemId]?.name ?? '?'}${s.count > 1 ? ` ×${s.count}` : ''}`)
                    .join(' + ')}
                </span>
                <span className="ml-auto shrink-0">
                  <ProfitCell profit={profit} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {prices && tab === 'crafts' && (
          <ul className="m-0 flex list-none flex-col p-0 text-[13px]">
            {craftRows.map(({ craft, profit }) => (
              <li key={craft.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 border-b py-2 last:border-0">
                <span className="shrink-0 text-xs text-muted-foreground">
                  {stationName(craft.stationId)} L{craft.stationLevel} ·{' '}
                  {Math.round(craft.durationSeconds / 3600)}h
                </span>
                <ItemsCell stacks={craft.requiredItems} />
                <span aria-hidden="true" className="text-muted-foreground">→</span>
                <span className="min-w-0 font-medium">
                  {craft.rewardItems
                    .map((s) => `${snapshot.itemsLite[s.itemId]?.name ?? '?'}${s.count > 1 ? ` ×${s.count}` : ''}`)
                    .join(' + ')}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-2">
                  <ProfitCell profit={profit} />
                  {profit.profitPerHour !== null && profit.profitPerHour !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {rub(profit.profitPerHour)}/h
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
