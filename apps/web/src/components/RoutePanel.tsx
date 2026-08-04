import type { GamePosition } from '@raidplanner/data';
import { distance2d } from '../lib/geometry';
import type { PlannedRoute } from '../lib/route';

export function RoutePanel({
  route,
  spawnPosition,
  hasSelection,
}: {
  route: PlannedRoute | null;
  spawnPosition: GamePosition | null;
  hasSelection: boolean;
}) {
  return (
    <aside className="route-panel" aria-label="Planned route" aria-live="polite">
      <h2>Route</h2>
      {!hasSelection ? (
        <p className="empty-note">Select quests to plan a route.</p>
      ) : !spawnPosition ? (
        <p className="empty-note">Pick a spawn to route your raid.</p>
      ) : !route || route.stops.length === 0 ? (
        <p className="empty-note">Selected quests have no located objectives on this map.</p>
      ) : (
        <>
          <ol className="route-steps">
            {route.stops.map((stop, i) => {
              const prev = i === 0 ? spawnPosition : route.stops[i - 1].position;
              const leg = Math.round(distance2d(prev, stop.position));
              return (
                <li key={stop.objectiveId}>
                  <span className="route-task">{stop.taskName}</span>
                  <span className="route-desc">{stop.description}</span>
                  <span className="route-leg">+{leg}m</span>
                </li>
              );
            })}
          </ol>
          <p className="route-total">Total ≈ {Math.round(route.totalDistance)}m</p>
        </>
      )}
    </aside>
  );
}
