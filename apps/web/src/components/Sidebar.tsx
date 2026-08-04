import { snapshot } from '@raidplanner/data';
import { useMemo } from 'react';
import { isAvailable } from '../lib/availability';
import { anywhereQuests, questsForMap } from '../lib/questIndex';
import { usePlanner } from '../store';
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
    <nav className="sidebar" aria-label="Raid planning">
      <h1>Tarkov Raid Planner</h1>
      <TrackerBar />

      <h2>Map</h2>
      <div className="map-picker" role="group" aria-label="Choose a map">
        {renderableMaps.map((map) => (
          <button
            key={map.id}
            type="button"
            className={`map-button${map.id === selectedMapId ? ' selected' : ''}`}
            aria-pressed={map.id === selectedMapId}
            onClick={() => selectMap(map.id)}
          >
            {map.name}
            <span className="badge badge-count" title="Open quests on this map">
              {openCounts.get(map.id) ?? 0}
            </span>
          </button>
        ))}
      </div>

      <h2>Quests</h2>
      <div className="quest-filters">
        <input
          type="search"
          placeholder="Search quests…"
          aria-label="Search quests"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="only-available">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
          />
          <span>Only available</span>
        </label>
      </div>

      {selectedMapId ? (
        <QuestList entries={entries} />
      ) : (
        <p className="empty-note">Pick a map to see its quests.</p>
      )}

      <AnywhereQuestList tasks={anywhere} />
    </nav>
  );
}
