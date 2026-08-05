import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { snapshot } from '@raidplanner/data';
import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MethodCost, MethodPace, SkillGuide } from '../data/skillGuides';
import { skillGuides } from '../data/skillGuides';
import { craftingLevelingRows, stationName } from '../lib/craftingXp';
import { usePrices } from '../lib/usePrices';
import { usePlanner } from '../store';

const NO_LEVELS: Record<string, number> = {};

const rub = (n: number) => `₽${Math.round(n).toLocaleString()}`;

const COST_STYLE: Record<MethodCost, string> = {
  free: 'border-ok/50 text-ok',
  cheap: 'border-primary/50 text-primary',
  expensive: 'border-destructive/50 text-destructive',
};

const PACE_LABEL: Record<MethodPace, string> = {
  passive: 'passive',
  slow: 'slow',
  steady: 'steady',
  fast: 'fast',
};

function SkillCard({ guide }: { guide: SkillGuide }) {
  return (
    <section className="skill-card flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">{guide.name}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{guide.gives}</p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {guide.methods.map((method, i) => (
          <li key={method.title} className="flex flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
              <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
              {method.title}
              <Badge variant="outline" className={cn('px-1.5 text-[10px]', COST_STYLE[method.cost])}>
                {method.cost}
              </Badge>
              <Badge variant="outline" className="px-1.5 text-[10px] text-muted-foreground">
                {PACE_LABEL[method.pace]}
              </Badge>
            </span>
            <p className="pl-5 text-[13px] text-muted-foreground">{method.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CraftingCard() {
  const prices = usePrices();
  const hideoutLevels = usePlanner((s) => s.tracker.hideoutLevels ?? NO_LEVELS);
  const [onlyBuilt, setOnlyBuilt] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(
    () =>
      prices.cached
        ? craftingLevelingRows(snapshot.crafts, prices.cached.prices, hideoutLevels, onlyBuilt)
        : [],
    [prices.cached, hideoutLevels, onlyBuilt],
  );
  const visible = showAll ? rows : rows.slice(0, 15);

  return (
    <section className="skill-card flex flex-col gap-2 rounded-lg border border-primary/40 bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">Crafting</h2>
        <span className="text-xs text-muted-foreground">
          XP scales with production time, so the cheapest roubles-per-hour crafts win. Keep every
          station busy; short crafts let you requeue often.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
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
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {prices.cached
            ? `${rows.length} craftable options`
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
            <RefreshCw aria-hidden="true" className={cn('size-3.5', prices.loading && 'animate-spin')} />
          </Button>
        </span>
      </div>

      {prices.error && <p className="text-xs text-destructive">{prices.error}</p>}

      {prices.cached && (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b bg-secondary/40 text-left">
                  <th className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Craft</th>
                  <th className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Station</th>
                  <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">Duration</th>
                  <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">Materials</th>
                  <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">Cost per hour</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ craft, materialCost, costPerHour }) => (
                  <tr key={craft.id} className="border-b last:border-0 hover:bg-secondary/30">
                    <td className="px-3 py-1.5">
                      {craft.rewardItems
                        .map((s) => snapshot.itemsLite[s.itemId]?.name ?? 'Item')
                        .join(', ')}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">
                      {stationName(craft.stationId)} L{craft.stationLevel}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                      {(craft.durationSeconds / 3600).toFixed(1)}h
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                      {rub(materialCost)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-medium tabular-nums">
                      {rub(costPerHour)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 15 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start text-xs text-muted-foreground"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? 'Show top 15' : `Show all ${rows.length}`}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

export function XpPage() {
  const [search, setSearch] = useState('');
  const visibleGuides = skillGuides.filter(
    (g) =>
      !search ||
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.methods.some((m) => m.title.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Skill XP</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The fastest sensible way to level each skill. Crafting is computed live from craft
            costs; the rest are proven in-raid routines.
          </p>
        </div>

        <Input
          type="search"
          placeholder="Search skills or methods"
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
