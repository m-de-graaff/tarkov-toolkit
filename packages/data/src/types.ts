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
  /** BSG's internal location id — appears in game logs (e.g. "Sandbox") */
  nameId?: string;
  /** scene bundle path — appears in game logs while a map loads */
  scenePath?: string;
  /** nameIds of merged variants (e.g. night factory) for log-based detection */
  altNameIds?: string[];
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
  /** flea/trader items this objective consumes (give/find/plant hand-ins) */
  neededItems?: NeededItems;
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

export interface AmmoRound {
  id: string;
  name: string;
  shortName: string;
  /** caliber without the "Caliber" prefix, e.g. "556x45NATO" */
  caliber: string;
  damage: number;
  penetrationPower: number;
  armorDamage: number;
  fragmentationChance: number;
  initialSpeed: number;
  tracer: boolean;
  projectileCount: number;
}

export interface ItemLite {
  name: string;
  shortName: string;
  iconLink?: string;
}

export interface HideoutRequirementItem {
  itemId: string;
  count: number;
  foundInRaid: boolean;
}

export interface HideoutLevel {
  level: number;
  constructionTime: number;
  itemRequirements: HideoutRequirementItem[];
  stationLevelRequirements: { stationId: string; level: number }[];
  traderRequirements: { traderName: string; level: number }[];
}

export interface HideoutStation {
  id: string;
  name: string;
  normalizedName: string;
  levels: HideoutLevel[];
}

export interface TradeItemStack {
  itemId: string;
  count: number;
}

export interface RpBarter {
  id: string;
  traderName: string;
  traderLevel: number;
  requiredItems: TradeItemStack[];
  rewardItems: TradeItemStack[];
}

export interface RpCraft {
  id: string;
  stationId: string;
  stationLevel: number;
  durationSeconds: number;
  requiredItems: TradeItemStack[];
  rewardItems: TradeItemStack[];
}

export interface NeededItems {
  /** any one of these satisfies the objective (multi-choice hand-ins) */
  itemIds: string[];
  count: number;
  foundInRaid: boolean;
}

export interface Snapshot {
  generatedAt: string;
  gameMode: 'regular';
  maps: RpMap[];
  tasks: RpTask[];
  ammo: AmmoRound[];
  hideout: HideoutStation[];
  barters: RpBarter[];
  crafts: RpCraft[];
  /** names/icons for every item id referenced by quests, hideout, barters, crafts */
  itemsLite: Record<string, ItemLite>;
  /** trader id -> display name */
  traders: Record<string, string>;
}
