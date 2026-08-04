export interface GamePosition {
  x: number;
  y: number;
  z: number;
}

export interface MapCalibration {
  transform: [number, number, number, number];
  coordinateRotation: number;
  bounds: [[number, number], [number, number]];
  svgBounds?: [[number, number], [number, number]];
  /** filename under apps/web/public/maps/, e.g. "customs.svg" */
  svgFile: string;
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

export interface RpTask {
  id: string;
  name: string;
  normalizedName: string;
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
