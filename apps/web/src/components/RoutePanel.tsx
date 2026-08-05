import type { GamePosition, RpExtract } from '@raidplanner/data';
import { distance2d } from '../lib/geometry';
import type { PlannedRoute } from '../lib/route';

export function RoutePanel({
  route,
  originPosition,
  originLabel,
  hasSelection,
  extract,
}: {
  route: PlannedRoute | null;
  originPosition: GamePosition | null;
  originLabel: 'live position' | 'spawn';
  hasSelection: boolean;
  extract?: RpExtract | null;
}) {
  return (
    <aside
      className="route-panel h-full overflow-y-auto bg-card px-4 py-4"
      aria-label="Planned route"
      aria-live="polite"
    >
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Route
      </h2>
      {!hasSelection ? (
        <p className="empty-note rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
          Tick quests in the sidebar and their objectives appear here in visiting order.
        </p>
      ) : !originPosition ? (
        <p className="empty-note rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
          Choose a spawn point above the map — or connect live mode — to plan the route.
        </p>
      ) : !route || route.stops.length === 0 ? (
        <p className="empty-note rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
          The selected quests have no located objectives on this map.
        </p>
      ) : (
        <>
          <p className="route-origin mb-2 text-xs text-muted-foreground">
            From your {originLabel}
          </p>
          <ol className="route-steps m-0 flex list-none flex-col p-0">
            {route.stops.map((stop, i) => {
              const prev = i === 0 ? originPosition : route.stops[i - 1].position;
              const leg = Math.round(distance2d(prev, stop.position));
              return (
                <li key={stop.objectiveId} className="flex gap-2.5 py-2 not-last:border-b">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 text-[13px]">
                    <span className="font-medium">{stop.taskName}</span>
                    <span className="text-muted-foreground">{stop.description}</span>
                    <span className="text-xs text-muted-foreground/80 tabular-nums">
                      {leg}m from previous
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          {extract && (
            <p className="route-extract mt-2 flex items-center gap-2 text-[13px]">
              <span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-white">
                EX
              </span>
              <span className="min-w-0 truncate font-medium">{extract.name}</span>
              {extract.conditional && (
                <span className="text-xs text-muted-foreground" title="Not always open — check it's active this raid">
                  conditional
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                +
                {Math.round(
                  distance2d(
                    route.stops.at(-1)?.position ?? originPosition,
                    extract.position,
                  ),
                )}
                m
              </span>
            </p>
          )}
          <p className="route-total mt-3 border-t pt-3 text-[13px] font-medium tabular-nums">
            Total ≈ {Math.round(route.totalDistance)}m
          </p>
        </>
      )}
    </aside>
  );
}
