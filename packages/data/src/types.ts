export interface GamePosition {
  x: number;
  y: number;
  z: number;
}

export interface MapTiles {
  /** {z}/{x}/{y} URL template on assets.tarkov.dev (runtime network dependency) */
  url: string;
  tileSize: number;
  minZoom: number;
  maxZoom: number;
}

export interface MapCalibration {
  transform: [number, number, number, number];
  coordinateRotation: number;
  bounds: [[number, number], [number, number]];
  svgBounds?: [[number, number], [number, number]];
  /** bundled offline fallback under apps/web/public/maps/, e.g. "customs.svg" */
  svgFile?: string;
  /** pretty baked-3D tile render (preferred base layer when online) */
  tiles?: MapTiles;
}

export interface RpSpawn {
  position: GamePosition;
  sides: string[];
  categories: string[];
  zoneName: string;
}

export interface RpMap {
  id: string;
  name: string;
  normalizedName: string;
  wiki?: string;
  /** absent => not renderable in v1 (tile-based or virtual map) */
  calibration?: MapCalibration;
  spawns: RpSpawn[];
}

export interface RpZone {
  id: string;
  map: string;
  position: GamePosition;
}

export interface RpObjective {
  id: string;
  type: string;
  description: string;
  optional: boolean;
  /** map ids where this objective can be done; [] = anywhere */
  maps: string[];
  /** exact locations, merged from zones[] and possibleLocations[] */
  points: RpZone[];
  count?: number;
}

export interface RpTaskRequirement {
  taskId: string;
  status: string[];
}

export type GameMode = 'pvp' | 'pve';

export interface RpTask {
  id: string;
  name: string;
  normalizedName: string;
  /** which game modes this quest exists in */
  modes: GameMode[];
  trader: { id: string; name: string };
  /** task.map from the API: quest is locked to this map */
  mapId: string | null;
  minPlayerLevel: number;
  factionName: string;
  kappaRequired: boolean;
  wikiLink?: string;
  experience: number;
  taskRequirements: RpTaskRequirement[];
  objectives: RpObjective[];
}

export interface Snapshot {
  generatedAt: string;
  gameMode: 'regular';
  maps: RpMap[];
  tasks: RpTask[];
}
