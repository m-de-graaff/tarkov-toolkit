import type { RpTask } from '@raidplanner/data';
import { isAvailable } from '../lib/availability';
import type { MapQuestEntry } from '../lib/questIndex';
import { usePlanner } from '../store';

function RelationBadge({ entry }: { entry: MapQuestEntry }) {
  if (entry.relation === 'map-locked') {
    return (
      <span className="badge badge-map" title="Can only be done on this map">
        MAP
      </span>
    );
  }
  return (
    <span className="badge badge-multi" title="Can also be advanced on other maps">
      MULTI
    </span>
  );
}

function QuestRow({
  task,
  badge,
  locatedCount,
}: {
  task: RpTask;
  badge?: MapQuestEntry;
  locatedCount: number;
}) {
  const selected = usePlanner((s) => s.selectedTaskIds.includes(task.id));
  const completed = usePlanner((s) => s.tracker.completedTaskIds.includes(task.id));
  const toggleTask = usePlanner((s) => s.toggleTask);
  const toggleCompleted = usePlanner((s) => s.toggleCompleted);

  return (
    <li className={`quest-row${completed ? ' completed' : ''}`}>
      {badge ? (
        <label className="quest-select">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleTask(task.id)}
            aria-label={`Plan ${task.name}`}
          />
          <span className="quest-name">{task.name}</span>
        </label>
      ) : (
        <span className="quest-name quest-select">{task.name}</span>
      )}
      {badge && <RelationBadge entry={badge} />}
      {locatedCount > 0 && (
        <span className="badge badge-count" title="Objectives with a known location on this map">
          {locatedCount}
        </span>
      )}
      <button
        type="button"
        className="done-toggle"
        aria-pressed={completed}
        title={completed ? 'Mark as not done' : 'Mark as done'}
        onClick={() => toggleCompleted(task.id)}
      >
        ✓
      </button>
    </li>
  );
}

export function QuestList({ entries }: { entries: MapQuestEntry[] }) {
  const search = usePlanner((s) => s.search);
  const onlyAvailable = usePlanner((s) => s.onlyAvailable);
  const tracker = usePlanner((s) => s.tracker);

  const visible = entries.filter((e) => {
    if (search && !e.task.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (onlyAvailable && !isAvailable(e.task, tracker)) return false;
    return true;
  });

  const byTrader = new Map<string, MapQuestEntry[]>();
  for (const entry of visible) {
    const list = byTrader.get(entry.task.trader.name) ?? [];
    list.push(entry);
    byTrader.set(entry.task.trader.name, list);
  }

  if (visible.length === 0) {
    return <p className="empty-note">No quests match the current filters.</p>;
  }

  return (
    <div className="quest-list">
      {[...byTrader.entries()].map(([trader, list]) => (
        <section key={trader} aria-label={`${trader} quests`}>
          <h3>{trader}</h3>
          <ul>
            {list.map((entry) => (
              <QuestRow
                key={entry.task.id}
                task={entry.task}
                badge={entry}
                locatedCount={entry.objectivesHere.reduce(
                  (n, o) => n + (o.points.length > 0 ? 1 : 0),
                  0,
                )}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function AnywhereQuestList({ tasks }: { tasks: RpTask[] }) {
  const search = usePlanner((s) => s.search);
  const onlyAvailable = usePlanner((s) => s.onlyAvailable);
  const tracker = usePlanner((s) => s.tracker);

  const visible = tasks.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (onlyAvailable && !isAvailable(t, tracker)) return false;
    return true;
  });

  return (
    <details className="anywhere">
      <summary>Anywhere quests ({visible.length})</summary>
      <ul>
        {visible.map((task) => (
          <QuestRow key={task.id} task={task} locatedCount={0} />
        ))}
      </ul>
    </details>
  );
}
