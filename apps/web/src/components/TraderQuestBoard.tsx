import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { RpTask } from '@raidplanner/data';
import { snapshot } from '@raidplanner/data';
import { ChevronRight, Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { isAvailable, traderLoyaltyOf } from '../lib/availability';
import { lockReasons } from '../lib/lockReasons';
import { snapshotForMode } from '../lib/modeTasks';
import { usePlanner } from '../store';

const mapNameById = (id: string | null) =>
  id ? snapshot.maps.find((m) => m.id === id)?.name : undefined;

function QuestRow({
  task,
  deadEnd,
  traderBadge,
  reasons,
}: {
  task: RpTask;
  deadEnd?: boolean;
  traderBadge?: string;
  reasons?: string[];
}) {
  const completed = usePlanner((s) => s.tracker.completedTaskIds.includes(task.id));
  const toggleCompleted = usePlanner((s) => s.toggleCompleted);
  const mapName = mapNameById(task.mapId);

  return (
    <li className="quest-row flex min-h-9 flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-md px-2 py-1 hover:bg-secondary/60">
      <input
        type="checkbox"
        checked={completed}
        onChange={() => toggleCompleted(task.id)}
        aria-label={`Mark ${task.name} as finished`}
        className="size-4 shrink-0 cursor-pointer accent-primary"
      />
      <Link
        to={`/quest/${task.normalizedName}`}
        className={cn(
          'min-w-0 flex-1 truncate text-sm underline-offset-2 hover:underline',
          completed && 'text-muted-foreground line-through',
        )}
        title={`${task.name} - details`}
      >
        {task.name}
      </Link>
      {traderBadge && (
        <Badge variant="outline" className="shrink-0 px-1.5 text-[10px] text-muted-foreground">
          {traderBadge}
        </Badge>
      )}
      {mapName && (
        <span className="shrink-0 text-xs text-muted-foreground" title={`Plays on ${mapName}`}>
          {mapName}
        </span>
      )}
      {task.minPlayerLevel > 1 && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          Lv {task.minPlayerLevel}
        </span>
      )}
      {(task.loyaltyLevel ?? 1) > 1 && (
        <span
          className="shrink-0 text-xs text-muted-foreground tabular-nums"
          title={`Needs loyalty level ${task.loyaltyLevel} with ${task.trader.name}`}
        >
          LL{task.loyaltyLevel}
        </span>
      )}
      {reasons && reasons.length > 0 && (
        <span
          className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
          title="Finish the quests before it (or level up) to unlock"
        >
          <Lock aria-hidden="true" className="size-3" />
          {reasons.join(' · ')}
        </span>
      )}
      {deadEnd && (
        <span
          className="shrink-0 text-[10px] uppercase text-muted-foreground/70"
          title="No other quest requires this one"
        >
          dead end
        </span>
      )}
      {task.kappaRequired && (
        <Badge
          variant="outline"
          className="shrink-0 px-1.5 text-[10px] text-muted-foreground"
          title="Needed for the Kappa container"
        >
          KAPPA
        </Badge>
      )}
    </li>
  );
}

/**
 * Mirrors the in-game trader screen: quests only show for the loyalty tier
 * you actually have, and a locked trader shows nothing. Defaults to LL1.
 */
function LoyaltyControl({ trader }: { trader: string }) {
  const loyalty = usePlanner((s) => traderLoyaltyOf(s.tracker, trader));
  const setTraderLoyalty = usePlanner((s) => s.setTraderLoyalty);
  const tiers = [
    { value: 0, label: 'Locked' },
    { value: 1, label: 'I' },
    { value: 2, label: 'II' },
    { value: 3, label: 'III' },
    { value: 4, label: 'IV' },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{trader} loyalty</span>
      <div
        role="radiogroup"
        aria-label={`${trader} loyalty level`}
        className="flex overflow-hidden rounded-md border"
      >
        {tiers.map((tier) => (
          <button
            key={tier.value}
            type="button"
            role="radio"
            aria-checked={loyalty === tier.value}
            onClick={() => setTraderLoyalty(trader, tier.value)}
            className={cn(
              'px-2 py-1 text-xs transition-colors not-first:border-l',
              loyalty === tier.value
                ? 'bg-accent text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tier.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupHeading({ label, count }: { label: string; count: number }) {
  return (
    <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {label} <span className="normal-case tabular-nums">({count})</span>
    </h3>
  );
}

const byLevelThenName = (a: RpTask, b: RpTask) =>
  a.minPlayerLevel - b.minPlayerLevel || a.name.localeCompare(b.name);

/**
 * The quests tab: a trader rail instead of one giant stacked list. "All"
 * answers "what can I do right now" across traders; a trader chip narrows to
 * that trader, grouped by Open / Locked (with the reason) / Completed
 * (collapsed - done quests are history, not reading material).
 */
export function TraderQuestBoard() {
  const tracker = usePlanner((s) => s.tracker);
  const gameMode = usePlanner((s) => s.gameMode);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [kappaOnly, setKappaOnly] = useState(false);
  const [unlocksOnly, setUnlocksOnly] = useState(false);

  const modeSnapshot = useMemo(() => snapshotForMode(snapshot, gameMode), [gameMode]);
  const byId = useMemo(
    () => new Map(modeSnapshot.tasks.map((t) => [t.id, t])),
    [modeSnapshot],
  );
  const unlocksSomething = useMemo(() => {
    const ids = new Set<string>();
    for (const task of modeSnapshot.tasks) {
      for (const req of task.taskRequirements) ids.add(req.taskId);
    }
    return ids;
  }, [modeSnapshot]);
  const traders = useMemo(() => {
    const names: string[] = [];
    for (const task of modeSnapshot.tasks) {
      if (!names.includes(task.trader.name)) names.push(task.trader.name);
    }
    return names;
  }, [modeSnapshot]);

  const traderParam = params.get('trader');
  const trader = traderParam && traders.includes(traderParam) ? traderParam : null;
  const selectTrader = (name: string | null) => {
    const next = new URLSearchParams(params);
    if (name === null) next.delete('trader');
    else next.set('trader', name);
    setParams(next, { replace: true });
  };

  const perTrader = useMemo(() => {
    const stats = new Map<string, { total: number; completed: number; open: number }>();
    for (const name of traders) stats.set(name, { total: 0, completed: 0, open: 0 });
    for (const task of modeSnapshot.tasks) {
      const s = stats.get(task.trader.name)!;
      s.total++;
      if (tracker.completedTaskIds.includes(task.id)) s.completed++;
      else if (isAvailable(task, tracker)) s.open++;
    }
    return stats;
  }, [traders, modeSnapshot, tracker]);

  const visible = useMemo(
    () =>
      modeSnapshot.tasks.filter((task) => {
        if (trader !== null && task.trader.name !== trader) return false;
        if (search && !task.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (kappaOnly && !task.kappaRequired) return false;
        if (unlocksOnly && !unlocksSomething.has(task.id)) return false;
        return true;
      }),
    [modeSnapshot, trader, search, kappaOnly, unlocksOnly, unlocksSomething],
  );

  // searching means "find this quest, whatever its state" - the All view's
  // open-only summary would hide locked/completed matches
  const searching = search.trim().length > 0;
  const grouped = trader !== null || searching;

  const groups = useMemo(() => {
    const open: RpTask[] = [];
    const locked: RpTask[] = [];
    const completed: RpTask[] = [];
    for (const task of visible) {
      if (tracker.completedTaskIds.includes(task.id)) completed.push(task);
      else if (isAvailable(task, tracker)) open.push(task);
      else locked.push(task);
    }
    open.sort(byLevelThenName);
    locked.sort(byLevelThenName);
    completed.sort(byLevelThenName);
    return { open, locked, completed };
  }, [visible, tracker]);

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-2 rounded-md bg-background/95 px-1 py-2 backdrop-blur">
        <div className="trader-rail -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
          <button
            type="button"
            aria-pressed={trader === null}
            onClick={() => selectTrader(null)}
            className={cn(
              'shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors',
              trader === null
                ? 'border-primary/60 bg-accent text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>
          {traders.map((name) => {
            const s = perTrader.get(name)!;
            return (
              <button
                key={name}
                type="button"
                aria-pressed={trader === name}
                onClick={() => selectTrader(trader === name ? null : name)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                  trader === name
                    ? 'border-primary/60 bg-accent text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {name}
                <span className="tabular-nums opacity-70">
                  {s.completed}/{s.total}
                </span>
                {s.open > 0 && <span className="tabular-nums text-ok">· {s.open} open</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            placeholder={trader ? `Search ${trader} quests…` : 'Search all quests…'}
            aria-label="Search quests"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 max-w-64 flex-1"
          />
          {(
            [
              { label: 'Kappa only', value: kappaOnly, set: setKappaOnly },
              { label: 'Unlocks quests', value: unlocksOnly, set: setUnlocksOnly },
            ] as const
          ).map((chip) => (
            <button
              key={chip.label}
              type="button"
              aria-pressed={chip.value}
              onClick={() => chip.set(!chip.value)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs transition-colors',
                chip.value
                  ? 'border-primary/60 bg-accent text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {trader !== null && <LoyaltyControl trader={trader} />}

      <section aria-label="Open quests">
        <GroupHeading label="Open now" count={groups.open.length} />
        <Separator className="mb-2" />
        {groups.open.length === 0 ? (
          <p className="px-2 text-sm text-muted-foreground">
            Nothing open{trader ? ` at ${trader}` : ''} - level up or finish prerequisite quests.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {groups.open.map((task) => (
              <QuestRow
                key={task.id}
                task={task}
                deadEnd={!unlocksSomething.has(task.id)}
                traderBadge={trader === null ? task.trader.name : undefined}
              />
            ))}
          </ul>
        )}
      </section>

      {!grouped ? (
        <section aria-label="Traders">
          <GroupHeading label="By trader" count={traders.length} />
          <Separator className="mb-2" />
          <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
            {traders.map((name) => {
              const s = perTrader.get(name)!;
              return (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => selectTrader(name)}
                    className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-secondary/40"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {s.completed}/{s.total} done
                    </span>
                    {s.open > 0 && (
                      <span className="text-xs text-ok tabular-nums">{s.open} open</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <>
          <section aria-label="Locked quests">
            <GroupHeading label="Locked" count={groups.locked.length} />
            <Separator className="mb-2" />
            {groups.locked.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">Nothing locked - all caught up.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {groups.locked.map((task) => (
                  <QuestRow
                    key={task.id}
                    task={task}
                    deadEnd={!unlocksSomething.has(task.id)}
                    traderBadge={trader === null ? task.trader.name : undefined}
                    reasons={lockReasons(task, tracker, byId)}
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Completed quests">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  aria-hidden="true"
                  className="mb-1 size-3.5 text-muted-foreground transition-transform group-open:rotate-90"
                />
                <GroupHeading label="Completed" count={groups.completed.length} />
              </summary>
              <Separator className="mb-2" />
              <ul className="m-0 flex list-none flex-col p-0">
                {groups.completed.map((task) => (
                  <QuestRow key={task.id} task={task} />
                ))}
              </ul>
            </details>
          </section>
        </>
      )}
    </div>
  );
}
