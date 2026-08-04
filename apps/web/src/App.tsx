import { snapshot } from '@raidplanner/data';
import type { MapMarker } from './components/MapCanvas';
import { MapCanvas } from './components/MapCanvas';
import { objectivePoints } from './lib/questIndex';

// Temporary Task 8 harness: customs with the first located quest's objectives.
export function App() {
  const customs = snapshot.maps.find((m) => m.normalizedName === 'customs')!;
  const sampleTask = snapshot.tasks.find(
    (t) => objectivePoints(t, customs.id).length > 0,
  )!;

  const markers: MapMarker[] = objectivePoints(sampleTask, customs.id).flatMap(
    ({ objective, points }) =>
      points.slice(0, 3).map((p) => ({
        id: p.id,
        position: p.position,
        label: objective.description,
        kind: 'objective' as const,
        taskName: sampleTask.name,
      })),
  );

  return (
    <div className="app">
      <MapCanvas map={customs} markers={markers} route={null} />
    </div>
  );
}
