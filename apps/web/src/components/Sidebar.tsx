import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { snapshot } from '@raidplanner/data';
import { useMemo } from 'react';
import { isAvailable } from '../lib/availability';
import { anywhereQuests, questsForMap } from '../lib/questIndex';
import { usePlanner } from '../store';
import { Footer } from './Footer';
import { AnywhereQuestList, QuestList } from './QuestList';
import { TrackerBar } from './TrackerBar';

const renderableMaps = snapshot.maps
  .filter((m) => m.calibration)
  .sort((a, b) => a.name.localeCompare(b.name));

const anywhere = anywhereQuests(snapshot);

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

export function Sidebar() {
  const selectedMapId = usePlanner((s) => s.selectedMapId);
  const selectMap = usePlanner((s) => s.selectMap);
  const search = usePlanner((s) => s.search);
  const setSearch = usePlanner((s) => s.setSearch);
  const onlyAvailable = usePlanner((s) => s.onlyAvailable);
  const setOnlyAvailable = usePlanner((s) => s.setOnlyAvailable);
  const tracker = usePlanner((s) => s.tracker);

  const openCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const map of renderableMaps) {
      counts.set(
        map.id,
        questsForMap(snapshot, map.id).filter((e) => isAvailable(e.task, tracker)).length,
      );
    }
    return counts;
  }, [tracker]);

  const entries = useMemo(
    () => (selectedMapId ? questsForMap(snapshot, selectedMapId) : []),
    [selectedMapId],
  );

  return (
    <nav
      className="sidebar flex h-full min-w-0 flex-col overflow-y-auto bg-card px-4 py-4"
      aria-label="Raid planning"
    >
      <div className="flex items-baseline gap-2">
        <h1 className="text-sm font-semibold">Raid Planner</h1>
        <span className="text-[11px] text-muted-foreground">Escape from Tarkov</span>
      </div>

      <SectionLabel>Your progress</SectionLabel>
      <TrackerBar />

      <SectionLabel>Maps</SectionLabel>
      <div className="flex flex-col" role="group" aria-label="Choose a map">
        {renderableMaps.map((map) => {
          const selected = map.id === selectedMapId;
          return (
            <button
              key={map.id}
              type="button"
              aria-pressed={selected}
              onClick={() => selectMap(map.id)}
              className={cn(
                'relative flex h-8 min-w-0 items-center justify-between gap-2 rounded-md px-2.5 text-left text-sm transition-colors',
                'hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring',
                selected
                  ? 'bg-accent font-medium text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
                  : 'text-foreground/90',
              )}
            >
              <span className="truncate" title={map.name}>
                {map.name}
              </span>
              <span
                className="badge-count shrink-0 text-xs text-muted-foreground tabular-nums"
                title="Open quests on this map"
              >
                {openCounts.get(map.id) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      <SectionLabel>Quests</SectionLabel>
      <div className="mb-2 flex min-w-0 flex-col gap-2">
        <Input
          type="search"
          placeholder="Search quests…"
          aria-label="Search quests"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
            className="size-4 accent-primary"
          />
          <span>Only show quests I can start</span>
        </label>
      </div>

      {selectedMapId ? (
        <QuestList entries={entries} />
      ) : (
        <p className="empty-note rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
          Pick a map above to see every quest you can work on there.
        </p>
      )}

      <AnywhereQuestList tasks={anywhere} />
      <Separator className="mt-6" />
      <Footer />
    </nav>
  );
}
