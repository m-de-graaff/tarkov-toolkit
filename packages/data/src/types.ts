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

export interface MapLayer {
  /** display name, e.g. "2nd Floor" */
  name: string;
  /** matching svg group (data-layer attribute or id) */
  svgLayer?: string;
  /** per-floor tile pyramid url template */
  tileUrl?: string;
  /** per-floor walkability mask under apps/web/public/nav/ (tile-only maps) */
  navFile?: string;
  /** game y range this layer covers, [low, high] */
  heightRange?: [number, number];
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
  /** precomputed walkability mask under apps/web/public/nav/ for maps
   * without an SVG (generated from the tile pyramid at snapshot time) */
  navFile?: string;
  /** base (ground) svg layer group when the svg is multi-level */
  svgLayer?: string;
  /** game y range of the base layer */
  heightRange?: [number, number];
  /** additional floors/levels above or below the base layer */
  layers?: MapLayer[];
}

export interface RpSpawn {
  position: GamePosition;
  sides: string[];
  categories: string[];
  zoneName: string;
}

export interface RpExtract {
  id: string;
  name: string;
  /** 'pmc' | 'shared' | 'scav' */
  faction: string;
  position: GamePosition;
  /** switch-gated / not always open */
  conditional: boolean;
}

export interface RpMap {
  id: string;
  name: string;
  normalizedName: string;
  /** BSG's internal location id - appears in game logs (e.g. "Sandbox") */
  nameId?: string;
  /** scene bundle path - appears in game logs while a map loads */
  scenePath?: string;
  /** nameIds of merged variants (e.g. night factory) for log-based detection */
  altNameIds?: string[];
  wiki?: string;
  /** absent => not renderable in v1 (tile-based or virtual map) */
  calibration?: MapCalibration;
  spawns: RpSpawn[];
  extracts: RpExtract[];
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
  /** API id, or "wiki-<slug>" for quests synthesized from the wiki catalog */
  id: string;
  name: string;
  normalizedName: string;
  /** true when the quest exists on the wiki but tarkov.dev does not serve it
   * yet; such tasks vanish automatically once the API catches up */
  wikiOnly?: boolean;
  /** which game modes this quest exists in */
  modes: GameMode[];
  trader: { id: string; name: string };
  /** task.map from the API: quest is locked to this map */
  mapId: string | null;
  minPlayerLevel: number;
  factionName: string;
  kappaRequired: boolean;
  wikiLink?: string;
  /** pre-rename title (game patches rename quests; data sources lag) */
  formerName?: string;
  experience: number;
  taskRequirements: RpTaskRequirement[];
  objectives: RpObjective[];
}

export interface AmmoRound {
  id: string;
  name: string;
  shortName: string;
  iconLink?: string;
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
  /** crafts: tools are used but returned - never part of the cost */
  tool?: boolean;
}

export interface RpBarter {
  id: string;
  traderName: string;
  traderLevel: number;
  taskLocked: boolean;
  buyLimit: number;
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
