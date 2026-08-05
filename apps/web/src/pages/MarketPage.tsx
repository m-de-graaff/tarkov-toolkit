import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { TradeItemStack } from '@raidplanner/data';
import { snapshot } from '@raidplanner/data';
import { RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ResizableTH } from '../components/ResizableTH';
import { fetchPrices, loadCachedPrices, type CachedPrices } from '../lib/prices';
import { barterProfit, craftProfit, fleaToTrader, traderResells } from '../lib/profit';
import { useColumnWidths } from '../lib/useColumnWidths';
import { usePlanner } from '../store';

const STALE_MS = 30 * 60 * 1000; // auto-refresh cadence

const rub = (n: number) => `₽${Math.round(n).toLocaleString()}`;

function ItemCell({ stacks, bold }: { stacks: TradeItemStack[]; bold?: boolean }) {
  return (
    <span className="flex w-full min-w-0 flex-col gap-0.5">
      {stacks.map((stack, i) => {
        const item = snapshot.itemsLite[stack.itemId];
        return (
          <span key={`${stack.itemId}-${i}`} className="flex w-full min-w-0 items-center gap-1.5">
            {item?.iconLink && (
              <img
                src={item.iconLink}
                alt=""
                loading="lazy"
                className="size-6 shrink-0 rounded-sm border bg-black/40 object-contain"
              />
            )}
            <span
              className={cn('min-w-0 flex-1 truncate text-[13px]', bold && 'font-medium')}
              title={item?.name}
            >
              {item?.name ?? 'Unknown item'}
              {stack.count > 1 && (
                <span className="text-muted-foreground tabular-nums"> ×{Math.round(stack.count * 10) / 10}</span>
              )}
              {stack.tool && (
                <span className="ml-1 text-[10px] uppercase text-muted-foreground" title="Used but returned - not consumed">
                  tool
                </span>
              )}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** name/icon for any item: offline itemsLite first, then the price payload */
function SingleItemCell({
  itemId,
  prices,
}: {
  itemId: string;
  prices: Record<string, { name?: string; iconLink?: string }>;
}) {
  const lite = snapshot.itemsLite[itemId];
  const name = lite?.name ?? prices[itemId]?.name ?? 'Unknown item';
  const icon = lite?.iconLink ?? prices[itemId]?.iconLink;
  return (
    <span className="flex w-full min-w-0 items-center gap-1.5">
      {icon && (
        <img
          src={icon}
          alt=""
          loading="lazy"
          className="size-6 shrink-0 rounded-sm border bg-black/40 object-contain"
        />
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium" title={name}>
        {name}
      </span>
    </span>
  );
}

function Cols({ widths }: { widths: number[] }) {
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: `${w}px` }} />
      ))}
    </colgroup>
  );
}

function Money({ value, signed }: { value: number | null; signed?: boolean }) {
  if (value === null) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  return (
    <span
      className={cn(
        'tabular-nums',
        signed && (value >= 0 ? 'font-medium text-ok' : 'font-medium text-destructive'),
      )}
    >
      {signed && value >= 0 ? '+' : ''}
      {rub(value)}
    </span>
  );
}

type Tab = 'resells' | 'fleaToTrader' | 'barters' | 'crafts';

export function MarketPage() {
  const gameMode = usePlanner((s) => s.gameMode);
  const [tab, setTab] = useState<Tab>('barters');
  const [cached, setCached] = useState<CachedPrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [maxLevel, setMaxLevel] = useState<number>(4);
  const fetchingRef = useRef(false);
  const tableRef = useRef<HTMLTableElement | null>(null);

  // per-tab resizable column widths (drag the header edges; double-click fits)
  const resellCols = useColumnWidths('profit:resells', [420, 280, 140, 140, 160]);
  const fleaCols = useColumnWidths('profit:fleaToTrader', [440, 260, 150, 150, 150]);
  const barterCols = useColumnWidths('profit:barters', [360, 330, 210, 140, 140, 140]);
  const craftCols = useColumnWidths('profit:crafts', [320, 290, 220, 130, 130, 130, 130]);
  const activeCols =
    tab === 'resells' ? resellCols : tab === 'fleaToTrader' ? fleaCols : tab === 'barters' ? barterCols : craftCols;
  const tableWidth = activeCols.widths.reduce((a, b) => a + b, 0);

  // Prices load themselves: cache first, auto-fetch when missing or stale,
  // then keep fresh on an interval while the page is open.
  useEffect(() => {
    let disposed = false;
    setCached(null);
    setError(null);

    const refresh = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setLoading(true);
      try {
        const fresh = await fetchPrices(gameMode);
        if (!disposed) {
          setCached(fresh);
          setError(null);
        }
      } catch {
        if (!disposed) setError("Couldn't fetch prices - retrying in a few minutes.");
      } finally {
        fetchingRef.current = false;
        if (!disposed) setLoading(false);
      }
    };

    void loadCachedPrices(gameMode).then((existing) => {
      if (disposed) return;
      if (existing) setCached(existing);
      if (!existing || Date.now() - existing.fetchedAt > STALE_MS) void refresh();
    });
    const interval = setInterval(() => void refresh(), STALE_MS);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [gameMode]);

  const manualRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setCached(await fetchPrices(gameMode));
    } catch {
      setError("Couldn't fetch prices - are you online?");
    } finally {
      setLoading(false);
    }
  };

  const prices = cached?.prices ?? null;
  const matchesSearch = (text: string) =>
    !search || text.toLowerCase().includes(search.toLowerCase());
  const stackNames = (stacks: TradeItemStack[]) =>
    stacks.map((s) => snapshot.itemsLite[s.itemId]?.name ?? '').join(' ');

  const resellRows = useMemo(() => {
    if (!prices) return [];
    return traderResells(prices).filter(
      (row) =>
        row.minTraderLevel <= maxLevel &&
        matchesSearch(`${snapshot.itemsLite[row.itemId]?.name ?? ''} ${snapshot.traders[row.traderId] ?? ''}`),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, search, maxLevel]);

  const fleaTraderRows = useMemo(() => {
    if (!prices) return [];
    return fleaToTrader(prices).filter((row) =>
      matchesSearch(snapshot.itemsLite[row.itemId]?.name ?? ''),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, search]);

  const barterRows = useMemo(() => {
    if (!prices) return [];
    return snapshot.barters
      .filter((b) => !b.taskLocked && b.traderLevel <= maxLevel)
      .map((b) => ({ barter: b, profit: barterProfit(b, prices) }))
      .filter(
        ({ barter, profit }) =>
          profit.profit !== null &&
          matchesSearch(stackNames([...barter.requiredItems, ...barter.rewardItems])),
      )
      .sort((a, b) => (b.profit.profit ?? 0) - (a.profit.profit ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, search, maxLevel]);

  const craftRows = useMemo(() => {
    if (!prices) return [];
    return snapshot.crafts
      .map((c) => ({ craft: c, profit: craftProfit(c, prices) }))
      .filter(
        ({ craft, profit }) =>
          profit.profit !== null &&
          matchesSearch(stackNames([...craft.requiredItems, ...craft.rewardItems])),
      )
      .sort((a, b) => (b.profit.profitPerHour ?? -Infinity) - (a.profit.profitPerHour ?? -Infinity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, search]);

  const counts: Record<Tab, number> = {
    resells: resellRows.length,
    fleaToTrader: fleaTraderRows.length,
    barters: barterRows.length,
    crafts: craftRows.length,
  };
  const TAB_LABELS: Record<Tab, string> = {
    resells: 'Trader → Flea',
    fleaToTrader: 'Flea → Trader',
    barters: 'Barter flips',
    crafts: 'Crafts',
  };

  const ageMinutes = cached ? Math.round((Date.now() - cached.fetchedAt) / 60000) : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-4 px-6 py-8">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-lg font-semibold">Profit</h1>
          <span className="text-xs uppercase tracking-wider text-primary">{gameMode}</span>
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
            {loading
              ? 'updating prices…'
              : ageMinutes !== null
                ? `prices updated ${ageMinutes < 1 ? 'just now' : `${ageMinutes}m ago`} · auto-refreshes`
                : 'loading prices…'}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Refresh prices now"
              disabled={loading}
              onClick={() => void manualRefresh()}
            >
              <RefreshCw aria-hidden="true" className={cn('size-3.5', loading && 'animate-spin')} />
            </Button>
          </span>
        </div>
        {error && <p className="text-[13px] text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-2.5">
          <div role="group" aria-label="Category" className="flex items-center rounded-md border p-0.5">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors tabular-nums',
                  tab === t ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {TAB_LABELS[t]}
                {prices && <span className="ml-1 text-muted-foreground">{counts[t]}</span>}
              </button>
            ))}
          </div>
          <Input
            type="search"
            placeholder="Search items…"
            aria-label="Search trades by item"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 max-w-52 flex-1"
          />
          {(tab === 'resells' || tab === 'barters') && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Trader level up to</span>
              <Select value={String(maxLevel)} onValueChange={(v) => setMaxLevel(Number(v))}>
                <SelectTrigger className="h-8 w-16" aria-label="Maximum trader loyalty level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((l) => (
                    <SelectItem key={l} value={String(l)}>
                      LL{l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
        </div>

        {!prices ? (
          <p className="rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">
            Fetching {gameMode.toUpperCase()} flea prices…
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table
              ref={tableRef}
              style={{ width: tableWidth }}
              className="table-fixed border-collapse text-[13px]"
            >
              {tab === 'resells' && (
                <>
                  <Cols widths={resellCols.widths} />
                  <thead>
                    <tr className="border-b bg-card">
                      {['Item', 'Buy from', 'Buy', 'Flea', 'Spread*'].map((label, i) => (
                        <ResizableTH key={label} index={i} columns={resellCols} tableRef={tableRef} right={i >= 2}>
                          {label}
                        </ResizableTH>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resellRows.map((row) => (
                      <tr key={`${row.itemId}-${row.traderId}`} className="border-b last:border-0 hover:bg-secondary/40">
                        <td className="px-3 py-1.5">
                          <SingleItemCell itemId={row.itemId} prices={prices} />
                        </td>
                        <td className="truncate px-3 py-1.5 text-muted-foreground">
                          {snapshot.traders[row.traderId] ?? 'Trader'} LL{row.minTraderLevel}
                          {row.buyLimit > 0 && <span className="text-xs"> · limit {row.buyLimit}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={row.buyPrice} /></td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={row.fleaSell} /></td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={row.spread} signed /></td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {tab === 'fleaToTrader' && (
                <>
                  <Cols widths={fleaCols.widths} />
                  <thead>
                    <tr className="border-b bg-card">
                      {['Item', 'Sell to', 'Buy (flea)', 'Sell', 'Profit'].map((label, i) => (
                        <ResizableTH key={label} index={i} columns={fleaCols} tableRef={tableRef} right={i >= 2}>
                          {label}
                        </ResizableTH>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fleaTraderRows.map((row) => (
                      <tr key={row.itemId} className="border-b last:border-0 hover:bg-secondary/40">
                        <td className="px-3 py-1.5">
                          <SingleItemCell itemId={row.itemId} prices={prices} />
                        </td>
                        <td className="truncate px-3 py-1.5 text-muted-foreground">
                          {(row.sellTraderId && snapshot.traders[row.sellTraderId]) ?? 'Trader'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={row.buyFlea} /></td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={row.sellTrader} /></td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={row.spread} signed /></td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {tab === 'barters' && (
                <>
                  <Cols widths={barterCols.widths} />
                  <thead>
                    <tr className="border-b bg-card">
                      {['Give', 'Get', 'Trader', 'Cost', 'Sell', 'Profit'].map((label, i) => (
                        <ResizableTH key={label} index={i} columns={barterCols} tableRef={tableRef} right={i >= 3}>
                          {label}
                        </ResizableTH>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {barterRows.map(({ barter, profit }) => (
                      <tr key={barter.id} className="border-b last:border-0 hover:bg-secondary/40">
                        <td className="px-3 py-1.5"><ItemCell stacks={barter.requiredItems} /></td>
                        <td className="px-3 py-1.5"><ItemCell stacks={barter.rewardItems} bold /></td>
                        <td className="truncate px-3 py-1.5 text-muted-foreground">
                          {barter.traderName} LL{barter.traderLevel}
                          {barter.buyLimit > 0 && <span className="text-xs"> · limit {barter.buyLimit}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={profit.cost} /></td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={profit.revenue} /></td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={profit.profit} signed /></td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
              {tab === 'crafts' && (
                <>
                  <Cols widths={craftCols.widths} />
                  <thead>
                    <tr className="border-b bg-card">
                      {['Input', 'Output', 'Station', 'Cost', 'Sell', 'Profit', 'Per hour'].map((label, i) => (
                        <ResizableTH key={label} index={i} columns={craftCols} tableRef={tableRef} right={i >= 3}>
                          {label}
                        </ResizableTH>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {craftRows.map(({ craft, profit }) => (
                      <tr key={craft.id} className="border-b last:border-0 hover:bg-secondary/40">
                        <td className="px-3 py-1.5"><ItemCell stacks={craft.requiredItems} /></td>
                        <td className="px-3 py-1.5"><ItemCell stacks={craft.rewardItems} bold /></td>
                        <td className="truncate px-3 py-1.5 text-muted-foreground">
                          {snapshot.hideout.find((s) => s.id === craft.stationId)?.name ?? 'Station'} L{craft.stationLevel}
                          <span className="text-xs tabular-nums"> · {(craft.durationSeconds / 3600).toFixed(1)}h</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={profit.cost} /></td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={profit.revenue} /></td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={profit.profit} signed /></td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right">
                          <Money value={profit.profitPerHour ?? null} signed />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          * Trader → Flea spreads and barter/craft profits assume selling the best way (flea 24h
          average or best trader) and don't include the flea listing fee, which depends on your
          Intelligence Center. Flea → Trader profits are fee-free - traders charge nothing.
          Costs use the cheaper of flea and trader cash offers.
        </p>
      </div>
    </div>
  );
}
