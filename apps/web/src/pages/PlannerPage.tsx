import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { snapshot } from '@raidplanner/data';
import { useMemo } from 'react';
import type { Layout } from 'react-resizable-panels';
import { LivePanel } from '../components/LivePanel';
import type { MapMarker } from '../components/MapCanvas';
import { MapCanvas } from '../components/MapCanvas';
import { RecommendBanner } from '../components/RecommendBanner';
import { RoutePanel } from '../components/RoutePanel';
import { Sidebar } from '../components/Sidebar';
import { distance2d } from '../lib/geometry';
import { objectivePoints } from '../lib/questIndex';
import type { RouteStop } from '../lib/route';
import { optimizeRoute } from '../lib/route';
import { useLiveWatcher } from '../lib/useLiveWatcher';
import { useMediaQuery } from '../lib/useMediaQuery';
import { useNavGrid } from '../lib/useNavGrid';
import { routingSupported } from '../lib/routingSupport';
import { usePlanner } from '../store';

const LAYOUT_KEY = 'raidplanner-layout';
const AUTO_EXTRACT = '__auto__';

function loadSavedLayout(): Layout | undefined {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? (JSON.parse(raw) as Layout) : undefined;
  } catch {
    return undefined;
  }
}

export function PlannerPage() {
  const selectedMapId = usePlanner((s) => s.selectedMapId);
  const selectedTaskIds = usePlanner((s) => s.selectedTaskIds);
  const spawn = usePlanner((s) => s.spawn);
  const setSpawn = usePlanner((s) => s.setSpawn);
  const liveFix = usePlanner((s) => s.liveFix);
  const spawnOverridesLive = usePlanner((s) => s.spawnOverridesLive);
  const setTargetExtract = usePlanner((s) => s.setTargetExtract);
  const watcher = useLiveWatcher();

  const map = snapshot.maps.find((m) => m.id === selectedMapId);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const navigator = useNavGrid(map);
  const canRoute = routingSupported(map);

  // named PMC spawn zones: the keyboard/screen-reader path to what a map
  // click does (WCAG 2.5.7 - a pointer gesture needs an alternative)
  const spawnZones = useMemo(() => {
    const byZone = new Map<string, (typeof snapshot.maps)[number]['spawns'][number]>();
    for (const s of map?.spawns ?? []) {
      if (!s.categories.includes('player')) continue;
      if (!s.sides.includes('pmc') && !s.sides.includes('all')) continue;
      if (s.zoneName && !byZone.has(s.zoneName)) byZone.set(s.zoneName, s);
    }
    return [...byZone.values()].sort((a, b) => a.zoneName.localeCompare(b.zoneName));
  }, [map]);

  // The route starts from where you actually are (live fix) when live mode has
  // one, otherwise from the chosen spawn. A map click outranks the fix until
  // the next screenshot so you can plan ahead of your current position.
  const spawnWins = spawn !== null && (spawnOverridesLive || !liveFix);
  const routeOrigin = (spawnWins ? spawn?.position : liveFix?.position ?? spawn?.position) ?? null;

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
          neededItems: objective.neededItems,
        });
      }
    }
    return out;
  }, [map, selectedTaskIds, routeOrigin]);

  // Extract choice: explicit pick wins; auto = the farthest always-open
  // PMC/shared exfil from where you start (Tarkov puts exfils opposite spawns).
  const targetExtractId = usePlanner((s) => s.targetExtractId);
  const extracts = useMemo(
    () => (map?.extracts ?? []).filter((e) => e.faction === 'pmc' || e.faction === 'shared'),
    [map],
  );
  const chosenExtract = useMemo(() => {
    if (targetExtractId) return extracts.find((e) => e.id === targetExtractId) ?? null;
    if (!routeOrigin || extracts.length === 0) return null;
    const candidates = extracts.some((e) => !e.conditional)
      ? extracts.filter((e) => !e.conditional)
      : extracts;
    return candidates.reduce((a, b) =>
      distance2d(a.position, routeOrigin) >= distance2d(b.position, routeOrigin) ? a : b,
    );
  }, [targetExtractId, extracts, routeOrigin]);

  const route = useMemo(
    () =>
      routeOrigin && (stops.length > 0 || chosenExtract)
        ? optimizeRoute(routeOrigin, stops, chosenExtract?.position, navigator)
        : null,
    [routeOrigin, stops, chosenExtract, navigator],
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
    if (spawn && spawnWins) {
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
    if (chosenExtract && routeOrigin) {
      out.push({
        id: `extract-${chosenExtract.id}`,
        position: chosenExtract.position,
        label: `Extract: ${chosenExtract.name}${chosenExtract.conditional ? ' (conditional)' : ''}`,
        kind: 'extract',
      });
    }
    return out;
  }, [stops, route, spawn, liveFix, chosenExtract, routeOrigin]);

  const mapArea = map?.calibration ? (
    <>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b bg-card px-4 py-2">
        {routeOrigin === null ? (
          <span className="text-xs text-muted-foreground">
            Click the map where you spawn, or take a screenshot in raid
          </span>
        ) : spawn && spawnWins ? (
          <button
            type="button"
            className="rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-input hover:text-foreground"
            title={
              liveFix
                ? 'Return the route origin to your live position'
                : 'Remove the spawn point you placed'
            }
            onClick={() => setSpawn(null)}
          >
            {liveFix ? 'Manual origin · back to live' : 'Spawn set · clear'}
          </button>
        ) : null}
        {spawnZones.length > 0 && !liveFix && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Spawn</span>
            <Select
              value={spawn?.kind === 'zone' ? spawn.zoneName : ''}
              onValueChange={(zoneName) => {
                const zone = spawnZones.find((z) => z.zoneName === zoneName);
                if (zone) setSpawn({ kind: 'zone', zoneName: zone.zoneName, position: zone.position });
              }}
            >
              <SelectTrigger className="h-7 max-w-52 text-xs" aria-label="Spawn point">
                <SelectValue
                  placeholder={spawn?.kind === 'custom' ? 'Custom (map click)' : 'Choose...'}
                />
              </SelectTrigger>
              <SelectContent>
                {spawnZones.map((z) => (
                  <SelectItem key={z.zoneName} value={z.zoneName}>
                    {z.zoneName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        {extracts.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Extract</span>
            <Select
              value={targetExtractId ?? AUTO_EXTRACT}
              onValueChange={(v) => setTargetExtract(v === AUTO_EXTRACT ? null : v)}
            >
              <SelectTrigger className="h-7 max-w-52 text-xs" aria-label="Target extract">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO_EXTRACT}>
                  Auto{!targetExtractId && chosenExtract ? ` (${chosenExtract.name})` : ''}
                </SelectItem>
                {extracts.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                    {e.conditional ? ' · conditional' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        <div className="h-5 w-px bg-border" aria-hidden="true" />
        <LivePanel watcher={watcher} outOfBounds={outOfBounds} />
        <div className="ml-auto">
          <RecommendBanner />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <MapCanvas
          map={map}
          markers={markers}
          route={canRoute ? route : null}
          onMapClick={(p) => setSpawn({ kind: 'custom', position: p })}
        />
      </div>
    </>
  ) : (
    <div className="flex h-full items-center justify-center px-6 text-center text-lg text-muted-foreground">
      {map
        ? 'No offline map is available for this location yet.'
        : 'Select a map to begin planning.'}
    </div>
  );

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">{mapArea}</main>
        {map?.calibration && selectedTaskIds.length > 0 && (
          <details className="shrink-0 border-t bg-card">
            <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold text-primary tabular-nums">
              Route{route && canRoute ? ` · ≈ ${Math.round(route.totalDistance)}m` : ''}
            </summary>
            <div className="max-h-[40dvh] overflow-y-auto">
              <RoutePanel
                route={route}
                originPosition={routeOrigin}
                originLabel={liveFix && !spawnWins ? 'live position' : 'spawn'}
                hasSelection={selectedTaskIds.length > 0}
                extract={chosenExtract}
                routingSupported={canRoute}
              />
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1">
      <ResizablePanelGroup
        orientation="horizontal"
        defaultLayout={loadSavedLayout()}
        onLayoutChanged={(layout) => {
          try {
            localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
          } catch {
            /* storage unavailable - layout just won't persist */
          }
        }}
        className="h-full"
      >
        <ResizablePanel defaultSize={340} minSize={260} maxSize={560} className="min-w-0">
          <Sidebar />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel className="min-w-0">
          <div className="flex h-full min-w-0">
            <main className="relative flex min-w-0 flex-1 flex-col">{mapArea}</main>
            {map?.calibration && (
              <div className="w-72 shrink-0 border-l">
                <RoutePanel
                  route={route}
                  originPosition={routeOrigin}
                  originLabel={liveFix && !spawnWins ? 'live position' : 'spawn'}
                  hasSelection={selectedTaskIds.length > 0}
                  extract={chosenExtract}
                  routingSupported={canRoute}
                />
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
