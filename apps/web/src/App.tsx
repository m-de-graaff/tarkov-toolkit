import { snapshot } from '@raidplanner/data';
import { useMemo } from 'react';
import type { MapMarker } from './components/MapCanvas';
import { MapCanvas } from './components/MapCanvas';
import { Sidebar } from './components/Sidebar';
import { distance2d } from './lib/geometry';
import { objectivePoints } from './lib/questIndex';
import { usePlanner } from './store';

export function App() {
  const selectedMapId = usePlanner((s) => s.selectedMapId);
  const selectedTaskIds = usePlanner((s) => s.selectedTaskIds);
  const spawn = usePlanner((s) => s.spawn);

  const map = snapshot.maps.find((m) => m.id === selectedMapId);

  // One marker per objective: its point nearest the spawn (first point when no
  // spawn is set yet).
  const markers = useMemo(() => {
    if (!map) return [];
    const out: MapMarker[] = [];
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
          id: objective.id,
          position: point.position,
          label: objective.description,
          kind: 'objective',
          taskName: task.name,
        });
      }
    }
    if (spawn) {
      out.push({ id: 'spawn', position: spawn.position, label: 'Spawn', kind: 'spawn' });
    }
    return out;
  }, [map, selectedTaskIds, spawn]);

  return (
    <div className="app">
      <Sidebar />
      <main>
        {map?.calibration ? (
          <MapCanvas map={map} markers={markers} route={null} />
        ) : (
          <div className="map-placeholder">
            {map
              ? 'No offline map is available for this location yet.'
              : 'Select a map to begin planning.'}
          </div>
        )}
      </main>
    </div>
  );
}
