import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RpTask } from '@raidplanner/data';
import { Check } from 'lucide-react';
import { isAvailable } from '../lib/availability';
import type { MapQuestEntry } from '../lib/questIndex';
import { usePlanner } from '../store';

function RelationBadge({ entry }: { entry: MapQuestEntry }) {
  if (entry.relation === 'map-locked') {
    return (
      <Badge className="badge-map shrink-0" title="Can only be done on this map">
        MAP
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="badge-multi shrink-0 text-muted-foreground"
      title="Can also be advanced on other maps"
    >
      MULTI
    </Badge>
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
    <li
      className={cn(
        'quest-row flex min-h-8 items-center gap-2 rounded-sm px-1 py-1 hover:bg-secondary/60',
        completed && 'completed',
      )}
    >
      {badge ? (
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleTask(task.id)}
            aria-label={`Plan ${task.name}`}
            className="size-4 shrink-0 accent-primary"
          />
          <span
            className={cn(
              'quest-name truncate text-[13px]',
              completed && 'text-muted-foreground line-through',
            )}
            title={task.name}
          >
            {task.name}
          </span>
        </label>
      ) : (
        <span
          className={cn(
            'quest-name min-w-0 flex-1 truncate text-[13px]',
            completed && 'text-muted-foreground line-through',
          )}
          title={task.name}
        >
          {task.name}
        </span>
      )}
      {badge && <RelationBadge entry={badge} />}
      {locatedCount > 0 && (
        <Badge
          variant="outline"
          className="badge-count shrink-0 border-primary/50 text-primary tabular-nums"
          title="Objectives with a known location on this map"
        >
          {locatedCount}
        </Badge>
      )}
      <Button
        type="button"
        variant={completed ? 'default' : 'outline'}
        size="icon"
        className={cn('size-6 shrink-0', completed && 'bg-ok text-white hover:bg-ok/90')}
        aria-pressed={completed}
        title={completed ? 'Mark as not done' : 'Mark as done'}
        onClick={() => toggleCompleted(task.id)}
      >
        <Check aria-hidden="true" className="size-3.5" />
      </Button>
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
    return <p className="empty-note text-[13px] text-muted-foreground">No quests match the current filters.</p>;
  }

  return (
    <div className="quest-list">
      {[...byTrader.entries()].map(([trader, list]) => (
        <section key={trader} aria-label={`${trader} quests`}>
          <h3 className="mb-1 mt-3 text-[13px] font-semibold text-primary/70">{trader}</h3>
          <ul className="m-0 list-none p-0">
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
    <details className="anywhere mt-4">
      <summary className="cursor-pointer text-[13px] text-muted-foreground">
        Anywhere quests ({visible.length})
      </summary>
      <ul className="m-0 list-none p-0">
        {visible.map((task) => (
          <QuestRow key={task.id} task={task} locatedCount={0} />
        ))}
      </ul>
    </details>
  );
}
