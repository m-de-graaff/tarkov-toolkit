import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { RpTask } from '@raidplanner/data';
import { snapshot } from '@raidplanner/data';
import { Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TrackerState } from '../lib/availability';
import { availableQuests, isAvailable } from '../lib/availability';
import { snapshotForMode } from '../lib/modeTasks';
import { STORY_WIKI_URL, storyChapters } from '../data/storyline';
import { usePlanner } from '../store';

const FACTIONS: TrackerState['faction'][] = ['Any', 'USEC', 'BEAR'];

const mapName = (normalized: string) =>
  snapshot.maps.find((m) => m.normalizedName === normalized)?.name ?? normalized;

function StorylineSection() {
  const done = usePlanner((s) => s.tracker.storyChapterIds) ?? [];
  const toggleStoryChapter = usePlanner((s) => s.toggleStoryChapter);
  return (
    <section aria-label="Story chapters">
      <h2 className="mb-1 flex items-baseline gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Storyline
        <span className="normal-case tabular-nums">
          {done.length}/{storyChapters.length} chapters
        </span>
        <a
          href={STORY_WIKI_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto normal-case text-primary/70 underline-offset-2 hover:underline"
        >
          wiki
        </a>
      </h2>
      <Separator className="mb-2" />
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {storyChapters.map((chapter) => {
          const finished = done.includes(chapter.id);
          return (
            <li
              key={chapter.id}
              className="story-row flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-secondary/60"
            >
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={finished}
                  onChange={() => toggleStoryChapter(chapter.id)}
                  aria-label={`Mark chapter ${chapter.name} as finished`}
                  className="size-4 shrink-0 accent-primary"
                />
                <span
                  className={cn(
                    'text-sm font-medium',
                    finished && 'text-muted-foreground line-through',
                  )}
                >
                  {chapter.order}. {chapter.name}
                </span>
                <span className="ml-auto flex shrink-0 gap-1">
                  {chapter.maps.slice(0, 3).map((m) => (
                    <Badge
                      key={m}
                      variant="outline"
                      className="px-1.5 text-[10px] text-muted-foreground"
                    >
                      {mapName(m)}
                    </Badge>
                  ))}
                  {chapter.maps.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{chapter.maps.length - 3}
                    </span>
                  )}
                </span>
              </label>
              {!finished && (
                <p className="pl-6.5 text-pretty text-xs text-muted-foreground">{chapter.start}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ProgressQuestRow({ task, deadEnd }: { task: RpTask; deadEnd?: boolean }) {
  const tracker = usePlanner((s) => s.tracker);
  const toggleCompleted = usePlanner((s) => s.toggleCompleted);
  const completed = tracker.completedTaskIds.includes(task.id);
  const open = isAvailable(task, tracker);

  return (
    <li
      className={cn(
        'quest-row flex min-h-9 items-center gap-2.5 rounded-md px-2 py-1 hover:bg-secondary/60',
        !open && !completed && 'opacity-55',
      )}
    >
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
      {task.minPlayerLevel > 1 && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          Lv {task.minPlayerLevel}
        </span>
      )}
      {!open && !completed && (
        <span
          className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
          title="Finish the quests before it (or level up) to unlock"
        >
          <Lock aria-hidden="true" className="size-3" /> locked
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

function ResetButton() {
  const resetProgress = usePlanner((s) => s.resetProgress);
  const [arming, setArming] = useState(false);
  if (!arming) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setArming(true)}>
        Reset progress…
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => {
          resetProgress();
          setArming(false);
        }}
      >
        Yes, wipe my progress
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setArming(false)}>
        Cancel
      </Button>
    </div>
  );
}

export function ProgressPage() {
  const tracker = usePlanner((s) => s.tracker);
  const gameMode = usePlanner((s) => s.gameMode);
  const setLevel = usePlanner((s) => s.setLevel);
  const setFaction = usePlanner((s) => s.setFaction);
  const [search, setSearch] = useState('');
  const [showLocked, setShowLocked] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [kappaOnly, setKappaOnly] = useState(false);
  const [unlocksOnly, setUnlocksOnly] = useState(false);

  const modeSnapshot = useMemo(() => snapshotForMode(snapshot, gameMode), [gameMode]);

  // quests that are a prerequisite of at least one other quest in this mode -
  // everything else is a dead end (nothing depends on it)
  const unlocksSomething = useMemo(() => {
    const ids = new Set<string>();
    for (const task of modeSnapshot.tasks) {
      for (const req of task.taskRequirements) ids.add(req.taskId);
    }
    return ids;
  }, [modeSnapshot]);
  const openCount = useMemo(
    () => availableQuests(modeSnapshot, tracker).length,
    [tracker, modeSnapshot],
  );

  const byTrader = useMemo(() => {
    const groups = new Map<string, { tasks: RpTask[]; total: number; completed: number }>();
    for (const task of modeSnapshot.tasks) {
      const group = groups.get(task.trader.name) ?? { tasks: [], total: 0, completed: 0 };
      group.total++;
      const completed = tracker.completedTaskIds.includes(task.id);
      if (completed) group.completed++;
      groups.set(task.trader.name, group);

      if (search && !task.name.toLowerCase().includes(search.toLowerCase())) continue;
      if (kappaOnly && !task.kappaRequired) continue;
      if (unlocksOnly && !unlocksSomething.has(task.id)) continue;
      if (!showCompleted && completed) continue;
      if (!showLocked && !completed && !isAvailable(task, tracker)) continue;
      group.tasks.push(task);
    }
    for (const group of groups.values()) {
      group.tasks.sort((a, b) => a.minPlayerLevel - b.minPlayerLevel || a.name.localeCompare(b.name));
    }
    return groups;
  }, [search, modeSnapshot, showLocked, showCompleted, kappaOnly, unlocksOnly, unlocksSomething, tracker]);

  const totalCompleted = tracker.completedTaskIds.filter((id) =>
    modeSnapshot.tasks.some((t) => t.id === id),
  ).length;
  const progressPct =
    modeSnapshot.tasks.length === 0
      ? 0
      : Math.round((totalCompleted / modeSnapshot.tasks.length) * 100);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Your progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set your level and tick the quests you have finished. The planner then always shows
            exactly what you can work on. Everything is saved in your browser.
          </p>
        </div>

        <section
          aria-label="Your PMC"
          className="flex flex-wrap items-end gap-5 rounded-lg border bg-card p-4"
        >
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Level</span>
            <Input
              type="number"
              min={1}
              max={79}
              value={tracker.level}
              onChange={(e) => setLevel(Math.min(79, Math.max(1, Number(e.target.value) || 1)))}
              className="h-9 w-24 tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Faction</span>
            <Select
              value={tracker.faction}
              onValueChange={(v) => setFaction(v as TrackerState['faction'])}
            >
              <SelectTrigger className="h-9 w-28" aria-label="Faction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FACTIONS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="tabular-nums">
              <strong className="text-primary">{totalCompleted}</strong> of{' '}
              {modeSnapshot.tasks.length} quests finished
            </span>
            <span className="text-muted-foreground tabular-nums">{openCount} open right now</span>
            <span
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Overall quest completion"
              className="mt-1 block h-1.5 w-40 overflow-hidden rounded-full bg-secondary"
            >
              <span className="block h-full bg-primary" style={{ width: `${progressPct}%` }} />
            </span>
          </div>
          <div className="ml-auto">
            <ResetButton />
          </div>
        </section>

        <StorylineSection />

        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-md bg-background/95 px-1 py-2 backdrop-blur">
          <Input
            type="search"
            placeholder="Search all quests…"
            aria-label="Search all quests"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 max-w-64 flex-1"
          />
          {(
            [
              { label: 'Locked', value: showLocked, set: setShowLocked },
              { label: 'Completed', value: showCompleted, set: setShowCompleted },
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

        {[...byTrader.entries()]
          .filter(([, group]) => group.tasks.length > 0)
          .map(([trader, group]) => (
            <section key={trader} aria-label={`${trader} quests`}>
              <h2 className="mb-1 flex items-baseline gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {trader}
                <span className="normal-case tabular-nums">
                  {group.completed}/{group.total} done
                </span>
              </h2>
              <Separator className="mb-2" />
              <ul className="m-0 flex list-none flex-col p-0">
                {group.tasks.map((task) => (
                  <ProgressQuestRow key={task.id} task={task} deadEnd={!unlocksSomething.has(task.id)} />
                ))}
              </ul>
            </section>
          ))}
      </div>
    </div>
  );
}
