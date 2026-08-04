import { snapshot } from '@raidplanner/data';
import { useMemo } from 'react';
import { LivePanel } from './components/LivePanel';
import type { MapMarker } from './components/MapCanvas';
import { MapCanvas } from './components/MapCanvas';
import { RecommendBanner } from './components/RecommendBanner';
import { RoutePanel } from './components/RoutePanel';
import { Sidebar } from './components/Sidebar';
import { SpawnPicker } from './components/SpawnPicker';
import { useLiveWatcher } from './lib/useLiveWatcher';
import { distance2d } from './lib/geometry';
import { objectivePoints } from './lib/questIndex';
import type { RouteStop } from './lib/route';
import { optimizeRoute } from './lib/route';
import { usePlanner } from './store';

export function App() {
  const selectedMapId = usePlanner((s) => s.selectedMapId);
  const selectedTaskIds = usePlanner((s) => s.selectedTaskIds);
  const spawn = usePlanner((s) => s.spawn);
  const setSpawn = usePlanner((s) => s.setSpawn);
  const liveFix = usePlanner((s) => s.liveFix);
  const watcher = useLiveWatcher();

  const map = snapshot.maps.find((m) => m.id === selectedMapId);

  // The route starts from where you actually are (live fix) when live mode has
  // one, otherwise from the chosen spawn.
  const routeOrigin = liveFix?.position ?? spawn?.position ?? null;

  // One stop per selected objective, at its candidate point nearest the route
  // origin (first point when there is none yet).
  const stops = useMemo(() => {
    if (!map) return [];
    const out: RouteStop[] = [];
    for (const taskId of selectedTaskIds) {
      const task = snapshot.tasks.find((t) => t.id === taskId);
      if (!task) continue;
      for (const { objective, points } of objectivePoints(task, map.id)) {
        const point = routeOrigin
          ? points.reduce((a, b) =>
              distance2d(a.position, routeOrigin) <= distance2d(b.position, routeOrigin)
                ? a
                : b,
            )
          : points[0];
        out.push({
          taskId: task.id,
          taskName: task.name,
          objectiveId: objective.id,
          description: objective.description,
          position: point.position,
        });
      }
    }
    return out;
  }, [map, selectedTaskIds, routeOrigin]);

  const route = useMemo(
    () => (routeOrigin && stops.length > 0 ? optimizeRoute(routeOrigin, stops) : null),
    [routeOrigin, stops],
  );

  const outOfBounds = useMemo(() => {
    if (!liveFix || !map?.calibration) return false;
    const [[x1, z1], [x2, z2]] = map.calibration.bounds;
    const { x, z } = liveFix.position;
    return (
      x < Math.min(x1, x2) ||
      x > Math.max(x1, x2) ||
      z < Math.min(z1, z2) ||
      z > Math.max(z1, z2)
    );
  }, [liveFix, map]);

  const markers = useMemo(() => {
    const orderByObjective = new Map(route?.stops.map((s, i) => [s.objectiveId, i]));
    const out: MapMarker[] = stops.map((stop) => ({
      id: stop.objectiveId,
      position: stop.position,
      label: stop.description,
      kind: 'objective' as const,
      orderIndex: orderByObjective.get(stop.objectiveId),
      taskName: stop.taskName,
    }));
    if (spawn && !liveFix) {
      out.push({ id: 'spawn', position: spawn.position, label: 'Spawn', kind: 'spawn' });
    }
    if (liveFix) {
      out.push({
        id: 'player',
        position: liveFix.position,
        label: 'You are here',
        kind: 'player',
        yawDeg: liveFix.yawDeg,
      });
    }
    return out;
  }, [stops, route, spawn, liveFix]);

  return (
    <div className="app">
      <Sidebar />
      <main>
        {map?.calibration ? (
          <>
            <div className="map-toolbar">
              <SpawnPicker map={map} />
              <LivePanel watcher={watcher} outOfBounds={outOfBounds} />
              <RecommendBanner />
            </div>
            <MapCanvas
              map={map}
              markers={markers}
              route={route}
              onMapClick={(p) => setSpawn({ kind: 'custom', position: p })}
            />
          </>
        ) : (
          <div className="map-placeholder">
            {map
              ? 'No offline map is available for this location yet.'
              : 'Select a map to begin planning.'}
          </div>
        )}
      </main>
      {map?.calibration && (
        <RoutePanel
          route={route}
          originPosition={routeOrigin}
          originLabel={liveFix ? 'live position' : 'spawn'}
          hasSelection={selectedTaskIds.length > 0}
        />
      )}
    </div>
  );
}
