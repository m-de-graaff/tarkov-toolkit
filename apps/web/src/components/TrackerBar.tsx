import type { TrackerState } from '../lib/availability';
import { usePlanner } from '../store';

const FACTIONS: TrackerState['faction'][] = ['Any', 'USEC', 'BEAR'];

export function TrackerBar() {
  const tracker = usePlanner((s) => s.tracker);
  const setLevel = usePlanner((s) => s.setLevel);
  const setFaction = usePlanner((s) => s.setFaction);

  return (
    <div className="tracker-bar">
      <label className="field">
        <span>Level</span>
        <input
          type="number"
          min={1}
          max={79}
          value={tracker.level}
          onChange={(e) => setLevel(Number(e.target.value) || 1)}
        />
      </label>
      <label className="field">
        <span>Faction</span>
        <select
          value={tracker.faction}
          onChange={(e) => setFaction(e.target.value as TrackerState['faction'])}
        >
          {FACTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <span className="tracker-count" title="Quests marked as done">
        {tracker.completedTaskIds.length} done
      </span>
    </div>
  );
}
