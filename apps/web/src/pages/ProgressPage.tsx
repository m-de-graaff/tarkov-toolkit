import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { snapshot } from '@raidplanner/data';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StoryTimeline } from '../components/StoryTimeline';
import { TraderQuestBoard } from '../components/TraderQuestBoard';
import type { TrackerState } from '../lib/availability';
import { availableQuests } from '../lib/availability';
import { snapshotForMode } from '../lib/modeTasks';
import { usePlanner } from '../store';

const FACTIONS: TrackerState['faction'][] = ['Any', 'USEC', 'BEAR'];

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
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'story' ? 'story' : 'quests';

  const modeSnapshot = useMemo(() => snapshotForMode(snapshot, gameMode), [gameMode]);
  const openCount = useMemo(
    () => availableQuests(modeSnapshot, tracker).length,
    [tracker, modeSnapshot],
  );

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

        <Tabs
          value={tab}
          onValueChange={(next) => {
            const nextParams = new URLSearchParams(params);
            if (next === 'quests') nextParams.delete('tab');
            else nextParams.set('tab', next);
            setParams(nextParams, { replace: true });
          }}
        >
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="quests">Quests</TabsTrigger>
            <TabsTrigger value="story">Story</TabsTrigger>
          </TabsList>

          <TabsContent value="story">
            <StoryTimeline />
          </TabsContent>

          <TabsContent value="quests">
            <TraderQuestBoard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
