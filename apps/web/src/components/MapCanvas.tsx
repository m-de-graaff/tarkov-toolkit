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
  kind: 'objective' | 'spawn';
  orderIndex?: number;
  taskName?: string;
}

export interface MapCanvasProps {
  /** must have calibration — the caller guards */
  map: RpMap;
  markers: MapMarker[];
  route: PlannedRoute | null;
  onMapClick?: (p: GamePosition) => void;
}

const ROUTE_COLOR = '#d4bb70';

function markerIcon(marker: MapMarker): L.DivIcon {
  const text = marker.kind === 'spawn' ? 'S' : marker.orderIndex != null ? String(marker.orderIndex + 1) : '•';
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
      maxZoom: 4,
      zoomSnap: 0.25,
      attributionControl: false,
    });
    const bounds = L.latLngBounds(boundsToLatLng(cal.svgBounds ?? cal.bounds));
    L.imageOverlay(`/maps/${cal.svgFile}`, bounds).addTo(lMap);
    lMap.fitBounds(bounds);
    lMap.on('click', (e: L.LeafletMouseEvent) => {
      clickHandlerRef.current?.({ x: e.latlng.lng, y: 0, z: e.latlng.lat });
    });

    leafletRef.current = lMap;
    overlayLayerRef.current = L.layerGroup().addTo(lMap);
    return () => {
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
      const m = L.marker(gameToLatLng(marker.position), { icon: markerIcon(marker) });
      const tooltip = marker.taskName ? `${marker.taskName} — ${marker.label}` : marker.label;
      m.bindTooltip(tooltip, { direction: 'top', offset: L.point(0, -10) });
      m.addTo(layer);
    }

    if (route && route.stops.length > 0) {
      const spawn = markers.find((m) => m.kind === 'spawn');
      const points = [
        ...(spawn ? [gameToLatLng(spawn.position)] : []),
        ...route.stops.map((s) => gameToLatLng(s.position)),
      ];
      L.polyline(points, { color: ROUTE_COLOR, weight: 2, dashArray: '6 4' }).addTo(layer);
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
