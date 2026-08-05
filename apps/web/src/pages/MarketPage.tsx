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
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ItemIcon } from '../components/ItemIcon';
import { ResizableTH } from '../components/ResizableTH';
import { usePrices } from '../lib/usePrices';
import {
  barterProfit,
  craftProfit,
  fleaToTrader,
  traderResells,
  type TradeProfit,
} from '../lib/profit';
import { useColumnWidths } from '../lib/useColumnWidths';
import { usePlanner } from '../store';


const rub = (n: number) => `₽${Math.round(n).toLocaleString()}`;

function ItemCell({ stacks, bold }: { stacks: TradeItemStack[]; bold?: boolean }) {
  return (
    <span className="flex w-full min-w-0 flex-col gap-0.5">
      {stacks.map((stack, i) => {
        const item = snapshot.itemsLite[stack.itemId];
        return (
          <span key={`${stack.itemId}-${i}`} className="flex w-full min-w-0 items-center gap-1.5">
            <ItemIcon
              itemId={stack.itemId}
              iconLink={item?.iconLink}
              className="size-6 shrink-0 rounded-sm border bg-black/40 object-contain"
            />
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
      <ItemIcon
        itemId={itemId}
        iconLink={icon}
        className="size-6 shrink-0 rounded-sm border bg-black/40 object-contain"
      />
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

/** a filter that matches nothing must say so, not render a blank table body */
function EmptyRow({ colSpan, search }: { colSpan: number; search: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-6 text-center text-[13px] text-muted-foreground">
        {search ? `No trades match "${search}".` : 'Nothing profitable in this category right now.'}
      </td>
    </tr>
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

/** flea and trader sell price side by side, the better outlet in bold */
function SellCells({ profit }: { profit: TradeProfit }) {
  const flea = profit.fleaRevenue;
  const trader = profit.traderRevenue;
  const fleaBest = flea !== null && (trader === null || flea >= trader);
  const traderBest = trader !== null && (flea === null || trader > flea);
  const traderName = profit.sellTraderId ? snapshot.traders[profit.sellTraderId] : undefined;
  return (
    <>
      <td
        className="whitespace-nowrap px-3 py-1.5 text-right"
        title={fleaBest ? 'Best outlet: flea market' : undefined}
      >
        <span className={cn(fleaBest && 'font-semibold')}>
          <Money value={flea} />
        </span>
      </td>
      <td
        className="whitespace-nowrap px-3 py-1.5 text-right"
        title={
          traderName
            ? `Sell to ${traderName}${traderBest ? ' (best outlet)' : ''}`
            : traderBest
              ? 'Best outlet: trader'
              : undefined
        }
      >
        <span className={cn(traderBest && 'font-semibold')}>
          <Money value={trader} />
        </span>
      </td>
    </>
  );
}

type Tab = 'resells' | 'fleaToTrader' | 'barters' | 'crafts';

export function MarketPage() {
  const gameMode = usePlanner((s) => s.gameMode);
  const [tab, setTab] = useState<Tab>('barters');
  const priceState = usePrices();
  const cached = priceState.cached;
  const loading = priceState.loading;
  const error = priceState.error;
  const [search, setSearch] = useState('');
  const [maxLevel, setMaxLevel] = useState<number>(4);
  const tableRef = useRef<HTMLTableElement | null>(null);

  // per-tab resizable column widths (drag the header edges; double-click fits)
  const resellCols = useColumnWidths('profit:resells', [420, 280, 140, 140, 160]);
  const fleaCols = useColumnWidths('profit:fleaToTrader', [440, 260, 150, 150, 150]);
  const barterCols = useColumnWidths('profit:barters', [340, 310, 200, 130, 130, 130, 130]);
  const craftCols = useColumnWidths('profit:crafts', [300, 270, 210, 125, 125, 125, 125, 125]);
  const activeCols =
    tab === 'resells' ? resellCols : tab === 'fleaToTrader' ? fleaCols : tab === 'barters' ? barterCols : craftCols;
  const tableWidth = activeCols.widths.reduce((a, b) => a + b, 0);

  const prices = cached?.prices ?? null;
  const matchesSearch = useCallback(
    (text: string) => !search || text.toLowerCase().includes(search.toLowerCase()),
    [search],
  );
  const stackNames = (stacks: TradeItemStack[]) =>
    stacks.map((s) => snapshot.itemsLite[s.itemId]?.name ?? '').join(' ');

  const resellRows = useMemo(() => {
    if (!prices) return [];
    return traderResells(prices).filter(
      (row) =>
        row.minTraderLevel <= maxLevel &&
        matchesSearch(`${snapshot.itemsLite[row.itemId]?.name ?? ''} ${snapshot.traders[row.traderId] ?? ''}`),
    );
  }, [prices, matchesSearch, maxLevel]);

  const fleaTraderRows = useMemo(() => {
    if (!prices) return [];
    return fleaToTrader(prices).filter((row) =>
      matchesSearch(snapshot.itemsLite[row.itemId]?.name ?? ''),
    );
  }, [prices, matchesSearch]);

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
  }, [prices, matchesSearch, maxLevel]);

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
  }, [prices, matchesSearch]);

  // Column widths follow the content automatically until the user drags a
  // grip. Re-measuring reads every cell's box (it flips the table to auto
  // layout), so it must run only when the rendered rows actually change -
  // with thousands of rows, running it per keystroke froze the page.
  const { manual: activeManual, fitAll: activeFitAll } = activeCols;
  useLayoutEffect(() => {
    if (!activeManual) activeFitAll(tableRef.current);
  }, [activeManual, activeFitAll, tab, resellRows, fleaTraderRows, barterRows, craftRows]);

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
                ? `prices updated ${ageMinutes < 1 ? 'just now' : `${ageMinutes}m ago`}`
                : 'prices not loaded'}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Refresh prices now"
              disabled={loading}
              onClick={() => void priceState.refresh()}
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
          <div className="rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">
            {loading ? (
              <p>Fetching {gameMode.toUpperCase()} flea prices…</p>
            ) : (
              // a hard first-fetch failure used to leave "Fetching…" forever
              <div className="flex flex-col items-center gap-2">
                <p>{error ?? `${gameMode.toUpperCase()} flea prices are not loaded yet.`}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void priceState.refresh()}>
                  {error ? 'Try again' : 'Load prices'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table
              ref={tableRef}
              // fill the container; the measured sum only sets the scroll floor,
              // so short content stretches instead of leaving dead space
              style={{ width: '100%', minWidth: tableWidth }}
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
                    {resellRows.length === 0 && <EmptyRow colSpan={5} search={search} />}
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
                    {fleaTraderRows.length === 0 && <EmptyRow colSpan={5} search={search} />}
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
                      {['Give', 'Get', 'Trader', 'Cost', 'Sell flea', 'Sell trader', 'Profit'].map((label, i) => (
                        <ResizableTH key={label} index={i} columns={barterCols} tableRef={tableRef} right={i >= 3}>
                          {label}
                        </ResizableTH>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {barterRows.length === 0 && <EmptyRow colSpan={7} search={search} />}
                    {barterRows.map(({ barter, profit }) => (
                      <tr key={barter.id} className="border-b last:border-0 hover:bg-secondary/40">
                        <td className="px-3 py-1.5"><ItemCell stacks={barter.requiredItems} /></td>
                        <td className="px-3 py-1.5"><ItemCell stacks={barter.rewardItems} bold /></td>
                        <td className="truncate px-3 py-1.5 text-muted-foreground">
                          {barter.traderName} LL{barter.traderLevel}
                          {barter.buyLimit > 0 && <span className="text-xs"> · limit {barter.buyLimit}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={profit.cost} /></td>
                        <SellCells profit={profit} />
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
                      {['Input', 'Output', 'Station', 'Cost', 'Sell flea', 'Sell trader', 'Profit', 'Per hour'].map((label, i) => (
                        <ResizableTH key={label} index={i} columns={craftCols} tableRef={tableRef} right={i >= 3}>
                          {label}
                        </ResizableTH>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {craftRows.length === 0 && <EmptyRow colSpan={8} search={search} />}
                    {craftRows.map(({ craft, profit }) => (
                      <tr key={craft.id} className="border-b last:border-0 hover:bg-secondary/40">
                        <td className="px-3 py-1.5"><ItemCell stacks={craft.requiredItems} /></td>
                        <td className="px-3 py-1.5"><ItemCell stacks={craft.rewardItems} bold /></td>
                        <td className="truncate px-3 py-1.5 text-muted-foreground">
                          {snapshot.hideout.find((s) => s.id === craft.stationId)?.name ?? 'Station'} L{craft.stationLevel}
                          <span className="text-xs tabular-nums"> · {(craft.durationSeconds / 3600).toFixed(1)}h</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-right"><Money value={profit.cost} /></td>
                        <SellCells profit={profit} />
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
