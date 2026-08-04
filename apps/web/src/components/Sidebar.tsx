import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      className="sidebar flex h-full min-w-0 flex-col gap-1 overflow-y-auto bg-card p-4"
      aria-label="Raid planning"
    >
      <h1 className="mb-2 text-lg font-bold uppercase tracking-widest text-primary">
        Tarkov Raid Planner
      </h1>
      <TrackerBar />

      <h2 className="mb-2 mt-4 text-xs uppercase tracking-widest text-muted-foreground">Map</h2>
      <div className="grid min-w-0 grid-cols-2 gap-1.5" role="group" aria-label="Choose a map">
        {renderableMaps.map((map) => (
          <Button
            key={map.id}
            type="button"
            variant="outline"
            className={cn(
              'h-auto min-w-0 justify-between gap-1.5 px-2.5 py-2 text-[13px]',
              map.id === selectedMapId && 'border-primary bg-accent text-primary',
            )}
            aria-pressed={map.id === selectedMapId}
            onClick={() => selectMap(map.id)}
          >
            <span className="truncate" title={map.name}>
              {map.name}
            </span>
            <Badge
              variant="outline"
              className="badge-count shrink-0 border-primary/50 px-1.5 text-primary tabular-nums"
              title="Open quests on this map"
            >
              {openCounts.get(map.id) ?? 0}
            </Badge>
          </Button>
        ))}
      </div>

      <h2 className="mb-2 mt-4 text-xs uppercase tracking-widest text-muted-foreground">
        Quests
      </h2>
      <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2.5">
        <Input
          type="search"
          placeholder="Search quests…"
          aria-label="Search quests"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 min-w-32 flex-1"
        />
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
            className="size-4 accent-primary"
          />
          <span>Only available</span>
        </label>
      </div>

      {selectedMapId ? (
        <QuestList entries={entries} />
      ) : (
        <p className="empty-note text-[13px] text-muted-foreground">
          Pick a map to see its quests.
        </p>
      )}

      <AnywhereQuestList tasks={anywhere} />
      <Footer />
    </nav>
  );
}
