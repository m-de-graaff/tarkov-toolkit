// Curated skill-leveling methods. Kept terse and practical; the Crafting
// skill is not listed here because the XP page computes it live from craft
// data and prices.

export type MethodCost = 'free' | 'cheap' | 'expensive';
export type MethodPace = 'passive' | 'slow' | 'steady' | 'fast';

export interface SkillMethod {
  title: string;
  detail: string;
  cost: MethodCost;
  pace: MethodPace;
}

export interface SkillGuide {
  id: string;
  name: string;
  gives: string;
  methods: SkillMethod[];
}

export const skillGuides: SkillGuide[] = [
  {
    id: 'metabolism',
    name: 'Metabolism',
    gives: 'Longer energy and hydration, faster physical skill gains, less chance of fractures at elite.',
    methods: [
      {
        title: 'Eat and drink in raid, in small portions',
        detail:
          'XP comes per point of energy and hydration restored. Split consumption: many small uses beat one big meal. Condensed milk plus an Aquamarine covers both bars cheaply.',
        cost: 'cheap',
        pace: 'steady',
      },
      {
        title: 'Deplete first, then refill',
        detail:
          'Sprint your energy and hydration down early in the raid, then eat and drink to full before extract. Restored points are what count.',
        cost: 'cheap',
        pace: 'steady',
      },
      {
        title: 'Hideout nutrition unit crafts',
        detail: 'Craft water and food in the hideout so raid consumption costs you nothing from the flea.',
        cost: 'free',
        pace: 'passive',
      },
    ],
  },
  {
    id: 'endurance',
    name: 'Endurance',
    gives: 'More stamina, quieter breathing, faster stamina regeneration.',
    methods: [
      {
        title: 'Sprint under 60 percent weight',
        detail:
          'Endurance levels while sprinting and while your stamina drains below the overweight threshold. Take a light kit, pick a long map like Shoreline or Woods, and keep moving.',
        cost: 'free',
        pace: 'steady',
      },
      {
        title: 'Hold breath while aiming',
        detail: 'Draining the breath bar while aiming also ticks Endurance. Combine with scoped weapons.',
        cost: 'free',
        pace: 'slow',
      },
    ],
  },
  {
    id: 'strength',
    name: 'Strength',
    gives: 'Higher carry weight, faster sprint, further throws, more melee damage.',
    methods: [
      {
        title: 'Run overweight, but below hard cap',
        detail:
          'Carry into the yellow weight zone and walk or sprint. Loot runs with a heavy backpack level it naturally.',
        cost: 'free',
        pace: 'steady',
      },
      {
        title: 'Throw grenades',
        detail: 'Every throw gives Strength XP. Cheap smokes work as well as frags.',
        cost: 'cheap',
        pace: 'fast',
      },
      {
        title: 'Melee swings on raiders and scavs you already killed',
        detail: 'Hatchet hits grant Strength XP. Swing at something safe, not at the air.',
        cost: 'free',
        pace: 'slow',
      },
    ],
  },
  {
    id: 'vitality',
    name: 'Vitality',
    gives: 'Less chance of bleeding, less HP lost on hits, at elite no more bleeding at all.',
    methods: [
      {
        title: 'Survive damage and bleeds',
        detail:
          'Vitality levels from taking damage and from active bleeds. Let a light bleed tick for a few seconds before bandaging when you are safe.',
        cost: 'free',
        pace: 'passive',
      },
    ],
  },
  {
    id: 'immunity',
    name: 'Immunity',
    gives: 'Weaker negative effects from stims and food poisoning, shorter pain.',
    methods: [
      {
        title: 'Stay on painkillers',
        detail: 'The on-painkillers status ticks Immunity. Cheap analgin painkillers are enough.',
        cost: 'cheap',
        pace: 'passive',
      },
    ],
  },
  {
    id: 'surgery',
    name: 'Surgery',
    gives: 'Less max-HP penalty after field surgery, faster surgery.',
    methods: [
      {
        title: 'Use a CMS kit on blacked limbs',
        detail:
          'Each surgery gives a chunk of XP. A safe routine: black a leg with a controlled fall at your hideout of choice in raid, then operate while hidden.',
        cost: 'cheap',
        pace: 'steady',
      },
    ],
  },
  {
    id: 'covert',
    name: 'Covert Movement',
    gives: 'Quieter movement on all surfaces.',
    methods: [
      {
        title: 'Crouch-walk on loud surfaces',
        detail: 'Gravel, glass, and metal floors tick the skill fastest. Interchange center is full of them.',
        cost: 'free',
        pace: 'slow',
      },
    ],
  },
  {
    id: 'attention',
    name: 'Attention',
    gives: 'Faster searching, better chance of finding rare loot at elite.',
    methods: [
      {
        title: 'Search every container',
        detail:
          'Each searched container gives XP even when empty. Loot runs through jacket and drawer spawns level it quickly.',
        cost: 'free',
        pace: 'steady',
      },
    ],
  },
  {
    id: 'intellect',
    name: 'Intellect',
    gives: 'Faster examining, better weapon repairs, faster crafting at elite.',
    methods: [
      {
        title: 'Examine everything you have not seen',
        detail: 'Every unexamined item is XP. Go through the whole handbook offline.',
        cost: 'free',
        pace: 'fast',
      },
      {
        title: 'Repair weapons with repair kits',
        detail: 'Repairs give steady Intellect XP and keep your guns cheap to run.',
        cost: 'cheap',
        pace: 'steady',
      },
    ],
  },
  {
    id: 'charisma',
    name: 'Charisma',
    gives: 'Better trader prices, cheaper insurance and post-raid healing.',
    methods: [
      {
        title: 'Level Intellect and Attention',
        detail: 'Charisma gains XP whenever those two do. It also ticks from buying and post-raid services.',
        cost: 'free',
        pace: 'passive',
      },
    ],
  },
  {
    id: 'hideout-management',
    name: 'Hideout Management',
    gives: 'Less fuel use, bigger boosts from hideout bonuses.',
    methods: [
      {
        title: 'Keep the generator on and crafts running',
        detail:
          'The skill ticks while consumables burn and crafts complete. Pair it with the cheap continuous crafts from the Crafting table below.',
        cost: 'cheap',
        pace: 'passive',
      },
    ],
  },
];
