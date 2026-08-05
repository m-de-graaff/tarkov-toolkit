import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { snapshot } from '@raidplanner/data';
import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GuideCost, SkillGuide } from '../data/skillGuides';
import { skillGlobalNotes, skillGuides } from '../data/skillGuides';
import type { CraftingLevelingRow } from '../lib/craftingXp';
import { bestCraftsPerStation } from '../lib/craftingXp';
import { usePrices } from '../lib/usePrices';
import { usePlanner } from '../store';

const NO_LEVELS: Record<string, number> = {};

const rub = (n: number) => `₽${Math.round(n).toLocaleString()}`;

const COST_STYLE: Record<GuideCost, string> = {
  free: 'border-ok/50 text-ok',
  cheap: 'border-primary/50 text-primary',
  moderate: 'border-input text-muted-foreground',
  expensive: 'border-destructive/50 text-destructive',
};

function SkillCard({ guide }: { guide: SkillGuide }) {
  return (
    <section className="skill-card flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div>
        <h2 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
          {guide.name}
          <Badge variant="outline" className={cn('px-1.5 text-[10px]', COST_STYLE[guide.cost])}>
            {guide.cost}
          </Badge>
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{guide.gives}</p>
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">How it levels: </span>
        {guide.how}
      </p>
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {guide.plan.map((step) => (
          <li key={`${step.when}-${step.text.slice(0, 24)}`} className="flex gap-2 text-[13px]">
            <span className="mt-0.5 h-fit shrink-0 rounded border px-1 py-px text-[10px] font-medium text-muted-foreground">
              {step.when}
            </span>
            <span className="min-w-0 text-muted-foreground">{step.text}</span>
          </li>
        ))}
      </ol>
      {guide.cheese && (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-2.5 py-2 text-[13px]">
          <p className="font-medium">Cheese: {guide.cheese.title}</p>
          <p className="mt-0.5 text-muted-foreground">{guide.cheese.detail}</p>
        </div>
      )}
      {guide.caps && <p className="text-xs text-muted-foreground/80">{guide.caps}</p>}
    </section>
  );
}

function formatDuration(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)}m`;
  if (hours < 10) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours)}h`;
}

function CraftRow({
  row,
  rank,
  showCost,
}: {
  row: CraftingLevelingRow;
  rank: number;
  showCost: boolean;
}) {
  const { craft, materialCost, costPerPoint } = row;
  const reward = craft.rewardItems[0];
  const item = reward ? snapshot.itemsLite[reward.itemId] : undefined;
  const name = craft.rewardItems
    .map((s) => snapshot.itemsLite[s.itemId]?.name ?? 'Item')
    .join(', ');
  return (
    <li className="flex items-center gap-2 py-1.5 not-last:border-b">
      <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{rank}.</span>
      {item?.iconLink && (
        <img
          src={item.iconLink}
          alt=""
          loading="lazy"
          className="size-6 shrink-0 rounded-sm border bg-black/40 object-contain"
        />
      )}
      <span className="min-w-0 flex-1 truncate text-[13px]" title={name}>
        {name}
        {craft.stationLevel > 1 && (
          <span className="ml-1.5 text-xs text-muted-foreground">L{craft.stationLevel}</span>
        )}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums" title="Craft duration">
        {formatDuration(craft.durationSeconds)}
      </span>
      {showCost && (
        <span
          className="w-20 shrink-0 text-right text-xs tabular-nums"
          title={`${rub(costPerPoint)} per skill point`}
        >
          {rub(materialCost)}
        </span>
      )}
    </li>
  );
}

function CraftingCard() {
  const prices = usePrices();
  const hideoutLevels = usePlanner((s) => s.tracker.hideoutLevels ?? NO_LEVELS);
  const [onlyBuilt, setOnlyBuilt] = useState(true);
  const [ignoreCost, setIgnoreCost] = useState(false);

  const groups = useMemo(
    () =>
      bestCraftsPerStation(snapshot.crafts, prices.cached?.prices ?? null, hideoutLevels, {
        onlyBuilt,
        ignoreCost,
      }),
    [prices.cached, hideoutLevels, onlyBuilt, ignoreCost],
  );

  const needsPrices = !ignoreCost && !prices.cached;

  return (
    <section className="skill-card flex flex-col gap-3 rounded-lg border border-primary/40 bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Crafting - best crafts per station</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Crafting gives 5 skill points per finished craft, but only when the station alternates
          two different recipes - queueing the same recipe twice in a row earns nothing. So in
          each station, alternate the top two crafts below and keep them short. A small time drip
          (about 1.5 points per 8 crafting hours) accrues on top, so long crafts overnight are
          still fine.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div
          role="group"
          aria-label="Ranking mode"
          className="flex items-center rounded-md border p-0.5"
        >
          {(
            [
              { key: false, label: 'Price + time' },
              { key: true, label: 'Shortest, any price' },
            ] as const
          ).map((mode) => (
            <button
              key={mode.label}
              type="button"
              aria-pressed={ignoreCost === mode.key}
              onClick={() => setIgnoreCost(mode.key)}
              className={cn(
                'rounded-[5px] px-2.5 py-0.5 text-xs font-medium transition-colors',
                ignoreCost === mode.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyBuilt}
            onChange={(e) => setOnlyBuilt(e.target.checked)}
            className="size-4 accent-primary"
          />
          <span>
            Only stations I have built (
            <Link to="/hideout" className="text-primary underline-offset-2 hover:underline">
              hideout
            </Link>
            )
          </span>
        </label>
        {!ignoreCost && (
          <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            {prices.cached
              ? 'live flea prices'
              : prices.loading
                ? 'loading prices'
                : 'prices needed for costs'}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              aria-label="Refresh prices"
              disabled={prices.loading}
              onClick={() => void prices.refresh()}
            >
              <RefreshCw
                aria-hidden="true"
                className={cn('size-3.5', prices.loading && 'animate-spin')}
              />
            </Button>
          </span>
        )}
      </div>

      {prices.error && !ignoreCost && <p className="text-xs text-destructive">{prices.error}</p>}

      {needsPrices ? (
        <p className="empty-note rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
          Cost ranking needs flea prices - refresh above, or switch to shortest-only.
        </p>
      ) : groups.length === 0 ? (
        <p className="empty-note rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
          No craftable stations yet - set your hideout levels on the{' '}
          <Link to="/hideout" className="text-primary underline-offset-2 hover:underline">
            hideout page
          </Link>{' '}
          or untick the filter above.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <div key={group.stationId} className="rounded-md border px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-xs font-medium text-muted-foreground">{group.stationName}</h3>
                {group.pairPointsPerHour !== null && (
                  <span
                    className="text-xs text-muted-foreground tabular-nums"
                    title="Skill points per hour when alternating crafts 1 and 2"
                  >
                    alternate 1 and 2: ≈{group.pairPointsPerHour.toFixed(1)} pts/h
                  </span>
                )}
              </div>
              <ul className="m-0 mt-1 list-none p-0">
                {group.rows.map((row, i) => (
                  <CraftRow key={row.craft.id} row={row} rank={i + 1} showCost={!ignoreCost} />
                ))}
              </ul>
              {group.rows.length < 2 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Only one recipe available - no alternation partner, so no craft bonus XP here.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function XpPage() {
  const [search, setSearch] = useState('');
  const q = search.toLowerCase();
  const visibleGuides = skillGuides.filter(
    (g) =>
      !q ||
      g.name.toLowerCase().includes(q) ||
      g.how.toLowerCase().includes(q) ||
      g.plan.some((s) => s.text.toLowerCase().includes(q)) ||
      g.cheese?.title.toLowerCase().includes(q) ||
      g.cheese?.detail.toLowerCase().includes(q),
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Skill XP</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            An easy proven routine per skill, plus the crafts to keep your stations busy. Rebuilt
            from the wiki and current guides for EFT 1.0.
          </p>
        </div>

        <ul className="m-0 flex list-none flex-col gap-1 rounded-lg border bg-card p-4 text-[13px] text-muted-foreground">
          {skillGlobalNotes.map((note) => (
            <li key={note.slice(0, 24)} className="flex gap-2">
              <span aria-hidden="true" className="text-muted-foreground/60">
                -
              </span>
              <span>{note}</span>
            </li>
          ))}
        </ul>

        <Input
          type="search"
          placeholder="Search skills, routines or items"
          aria-label="Search skills"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-72"
        />

        <CraftingCard />

        <div className="grid gap-3 sm:grid-cols-2">
          {visibleGuides.map((guide) => (
            <SkillCard key={guide.id} guide={guide} />
          ))}
        </div>
      </div>
    </div>
  );
}
