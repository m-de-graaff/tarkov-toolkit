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
import type { TrackerState } from '../lib/availability';
import { availableQuests, isAvailable } from '../lib/availability';
import { snapshotForMode } from '../lib/modeTasks';
import { usePlanner } from '../store';

const FACTIONS: TrackerState['faction'][] = ['Any', 'USEC', 'BEAR'];

function ProgressQuestRow({ task }: { task: RpTask }) {
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
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={completed}
          onChange={() => toggleCompleted(task.id)}
          aria-label={`Mark ${task.name} as finished`}
          className="size-4 shrink-0 accent-primary"
        />
        <span
          className={cn('truncate text-sm', completed && 'text-muted-foreground line-through')}
          title={task.name}
        >
          {task.name}
        </span>
      </label>
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

  const modeSnapshot = useMemo(() => snapshotForMode(snapshot, gameMode), [gameMode]);
  const openCount = useMemo(
    () => availableQuests(modeSnapshot, tracker).length,
    [tracker, modeSnapshot],
  );

  const byTrader = useMemo(() => {
    const groups = new Map<string, RpTask[]>();
    for (const task of modeSnapshot.tasks) {
      if (search && !task.name.toLowerCase().includes(search.toLowerCase())) continue;
      const list = groups.get(task.trader.name) ?? [];
      list.push(task);
      groups.set(task.trader.name, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.minPlayerLevel - b.minPlayerLevel || a.name.localeCompare(b.name));
    }
    return groups;
  }, [search, modeSnapshot]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-semibold">Your progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set your level and tick the quests you've finished — the planner then always shows
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
              onChange={(e) => setLevel(Number(e.target.value) || 1)}
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
              <strong className="text-primary">{tracker.completedTaskIds.length}</strong> of{' '}
              {modeSnapshot.tasks.length} quests finished
            </span>
            <span className="text-muted-foreground tabular-nums">{openCount} open right now</span>
          </div>
          <div className="ml-auto">
            <ResetButton />
          </div>
        </section>

        <Input
          type="search"
          placeholder="Search all quests…"
          aria-label="Search all quests"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9"
        />

        {[...byTrader.entries()].map(([trader, tasks]) => (
          <section key={trader} aria-label={`${trader} quests`}>
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {trader}
            </h2>
            <Separator className="mb-2" />
            <ul className="m-0 flex list-none flex-col p-0">
              {tasks.map((task) => (
                <ProgressQuestRow key={task.id} task={task} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
