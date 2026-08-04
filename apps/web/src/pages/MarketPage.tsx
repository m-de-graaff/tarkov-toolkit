import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { snapshot } from '@raidplanner/data';
import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchPrices, loadCachedPrices, type CachedPrices } from '../lib/prices';
import { barterProfit, craftProfit, traderResells, type TradeProfit } from '../lib/profit';
import { usePlanner } from '../store';

const rub = (n: number) => `₽${Math.round(n).toLocaleString()}`;

function ProfitValue({ profit }: { profit: TradeProfit }) {
  if (profit.profit === null) {
    return (
      <span className="text-xs text-muted-foreground" title="An item in this trade has no price">
        no price
      </span>
    );
  }
  return (
    <span className={cn('font-medium tabular-nums', profit.profit >= 0 ? 'text-ok' : 'text-destructive')}>
      {profit.profit >= 0 ? '+' : ''}
      {rub(profit.profit)}
    </span>
  );
}

function stacksLabel(stacks: { itemId: string; count: number }[], full = false) {
  return stacks
    .map((s) => {
      const item = snapshot.itemsLite[s.itemId];
      const name = (full ? item?.name : item?.shortName) ?? '?';
      return `${name}${s.count > 1 ? ` ×${s.count}` : ''}`;
    })
    .join(' + ');
}

function Category({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <details open className="profit-category rounded-lg border bg-card">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2.5 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
      </summary>
      <div className="border-t px-4 pb-3">{children}</div>
    </details>
  );
}

function TopList<T>({
  rows,
  render,
}: {
  rows: T[];
  render: (row: T) => React.ReactNode;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, 20);
  return (
    <>
      <ul className="m-0 flex list-none flex-col p-0 text-[13px]">{visible.map(render)}</ul>
      {rows.length > 20 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 text-xs text-muted-foreground"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show top 20' : `Show all ${rows.length}`}
        </Button>
      )}
    </>
  );
}

export function MarketPage() {
  const gameMode = usePlanner((s) => s.gameMode);
  const [cached, setCached] = useState<CachedPrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // each mode has its own flea market — load that mode's cache
  useEffect(() => {
    setCached(null);
    void loadCachedPrices(gameMode).then(setCached);
  }, [gameMode]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setCached(await fetchPrices(gameMode));
    } catch {
      setError("Couldn't fetch prices — are you online?");
    } finally {
      setLoading(false);
    }
  };

  const prices = cached?.prices ?? null;

  const matchesSearch = (text: string) =>
    !search || text.toLowerCase().includes(search.toLowerCase());

  const barterRows = useMemo(() => {
    if (!prices) return [];
    return snapshot.barters
      .map((b) => ({ barter: b, profit: barterProfit(b, prices) }))
      .filter(
        ({ barter, profit }) =>
          profit.profit !== null &&
          profit.profit > 0 &&
          matchesSearch(stacksLabel([...barter.requiredItems, ...barter.rewardItems], true)),
      )
      .sort((a, b) => (b.profit.profit ?? 0) - (a.profit.profit ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, search]);

  const craftRows = useMemo(() => {
    if (!prices) return [];
    return snapshot.crafts
      .map((c) => ({ craft: c, profit: craftProfit(c, prices) }))
      .filter(
        ({ craft, profit }) =>
          profit.profit !== null &&
          profit.profit > 0 &&
          matchesSearch(stacksLabel([...craft.requiredItems, ...craft.rewardItems], true)),
      )
      .sort((a, b) => (b.profit.profitPerHour ?? 0) - (a.profit.profitPerHour ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, search]);

  const resellRows = useMemo(() => {
    if (!prices) return [];
    return traderResells(prices).filter((row) =>
      matchesSearch(
        `${snapshot.itemsLite[row.itemId]?.name ?? ''} ${snapshot.traders[row.traderId] ?? ''}`,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, search]);

  const ageMinutes = cached ? Math.round((Date.now() - cached.fetchedAt) / 60000) : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">
            Profit <span className="text-sm font-normal text-muted-foreground uppercase">· {gameMode}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick ways to make roubles, priced with {gameMode.toUpperCase()} flea data — switch
            the mode toggle up top for the other economy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
                {gameMode.toUpperCase()} prices{' '}
                {ageMinutes < 60 ? `${ageMinutes}m` : `${Math.round(ageMinutes / 60)}h`} old
              </span>
            )}
            <Button
              type="button"
              variant={cached ? 'outline' : 'default'}
              size="sm"
              className="gap-1.5"
              disabled={loading}
              onClick={() => void refresh()}
            >
              <RefreshCw aria-hidden="true" className={cn('size-3.5', loading && 'animate-spin')} />
              {cached ? 'Refresh prices' : `Load ${gameMode.toUpperCase()} prices (~16 MB)`}
            </Button>
          </div>
        </div>

        {error && <p className="text-[13px] text-destructive">{error}</p>}
        {!cached && !loading && !error && (
          <p className="rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
            Prices are the one thing that can't ship offline — load them once per mode and
            they're cached until you refresh.
          </p>
        )}

        {prices && (
          <>
            <Category
              title="Trader resells"
              subtitle="buy from a trader, sell on flea — spread before flea fee"
              count={resellRows.length}
            >
              <TopList
                rows={resellRows}
                render={(row) => (
                  <li
                    key={`${row.itemId}-${row.traderId}`}
                    className="flex flex-wrap items-center gap-x-2.5 border-b py-2 last:border-0"
                  >
                    <span className="min-w-0 font-medium">
                      {snapshot.itemsLite[row.itemId]?.name ?? 'Item'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {snapshot.traders[row.traderId] ?? 'Trader'} LL{row.minTraderLevel}
                      {row.buyLimit > 0 && ` · limit ${row.buyLimit}`}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-2 tabular-nums">
                      <span className="text-xs text-muted-foreground">
                        {rub(row.buyPrice)} → {rub(row.fleaSell)}
                      </span>
                      <span className="font-medium text-ok">+{rub(row.spread)}</span>
                    </span>
                  </li>
                )}
              />
            </Category>

            <Category
              title="Barter flips"
              subtitle="trade items in, sell the reward the best way"
              count={barterRows.length}
            >
              <TopList
                rows={barterRows}
                render={({ barter, profit }) => (
                  <li key={barter.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 border-b py-2 last:border-0">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {barter.traderName} LL{barter.traderLevel}
                    </span>
                    <span className="text-muted-foreground">{stacksLabel(barter.requiredItems)}</span>
                    <span aria-hidden="true" className="text-muted-foreground">→</span>
                    <span className="min-w-0 font-medium">{stacksLabel(barter.rewardItems, true)}</span>
                    <span className="ml-auto shrink-0">
                      <ProfitValue profit={profit} />
                    </span>
                  </li>
                )}
              />
            </Category>

            <Category
              title="Profitable crafts"
              subtitle="hideout production, ranked by profit per hour"
              count={craftRows.length}
            >
              <TopList
                rows={craftRows}
                render={({ craft, profit }) => (
                  <li key={craft.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 border-b py-2 last:border-0">
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {snapshot.hideout.find((s) => s.id === craft.stationId)?.name ?? 'Station'} L
                      {craft.stationLevel} · {Math.round(craft.durationSeconds / 3600)}h
                    </span>
                    <span className="text-muted-foreground">{stacksLabel(craft.requiredItems)}</span>
                    <span aria-hidden="true" className="text-muted-foreground">→</span>
                    <span className="min-w-0 font-medium">{stacksLabel(craft.rewardItems, true)}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      <ProfitValue profit={profit} />
                      {profit.profitPerHour != null && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {rub(profit.profitPerHour)}/h
                        </span>
                      )}
                    </span>
                  </li>
                )}
              />
            </Category>
          </>
        )}
      </div>
    </div>
  );
}
