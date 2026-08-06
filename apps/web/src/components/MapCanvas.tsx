import { cn } from '@/lib/utils';
import type { GamePosition, MapLayer, RpMap } from '@raidplanner/data';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { boundsToLatLng, gameToLatLng, makeCrs } from '../lib/tarkovCrs';
import type { PlannedRoute } from '../lib/route';
import { layerDisplayUrl } from '../lib/svgNav';

export interface MapMarker {
  id: string;
  position: GamePosition;
  label: string;
  kind: 'objective' | 'spawn' | 'player' | 'extract' | 'transit';
  orderIndex?: number;
  taskName?: string;
  /** heading in degrees for kind 'player' (map rotation added at render) */
  yawDeg?: number;
}

export interface MapCanvasProps {
  /** must have calibration - the caller guards */
  map: RpMap;
  markers: MapMarker[];
  route: PlannedRoute | null;
  onMapClick?: (p: GamePosition) => void;
}

const ROUTE_COLOR = '#d4bb70';

function markerIcon(marker: MapMarker, mapRotation: number): L.DivIcon {
  if (marker.kind === 'player') {
    const heading = (marker.yawDeg ?? 0) + mapRotation;
    return L.divIcon({
      className: '',
      html:
        `<div class="marker player" style="transform: rotate(${heading}deg)">` +
        `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">` +
        `<path d="M2 2 L14 8 L2 14 L5 8 Z" fill="currentColor"/></svg></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }
  const text =
    marker.kind === 'spawn'
      ? 'S'
      : marker.kind === 'extract'
        ? 'EX'
        : marker.kind === 'transit'
          ? 'TR'
          : marker.orderIndex != null
            ? String(marker.orderIndex + 1)
            : '•';
  return L.divIcon({
    className: '',
    html: `<div class="marker ${marker.kind}">${text}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/** Floors sorted for a vertical control: highest on top, tunnels at the bottom. */
function sortedFloors(cal: RpMap['calibration']): (MapLayer | null)[] {
  if (!cal?.layers?.length) return [];
  const usable = cal.layers.filter((l) => l.tileUrl || (cal.svgFile && l.svgLayer));
  if (usable.length === 0) return [];
  const entries: { layer: MapLayer | null; low: number }[] = [
    { layer: null, low: cal.heightRange?.[0] ?? 0 },
    ...usable.map((layer) => ({ layer, low: layer.heightRange?.[0] ?? 0 })),
  ];
  return entries.sort((a, b) => b.low - a.low).map((e) => e.layer);
}

export function MapCanvas({ map, markers, route, onMapClick }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const baseSvgOverlayRef = useRef<L.ImageOverlay | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const floorLayerRef = useRef<L.Layer | null>(null);
  const clickHandlerRef = useRef(onMapClick);
  clickHandlerRef.current = onMapClick;
  const [floor, setFloor] = useState<string | null>(null);

  const cal = map.calibration;
  const floors = useMemo(() => sortedFloors(cal), [cal]);

  // The leaflet map is external, imperative state: create it per map id (a CRS
  // cannot be swapped on a live instance) and tear it down on unmount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !cal) return;

    const lMap = L.map(el, {
      crs: makeCrs(cal),
      minZoom: -2,
      maxZoom: cal.tiles ? cal.tiles.maxZoom : 4,
      zoomSnap: 0.25,
      attributionControl: false,
    });
    const bounds = L.latLngBounds(boundsToLatLng(cal.svgBounds ?? cal.bounds));

    const addSvgOverlay = () => {
      if (cal.svgFile) {
        baseSvgOverlayRef.current = L.imageOverlay(`/maps/${cal.svgFile}`, bounds).addTo(lMap);
      }
    };
    if (cal.tiles) {
      // Pretty baked-3D render from assets.tarkov.dev. No bounds option: the
      // pyramids serve transparent tiles outside the drawn area, and a bounds
      // rect can wrongly exclude real tiles (Customs rendered nothing).
      const tileLayer = L.tileLayer(cal.tiles.url, {
        tileSize: cal.tiles.tileSize,
        minZoom: -2,
        minNativeZoom: cal.tiles.minZoom,
        maxNativeZoom: cal.tiles.maxZoom,
        className: 'map-tiles',
        keepBuffer: 2,
      });
      // Only fall back to the bundled SVG when the tile source is genuinely
      // unreachable (offline): several errors and not a single loaded tile.
      let loaded = 0;
      let errors = 0;
      let fellBack = false;
      tileLayer.on('tileload', () => {
        loaded++;
      });
      tileLayer.on('tileerror', () => {
        errors++;
        if (fellBack || !cal.svgFile || loaded > 0 || errors < 6) return;
        fellBack = true;
        lMap.removeLayer(tileLayer);
        addSvgOverlay();
      });
      tileLayer.addTo(lMap);
      baseTileLayerRef.current = tileLayer;
    } else {
      addSvgOverlay();
    }
    lMap.fitBounds(bounds);
    lMap.on('click', (e: L.LeafletMouseEvent) => {
      clickHandlerRef.current?.({ x: e.latlng.lng, y: 0, z: e.latlng.lat });
    });

    leafletRef.current = lMap;
    overlayLayerRef.current = L.layerGroup().addTo(lMap);

    // Track container resizes (draggable sidebar, orientation change) so
    // leaflet recomputes its viewport.
    const resizeObserver = new ResizeObserver(() => lMap.invalidateSize());
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      leafletRef.current = null;
      overlayLayerRef.current = null;
      baseSvgOverlayRef.current = null;
      baseTileLayerRef.current = null;
      floorLayerRef.current = null;
      lMap.remove();
    };
  }, [map.id, cal]);

  // A different map means back to ground level.
  useEffect(() => setFloor(null), [map.id]);

  // Swap the visible floor: per-floor tile pyramid where one exists,
  // otherwise a per-layer SVG image (replacing the fallback base image, or
  // stacked on top of the base tiles). While a floor is active the ground
  // imagery dims to a faint backdrop - previously both rendered at full
  // strength on top of each other and the active floor was hard to read.
  useEffect(() => {
    const lMap = leafletRef.current;
    if (!lMap || !cal) return;
    floorLayerRef.current?.remove();
    floorLayerRef.current = null;
    baseSvgOverlayRef.current?.setUrl(`/maps/${cal.svgFile}`);
    const dimBase = (dimmed: boolean) => {
      baseTileLayerRef.current?.setOpacity(dimmed ? 0.2 : 1);
      baseSvgOverlayRef.current?.setOpacity(dimmed ? 0.2 : 1);
    };
    if (!floor) {
      dimBase(false);
      return;
    }
    const layer = cal.layers?.find((l) => l.name === floor);
    if (!layer) {
      dimBase(false);
      return;
    }

    const bounds = L.latLngBounds(boundsToLatLng(cal.svgBounds ?? cal.bounds));
    if (cal.tiles && layer.tileUrl) {
      dimBase(true);
      floorLayerRef.current = L.tileLayer(layer.tileUrl, {
        tileSize: cal.tiles.tileSize,
        minNativeZoom: cal.tiles.minZoom,
        maxNativeZoom: cal.tiles.maxZoom,
        bounds,
        className: 'map-tiles',
        keepBuffer: 2,
      }).addTo(lMap);
      return;
    }
    if (!cal.svgFile || !layer.svgLayer) {
      dimBase(false);
      return;
    }
    const mode = cal.tiles ? 'overlay' : 'fallback';
    let cancelled = false;
    void layerDisplayUrl(cal, layer.svgLayer, mode).then((url) => {
      if (cancelled || !url || leafletRef.current !== lMap) return;
      if (mode === 'fallback') {
        // the floor image replaces the base outright - no dimming needed
        baseSvgOverlayRef.current?.setUrl(url);
      } else {
        dimBase(true);
        floorLayerRef.current = L.imageOverlay(url, bounds).addTo(lMap);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [floor, map.id, cal]);

  // Redraw markers and the route polyline whenever they change.
  useEffect(() => {
    const layer = overlayLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    for (const marker of markers) {
      const m = L.marker(gameToLatLng(marker.position), {
        icon: markerIcon(marker, cal?.coordinateRotation ?? 0),
      });
      const tooltip = marker.taskName ? `${marker.taskName} - ${marker.label}` : marker.label;
      m.bindTooltip(tooltip, { direction: 'top', offset: L.point(0, -10) });
      m.addTo(layer);
    }

    // Each leg carries its walkable polyline; straight-line fallbacks and the
    // gap hops inside mixed legs render dashed to signal as-the-crow-flies.
    if (route) {
      const draw = (points: GamePosition[], direct: boolean) => {
        if (points.length < 2) return;
        L.polyline(points.map(gameToLatLng), {
          color: ROUTE_COLOR,
          weight: direct ? 2 : 2.5,
          ...(direct ? { dashArray: '6 4' } : {}),
        }).addTo(layer);
      };
      for (const leg of route.legs) {
        if (leg.segments) for (const s of leg.segments) draw(s.points, s.direct);
        else draw(leg.points, leg.direct);
      }
    }
  }, [markers, route, map.id]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="map-canvas"
        role="application"
        aria-label={`Interactive map of ${map.name}`}
      />
      {floors.length > 0 && (
        <div
          role="group"
          aria-label="Floor"
          className="absolute right-2 top-2 z-[1000] flex flex-col overflow-hidden rounded-md border bg-card/95 shadow-sm"
        >
          {floors.map((layer) => {
            const name = layer?.name ?? 'Ground';
            const active = (layer?.name ?? null) === floor;
            return (
              <button
                key={name}
                type="button"
                aria-pressed={active}
                onClick={() => setFloor(layer?.name ?? null)}
                className={cn(
                  'px-2.5 py-1 text-left text-xs transition-colors not-last:border-b',
                  active
                    ? 'bg-primary font-medium text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
