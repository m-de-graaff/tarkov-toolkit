import type { GamePosition, RpMap } from '@raidplanner/data';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { boundsToLatLng, gameToLatLng, makeCrs } from '../lib/tarkovCrs';
import type { PlannedRoute } from '../lib/route';

export interface MapMarker {
  id: string;
  position: GamePosition;
  label: string;
  kind: 'objective' | 'spawn' | 'player' | 'extract';
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

export function MapCanvas({ map, markers, route, onMapClick }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const clickHandlerRef = useRef(onMapClick);
  clickHandlerRef.current = onMapClick;

  const cal = map.calibration;

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
      if (cal.svgFile) L.imageOverlay(`/maps/${cal.svgFile}`, bounds).addTo(lMap);
    };
    if (cal.tiles) {
      // Pretty baked-3D render from assets.tarkov.dev; if tiles fail to load
      // (offline), swap once to the bundled SVG fallback.
      const tileLayer = L.tileLayer(cal.tiles.url, {
        tileSize: cal.tiles.tileSize,
        minNativeZoom: cal.tiles.minZoom,
        maxNativeZoom: cal.tiles.maxZoom,
        bounds,
        className: 'map-tiles',
        keepBuffer: 2,
      });
      let fellBack = false;
      tileLayer.on('tileerror', () => {
        if (fellBack || !cal.svgFile) return;
        fellBack = true;
        lMap.removeLayer(tileLayer);
        addSvgOverlay();
      });
      tileLayer.addTo(lMap);
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
      lMap.remove();
    };
  }, [map.id, cal]);

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

    if (route && (route.stops.length > 0 || markers.some((m) => m.kind === 'extract'))) {
      const origin = markers.find((m) => m.kind === 'player') ?? markers.find((m) => m.kind === 'spawn');
      const extract = markers.find((m) => m.kind === 'extract');
      const points = [
        ...(origin ? [gameToLatLng(origin.position)] : []),
        ...route.stops.map((s) => gameToLatLng(s.position)),
        ...(extract ? [gameToLatLng(extract.position)] : []),
      ];
      if (points.length > 1) {
        L.polyline(points, { color: ROUTE_COLOR, weight: 2, dashArray: '6 4' }).addTo(layer);
      }
    }
  }, [markers, route, map.id]);

  return (
    <div
      ref={containerRef}
      className="map-canvas"
      role="application"
      aria-label={`Interactive map of ${map.name}`}
    />
  );
}
