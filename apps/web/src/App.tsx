import { snapshot } from '@raidplanner/data';
import { useMemo } from 'react';
import type { MapMarker } from './components/MapCanvas';
import { MapCanvas } from './components/MapCanvas';
import { RecommendBanner } from './components/RecommendBanner';
import { RoutePanel } from './components/RoutePanel';
import { Sidebar } from './components/Sidebar';
import { SpawnPicker } from './components/SpawnPicker';
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

  const map = snapshot.maps.find((m) => m.id === selectedMapId);

  // One stop per selected objective, at its candidate point nearest the spawn
  // (first point when no spawn is set yet).
  const stops = useMemo(() => {
    if (!map) return [];
    const out: RouteStop[] = [];
    for (const taskId of selectedTaskIds) {
      const task = snapshot.tasks.find((t) => t.id === taskId);
      if (!task) continue;
      for (const { objective, points } of objectivePoints(task, map.id)) {
        const ref = spawn?.position;
        const point = ref
          ? points.reduce((a, b) =>
              distance2d(a.position, ref) <= distance2d(b.position, ref) ? a : b,
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
  }, [map, selectedTaskIds, spawn]);

  const route = useMemo(
    () => (spawn && stops.length > 0 ? optimizeRoute(spawn.position, stops) : null),
    [spawn, stops],
  );

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
    if (spawn) {
      out.push({ id: 'spawn', position: spawn.position, label: 'Spawn', kind: 'spawn' });
    }
    return out;
  }, [stops, route, spawn]);

  return (
    <div className="app">
      <Sidebar />
      <main>
        {map?.calibration ? (
          <>
            <div className="map-toolbar">
              <SpawnPicker map={map} />
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
          spawnPosition={spawn?.position ?? null}
          hasSelection={selectedTaskIds.length > 0}
        />
      )}
    </div>
  );
}
