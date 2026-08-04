import type { GamePosition } from '@raidplanner/data';
import { distance2d } from '../lib/geometry';
import type { PlannedRoute } from '../lib/route';

export function RoutePanel({
  route,
  originPosition,
  originLabel,
  hasSelection,
}: {
  route: PlannedRoute | null;
  originPosition: GamePosition | null;
  originLabel: 'live position' | 'spawn';
  hasSelection: boolean;
}) {
  return (
    <aside
      className="route-panel h-full overflow-y-auto bg-card p-4"
      aria-label="Planned route"
      aria-live="polite"
    >
      <h2 className="mb-2.5 text-xs uppercase tracking-widest text-muted-foreground">Route</h2>
      {!hasSelection ? (
        <p className="empty-note text-[13px] text-muted-foreground">
          Select quests to plan a route.
        </p>
      ) : !originPosition ? (
        <p className="empty-note text-[13px] text-muted-foreground">
          Pick a spawn (or connect live mode) to route your raid.
        </p>
      ) : !route || route.stops.length === 0 ? (
        <p className="empty-note text-[13px] text-muted-foreground">
          Selected quests have no located objectives on this map.
        </p>
      ) : (
        <>
          <p className="route-origin mb-1.5 text-xs text-muted-foreground">
            From your {originLabel}
          </p>
          <ol className="route-steps m-0 list-decimal pl-5">
            {route.stops.map((stop, i) => {
              const prev = i === 0 ? originPosition : route.stops[i - 1].position;
              const leg = Math.round(distance2d(prev, stop.position));
              return (
                <li key={stop.objectiveId} className="flex flex-col border-b py-1.5 text-[13px]">
                  <span className="font-semibold text-primary">{stop.taskName}</span>
                  <span>{stop.description}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">+{leg}m</span>
                </li>
              );
            })}
          </ol>
          <p className="route-total mt-2.5 font-semibold text-primary tabular-nums">
            Total ≈ {Math.round(route.totalDistance)}m
          </p>
        </>
      )}
    </aside>
  );
}
