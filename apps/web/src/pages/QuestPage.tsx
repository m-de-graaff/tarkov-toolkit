import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { RpObjective, RpTask } from '@raidplanner/data';
import { snapshot } from '@raidplanner/data';
import { ArrowLeft, Check, ExternalLink, MapPin } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ItemIcon } from '../components/ItemIcon';
import { isAvailable } from '../lib/availability';
import { snapshotForMode } from '../lib/modeTasks';
import { usePlanner } from '../store';

const mapById = (id: string) => snapshot.maps.find((m) => m.id === id);

function QuestLink({ task, done }: { task: RpTask; done: boolean }) {
  return (
    <Link
      to={`/quest/${task.normalizedName}`}
      className={cn(
        'text-sm text-foreground underline-offset-2 hover:underline',
        done && 'text-muted-foreground line-through',
      )}
    >
      {task.name}
    </Link>
  );
}

function ObjectiveRow({ objective, index }: { objective: RpObjective; index: number }) {
  const mapNames = [
    ...new Set(
      (objective.maps.length > 0 ? objective.maps : objective.points.map((p) => p.map)).map(
        (id) => mapById(id)?.name ?? null,
      ),
    ),
  ].filter((n): n is string => n !== null);

  return (
    <li className="flex flex-col gap-1 rounded-md border bg-card px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
        <span className="min-w-0 text-pretty text-sm">
          {objective.description}
          {objective.count && objective.count > 1 && (
            <span className="text-muted-foreground tabular-nums"> ×{objective.count}</span>
          )}
        </span>
        {objective.optional && (
          <Badge variant="outline" className="ml-auto shrink-0 px-1.5 text-[10px] text-muted-foreground">
            optional
          </Badge>
        )}
      </div>
      {(mapNames.length > 0 || objective.points.length > 0) && (
        <p className="flex flex-wrap items-center gap-1 pl-5 text-xs text-muted-foreground">
          <MapPin aria-hidden="true" className="size-3" />
          {mapNames.length > 0 ? mapNames.join(', ') : 'Any map'}
          {objective.points.length > 0 && (
            <span>· {objective.points.length} known location{objective.points.length > 1 ? 's' : ''}</span>
          )}
        </p>
      )}
      {objective.neededItems && objective.neededItems.itemIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-5">
          {objective.neededItems.itemIds.map((itemId) => {
            const item = snapshot.itemsLite[itemId];
            return (
              <span
                key={itemId}
                className="flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs"
                title={item?.name}
              >
                <ItemIcon
                  itemId={itemId}
                  iconLink={item?.iconLink}
                  className="size-5 rounded-sm border bg-black/40 object-contain"
                />
                <span className="max-w-40 truncate">{item?.name ?? 'Unknown item'}</span>
              </span>
            );
          })}
          {objective.neededItems.count > 1 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              ×{objective.neededItems.count}
            </span>
          )}
          {objective.neededItems.foundInRaid && (
            <Badge variant="outline" className="px-1.5 text-[10px] text-muted-foreground" title="Must be found in raid">
              FIR
            </Badge>
          )}
        </div>
      )}
    </li>
  );
}

export function QuestPage() {
  const { normalizedName } = useParams();
  const navigate = useNavigate();
  const gameMode = usePlanner((s) => s.gameMode);
  const tracker = usePlanner((s) => s.tracker);
  const toggleCompleted = usePlanner((s) => s.toggleCompleted);
  const selectMap = usePlanner((s) => s.selectMap);
  const toggleTask = usePlanner((s) => s.toggleTask);
  const selectedTaskIds = usePlanner((s) => s.selectedTaskIds);

  const modeSnapshot = useMemo(() => snapshotForMode(snapshot, gameMode), [gameMode]);
  // fall back to the union set so links keep working across modes
  const task =
    modeSnapshot.tasks.find((t) => t.normalizedName === normalizedName) ??
    snapshot.tasks.find((t) => t.normalizedName === normalizedName);

  if (!task) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
          <p>No quest called "{normalizedName}" exists in the current data.</p>
          <Link to="/progress" className="text-primary underline-offset-2 hover:underline">
            Back to progress
          </Link>
        </div>
      </div>
    );
  }

  const completed = tracker.completedTaskIds.includes(task.id);
  const open = isAvailable(task, tracker);
  const prereqs = task.taskRequirements
    .filter((r) => r.status.includes('complete'))
    .map((r) => snapshot.tasks.find((t) => t.id === r.taskId))
    .filter((t): t is RpTask => Boolean(t));
  const unlocks = modeSnapshot.tasks.filter((t) =>
    t.taskRequirements.some((r) => r.taskId === task.id && r.status.includes('complete')),
  );
  const planMaps = [...new Set(task.objectives.flatMap((o) => o.points.map((p) => p.map)))]
    .map((id) => mapById(id))
    .filter((m): m is NonNullable<ReturnType<typeof mapById>> => Boolean(m?.calibration));

  const planOn = (mapId: string) => {
    selectMap(mapId);
    if (!selectedTaskIds.includes(task.id)) toggleTask(task.id);
    void navigate('/planner');
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" /> Back
        </button>

        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-balance text-xl font-semibold">{task.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{task.trader.name}</span>
              {task.minPlayerLevel > 1 && <span>· level {task.minPlayerLevel}+</span>}
              {task.experience > 0 && (
                <span className="tabular-nums">· {task.experience.toLocaleString()} XP</span>
              )}
              {task.factionName !== 'Any' && <span>· {task.factionName} only</span>}
              {task.kappaRequired && (
                <Badge variant="outline" className="px-1.5 text-[10px]" title="Needed for the Kappa container">
                  KAPPA
                </Badge>
              )}
              {!open && !completed && (
                <Badge variant="outline" className="px-1.5 text-[10px] text-muted-foreground">
                  locked
                </Badge>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {task.wikiLink && (
              <Button asChild type="button" variant="outline" size="sm">
                <a href={task.wikiLink} target="_blank" rel="noreferrer">
                  Wiki <ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
              </Button>
            )}
            <Button
              type="button"
              variant={completed ? 'default' : 'outline'}
              size="sm"
              className={cn(completed && 'bg-ok text-white hover:bg-ok/90')}
              aria-pressed={completed}
              onClick={() => toggleCompleted(task.id)}
            >
              <Check aria-hidden="true" className="size-3.5" />
              {completed ? 'Finished' : 'Mark finished'}
            </Button>
          </div>
        </div>

        {planMaps.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {planMaps.map((map) => (
              <Button key={map.id} type="button" variant="secondary" size="sm" onClick={() => planOn(map.id)}>
                <MapPin aria-hidden="true" className="size-3.5" /> Plan on {map.name}
              </Button>
            ))}
          </div>
        )}

        {prereqs.length > 0 && (
          <section aria-label="Requirements">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Requires
            </h2>
            <Separator className="mb-2" />
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {prereqs.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <Check
                    aria-hidden="true"
                    className={cn(
                      'size-3.5',
                      tracker.completedTaskIds.includes(t.id) ? 'text-ok' : 'text-muted-foreground/40',
                    )}
                  />
                  <QuestLink task={t} done={tracker.completedTaskIds.includes(t.id)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Objectives">
          <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Objectives
          </h2>
          <Separator className="mb-2" />
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {task.objectives.map((objective, i) => (
              <ObjectiveRow key={objective.id} objective={objective} index={i} />
            ))}
          </ol>
        </section>

        {unlocks.length > 0 && (
          <section aria-label="Unlocks">
            <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Unlocks
            </h2>
            <Separator className="mb-2" />
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {unlocks.map((t) => (
                <li key={t.id}>
                  <QuestLink task={t} done={tracker.completedTaskIds.includes(t.id)} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
