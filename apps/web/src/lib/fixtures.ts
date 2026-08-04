// Hand-built mini snapshot for unit tests: 2 maps, 5 tasks covering each
// map-relation kind and the availability rules.
import type { RpTask, Snapshot } from '@raidplanner/data';

const at = (x: number, z: number) => ({ x, y: 0, z });

const baseTask: Omit<RpTask, 'id' | 'name' | 'normalizedName' | 'objectives'> = {
  modes: ['pvp', 'pve'],
  trader: { id: 'trader-1', name: 'Prapor' },
  mapId: null,
  minPlayerLevel: 1,
  factionName: 'Any',
  kappaRequired: false,
  experience: 1000,
  taskRequirements: [],
};

export const tLocked: RpTask = {
  ...baseTask,
  id: 't-locked',
  name: 'Locked to A',
  normalizedName: 'locked-to-a',
  mapId: 'map-a',
  objectives: [
    {
      id: 'o-locked-1',
      type: 'visit',
      description: 'Visit the spot',
      optional: false,
      maps: ['map-a'],
      points: [{ id: 'z1', map: 'map-a', position: at(10, 10) }],
    },
  ],
};

export const tMulti: RpTask = {
  ...baseTask,
  id: 't-multi',
  name: 'Multi Map',
  normalizedName: 'multi-map',
  objectives: [
    {
      id: 'o-multi-1',
      type: 'mark',
      description: 'Mark the truck',
      optional: false,
      maps: ['map-a', 'map-b'],
      points: [
        { id: 'z2', map: 'map-a', position: at(20, 30) },
        { id: 'z3', map: 'map-b', position: at(-5, 40) },
      ],
    },
  ],
};

export const tAnywhere: RpTask = {
  ...baseTask,
  id: 't-anywhere',
  name: 'Anywhere Quest',
  normalizedName: 'anywhere-quest',
  objectives: [
    {
      id: 'o-any-1',
      type: 'giveItem',
      description: 'Hand over 3 salewas',
      optional: false,
      maps: [],
      points: [],
      count: 3,
    },
  ],
};

export const tHighLevel: RpTask = {
  ...baseTask,
  id: 't-high-level',
  name: 'Locked to B, level 20',
  normalizedName: 'locked-to-b',
  mapId: 'map-b',
  minPlayerLevel: 20,
  objectives: [
    {
      id: 'o-high-1',
      type: 'visit',
      description: 'Reach the office',
      optional: false,
      maps: ['map-b'],
      points: [{ id: 'z4', map: 'map-b', position: at(0, 0) }],
    },
  ],
};

export const tRequiresLocked: RpTask = {
  ...baseTask,
  id: 't-req',
  name: 'USEC Follow-up',
  normalizedName: 'usec-follow-up',
  factionName: 'USEC',
  taskRequirements: [{ taskId: 't-locked', status: ['complete'] }],
  objectives: [
    {
      id: 'o-req-1',
      type: 'shoot',
      description: 'Eliminate targets on A',
      optional: false,
      maps: ['map-a'],
      points: [],
    },
  ],
};

export const fixtureSnapshot: Snapshot = {
  generatedAt: '2026-08-04T00:00:00.000Z',
  gameMode: 'regular',
  ammo: [],
  hideout: [],
  barters: [],
  crafts: [],
  itemsLite: {
    'item-bolts': { name: 'Pack of bolts', shortName: 'Bolts' },
    'item-wires': { name: 'Bundle of wires', shortName: 'Wires' },
    'item-alt': { name: 'Alternative item', shortName: 'Alt' },
  },
  maps: [
    {
      id: 'map-a',
      name: 'Alpha',
      normalizedName: 'alpha',
      calibration: {
        transform: [1, 0, 1, 0],
        coordinateRotation: 180,
        bounds: [
          [100, -100],
          [-100, 100],
        ],
        svgFile: 'alpha.svg',
      },
      spawns: [
        {
          position: at(-90, -90),
          sides: ['pmc', 'all'],
          categories: ['player'],
          zoneName: 'Alpha PMC West',
        },
      ],
    },
    {
      id: 'map-b',
      name: 'Bravo',
      normalizedName: 'bravo',
      calibration: {
        transform: [0.5, 0, 0.5, 0],
        coordinateRotation: 0,
        bounds: [
          [50, -50],
          [-50, 50],
        ],
        svgFile: 'bravo.svg',
      },
      spawns: [],
    },
  ],
  tasks: [tLocked, tMulti, tAnywhere, tHighLevel, tRequiresLocked],
};
