// Curated skill-leveling routines, rebuilt Aug 2026 from the official wiki
// plus TarkovForge / timesaver.gg / Games Finder guides (EFT 1.0 era).
// Plan steps are written for at-a-glance reading; the exact numbers and
// mechanics live in `how`, `caps` and `cheese.detail`, which the UI collapses.
// The Crafting skill is not listed here because the XP page computes it live
// from craft data and prices. Recoil Control and Memory were removed from the
// game in 0.14.5 and are deliberately absent.

export type GuideCost = 'free' | 'cheap' | 'moderate' | 'expensive';

/** When during play a step happens; shown as a chip in front of the step. */
export type StepWhen =
  | 'Start'
  | 'Mid raid'
  | 'Extract'
  | 'Every raid'
  | 'Duo'
  | 'Hideout'
  | 'Daily';

export interface PlanStep {
  when: StepWhen;
  /** one short line, glanceable */
  text: string;
}

export interface SkillCheese {
  /** short enough to read at a glance */
  title: string;
  /** the full safe instructions, shown under Details */
  detail: string;
}

export interface SkillGuide {
  id: string;
  name: string;
  /** what the skill gives you, one line (under Details) */
  gives: string;
  /** how XP is actually earned, one line (under Details) */
  how: string;
  /** the easy proven routine, in order - short lines only */
  plan: PlanStep[];
  cheese?: SkillCheese;
  /** fatigue / cap warnings (under Details) */
  caps?: string;
  cost: GuideCost;
}

/** Page-level rules that apply to every skill below. */
export const skillGlobalNotes: string[] = [
  'Fatigue: about 2-3 points per skill per raid, then gains crater. A 200 second pause resets the rate.',
  'Air Filtering Unit + FP-100 filter: +40 percent on all physical skills. Defective Wall levels 2-5: -12 percent until it becomes the Gym.',
  'Skill-reward quests grant whole levels - turn them in when the skill is close to its next level.',
];

export const skillGuides: SkillGuide[] = [
  {
    id: 'metabolism',
    name: 'Metabolism',
    gives: 'Longer energy and hydration, faster physical skill gains, no fractures at elite.',
    how: 'XP per point of energy and hydration you restore in raid. Eating in the stash gives nothing - the drain-then-refill loop is the whole game.',
    plan: [
      { when: 'Start', text: 'Golden Star balm on, reapply all raid' },
      { when: 'Mid raid', text: 'DevilDog mayo or condensed milk, then an Aquamari' },
      { when: 'Extract', text: 'Eat and drink back to full, finish found food' },
      { when: 'Hideout', text: 'Medstation 3 crafts Golden Star into Propital - sell it' },
    ],
    caps: 'Fatigue throttles after 2-3 points per raid. High Metabolism later shortens debuff durations and slows Immunity - level Immunity first if you want both. Why these items: DevilDog mayo (+100 energy, -99 hydration) and condensed milk (+75, -65) are the biggest hydration drains, Aquamari (+100) the biggest refill.',
    cost: 'cheap',
  },
  {
    id: 'endurance',
    name: 'Endurance',
    gives: 'More stamina, quieter breathing, faster stamina regeneration.',
    how: 'Distance sprinted or walked while NOT overweight (white weight number), credited when you stop.',
    plan: [
      { when: 'Every raid', text: 'Light kit, big map, sprint everywhere, weight white' },
      { when: 'Start', text: 'Optional SJ6 stim for more sprint per minute' },
      { when: 'Daily', text: 'One Gym session, up to 15 reps' },
    ],
    cheese: {
      title: 'Weight stim flips sprints to Endurance',
      detail:
        'A strength or carry-weight stim can push a normally overweight kit back under the threshold, so your sprints feed Endurance instead of Strength.',
    },
    caps: 'Fatigue after 2-3 points per raid. Gym: a second session within 24 hours pays half points, a third pays nothing.',
    cost: 'cheap',
  },
  {
    id: 'strength',
    name: 'Strength',
    gives: 'Higher carry weight, faster sprint, further throws, more melee damage.',
    how: 'Distance moved while overweight (yellow number), plus grenade throws and melee hits (3 points per raid each), plus the Gym.',
    plan: [
      { when: 'Every raid', text: 'Pad bag just past yellow: 12/70 shell stacks, 1 kg each' },
      { when: 'Mid raid', text: 'Throw 3 cheap grenades: RDG-2B, M18 or Zarya' },
      { when: 'Daily', text: 'Gym session, shared with Endurance' },
    ],
    caps: 'Grenade throws and melee hits each cap at 3 points per raid; overweight-movement XP fatigues like everything else. Drop the filler as real loot fills the bag.',
    cost: 'cheap',
  },
  {
    id: 'vitality',
    name: 'Vitality',
    gives: 'Lower bleed chance, and at elite bleeds stop on their own.',
    how: '0.01 points per 5 damage taken plus 0.3 points per bleed received, from any source - including a friend.',
    plan: [
      { when: 'Duo', text: 'Friend shoots legs, Grizzly up, swap, 2-3 cycles' },
      { when: 'Every raid', text: 'Bleeds pay most: Propital through a heavy bleed' },
    ],
    cheese: {
      title: 'Friend shoots legs: Makarov PM + 9x18 PBM',
      detail:
        'Friend shoots your LEGS with a Makarov PM loaded with 9x18mm PM PBM gzh (40 damage, the weakest 9x18) or the dirt-cheap P gzh (50). A fresh leg has 65 HP, so one round never blacks it. Never shoot an already blacked limb - that damage spreads body-wide and can kill. Alternate legs, heal with a Grizzly, bring CALOK-B for bleeds and a splint for fractures. Also levels Health (25 percent pass-through) and Stress Resistance. It does NOT level Immunity. Ammo pick is community-derived from the ballistics table.',
    },
    caps: 'Fatigue after 2-3 points per raid - pause 3-4 minutes between damage cycles.',
    cost: 'moderate',
  },
  {
    id: 'health',
    name: 'Health',
    gives: 'More HP on every limb, less fracture chance, faster out-of-raid regeneration.',
    how: 'Not trained directly: it gains 25 percent of every Endurance, Strength and Vitality point you earn in raid. Gym points reportedly do not pass through.',
    plan: [
      { when: 'Every raid', text: 'Run the Endurance and Strength routines' },
      { when: 'Duo', text: 'The Vitality damage session pays 25 percent here' },
    ],
    cost: 'free',
  },
  {
    id: 'immunity',
    name: 'Immunity',
    gives: 'Less poison and toxin damage; at elite, immunity to most negative food effects.',
    how: 'About 0.0045 points per second of stim or food debuff, paid when the debuff ENDS in raid. Extracting early forfeits the points - dose early, never late.',
    plan: [
      { when: 'Start', text: 'Max Energy, another every 5 minutes' },
      { when: 'Start', text: 'Bigger: 2A2-(b-TG) or Obdolbos 2, first minutes only' },
      { when: 'Every raid', text: 'Pairs with the Metabolism loop' },
    ],
    caps: 'Friend-shooting does NOT level Immunity - only consumable debuffs count. Level it before Metabolism gets high, because high Metabolism shortens debuff durations. Bring water for 2A2, meds for Obdolbos 2.',
    cost: 'cheap',
  },
  {
    id: 'stress-resistance',
    name: 'Stress Resistance',
    gives: 'Less pain shake and tremor; elite is Berserk mode.',
    how: '0.033 points per second while low on health plus 0.33 per pain effect. Painkillers suppress pain and therefore slow it.',
    plan: [
      { when: 'Mid raid', text: 'Loot on low HP, heal only before fights or extract' },
      { when: 'Every raid', text: 'Let pain tick before taking painkillers' },
    ],
    cheese: {
      title: 'Zarya in a crate: pain, no real damage',
      detail:
        'Drop a Zarya or RDG-2B into an enclosed open-top crate and stand next to it: concussion plus a pain effect at 0.33 points each, with no lethal damage. Conveniently spends the 3-grenade Strength budget too. Skip the Golden Star loop on these raids - the balm suppresses the pain you want.',
    },
    caps: 'Fatigue after 2-3 points per raid. Roughly 2 points per minute of low-HP time.',
    cost: 'cheap',
  },
  {
    id: 'covert-movement',
    name: 'Covert Movement',
    gives: 'Quieter footsteps and faster covert movement speed.',
    how: 'Distance covered at slow speed with the sound meter showing no bar; points land each time you STOP moving.',
    plan: [
      { when: 'Every raid', text: 'Quiet stretches: slow-walk in segments, stop often' },
    ],
    cheese: {
      title: 'Stop-start shuffle at extract',
      detail:
        'Slow-walk stop-start loops in a safe corner before extracting. Works, but fatigue caps it - 5 to 10 minutes per raid is all that pays.',
    },
    caps: 'Points bank on each stop; fatigue after about 2 points per raid.',
    cost: 'free',
  },
  {
    id: 'search',
    name: 'Search',
    gives: 'Elite lets you search two containers at once - the real prize.',
    how: 'XP per container or corpse searched and per loose item picked up.',
    plan: [
      { when: 'Every raid', text: 'Container-dense routes, search everything you pass' },
    ],
    cheese: {
      title: 'Night stash circuits',
      detail:
        'Hidden-stash circuits on Customs or Shoreline at night (PMC or Scav) hit 15+ containers per raid with near-zero PvP exposure. Trains Attention and Perception at the same time.',
    },
    cost: 'free',
  },
  {
    id: 'surgery',
    name: 'Surgery',
    gives: 'Faster surgery, less max-HP loss; elite restores limbs to full.',
    how: '1.1 points per CMS or Surv12 use on a blacked (0 HP) limb.',
    plan: [
      { when: 'Every raid', text: 'Carry a CMS, surgery every limb that blacks' },
      { when: 'Extract', text: 'Short fall, black both legs, CMS both, leave' },
    ],
    cheese: {
      title: 'Duo: buddy blacks limbs, you CMS',
      detail:
        'A squadmate blacks your limbs with weak pistol ammo (see Vitality for the safe load) so you can surgery 3-4 limbs per raid - and their shots feed your Vitality at the same time.',
    },
    caps: 'Fatigue makes roughly 2 surgeries per raid the efficient ceiling. A CMS is about 30k for 5 uses.',
    cost: 'cheap',
  },
  {
    id: 'aim-drills',
    name: 'Aim Drills',
    gives: 'Faster aim-down-sights and less ADS movement penalty.',
    how: '0.2 points per hit landed while aiming down sights. Hip-fire hits give nothing.',
    plan: [
      { when: 'Every raid', text: 'Always ADS on Scavs - every hit counts, limbs too' },
      { when: 'Every raid', text: 'Factory with a fast cheap SMG is the classic farm' },
    ],
    caps: 'About 10 ADS hits (2 points) per raid before fatigue bites.',
    cost: 'cheap',
  },
  {
    id: 'bolt-action-rifles',
    name: 'Bolt-action Rifles',
    gives: 'The old Sniper skill: better bolt-action handling; elite steadies aim at any stamina.',
    how: 'XP for hits, reloads and bolt cycling with bolt-action rifles. Distance does not matter - legging Scavs pays more hits than one-taps.',
    plan: [
      { when: 'Every raid', text: 'Cheap Mosin secondary, use it on every safe Scav' },
      { when: 'Every raid', text: 'Run the Tarkov Shooter questlines for +11 levels' },
    ],
    cost: 'cheap',
  },
  {
    id: 'perception',
    name: 'Perception',
    gives: 'Better loot highlight reach and hearing; elite gives a loot proximity sense.',
    how: 'XP for picking up loot of any kind - grab and drop counts. 20 percent of it bleeds into Charisma.',
    plan: [
      { when: 'Every raid', text: 'Pick up everything: stashes, airdrops, supply crates' },
    ],
    caps: 'Six different quests award Perception levels - the most of any mental skill.',
    cost: 'free',
  },
  {
    id: 'attention',
    name: 'Attention',
    gives: 'Faster looting and examination; elite doubles looting XP and can insta-find items.',
    how: '0.08 points per item uncovered in a container, plus loose-loot pickups - item-dense containers are the whole game.',
    plan: [
      { when: 'Every raid', text: 'Open many-item containers: crates, airdrops, PMC bags' },
    ],
    cost: 'free',
  },
  {
    id: 'charisma',
    name: 'Charisma',
    gives: 'Discounts on healing, insurance and the Scav Case.',
    how: '20 percent of Attention and Perception XP, plus 0.4 points per Scav Case run, per 200k roubles insured and per 10k roubles of trader repairs.',
    plan: [
      { when: 'Every raid', text: 'Insure everything' },
      { when: 'Hideout', text: 'Scav Case on cooldown, cheapest input' },
    ],
    cheese: {
      title: 'Scav Case spam',
      detail:
        'The 0.4 points per Scav Case send is flat regardless of input value, so cheap runs on cooldown are the best points per rouble. Repairing junk gear at traders in 10k chunks also ticks it.',
    },
    cost: 'moderate',
  },
  {
    id: 'intellect',
    name: 'Intellect',
    gives: 'Faster examining and weapon modding, better repair quality.',
    how: 'About 0.4 points per 10 durability restored with weapon or armor repair kits, plus hideout crafts. Examining items currently grants nothing despite the tooltip.',
    plan: [
      { when: 'Hideout', text: 'Repair-kit Scav guns and armor before selling' },
      { when: 'Hideout', text: 'Keep crafts running' },
    ],
    cheese: {
      title: 'Repair-kit cheap flea junk',
      detail:
        'Buy cheap high-wear Scav weapons off the flea and grind them through a Weapon repair kit - 0.4 points per 10 durability adds up fast and feeds the armor skills when done on vests.',
    },
    caps: 'Some 1.0 builds reportedly shipped repair XP bugged - verify you are actually gaining points in the client.',
    cost: 'moderate',
  },
  {
    id: 'troubleshooting',
    name: 'Troubleshooting',
    gives: 'Faster malfunction clearing; elite identifies the malfunction without inspecting.',
    how: 'XP for fixing weapon malfunctions. Malfunctions come from low durability and cheap ammo.',
    plan: [
      { when: 'Every raid', text: 'Worn guns, surplus ammo, clear every jam' },
    ],
    cheese: {
      title: 'Mag-dump a broken gun to fish jams',
      detail:
        'Bring a near-broken gun with surplus ammo and mag-dump at safe moments to force malfunctions, clearing each one. Slow - mostly worth it for the quest requirements.',
    },
    cost: 'cheap',
  },
  {
    id: 'light-vests',
    name: 'Light Vests',
    gives: 'Less light-armor wear and movement penalty; elite gives bleed immunity on covered parts.',
    how: '0.4 points per 10 durability repaired with a Body armor repair kit on aramid, aluminium or UHMWPE armor, plus 0.02 per durability point of damage taken while wearing it.',
    plan: [
      { when: 'Every raid', text: 'Wear cheap aramid: PACA, 6B23' },
      { when: 'Hideout', text: 'Self-repair with a Body armor repair kit' },
    ],
    cheese: {
      title: 'Repair blown flea armor from the stash',
      detail:
        'Buy blown-out light armors cheap off the flea and repair-kit them from the stash - no raid required.',
    },
    caps: 'Damage XP diminishes after the first point per raid; repair XP is out-of-raid and un-gated.',
    cost: 'moderate',
  },
  {
    id: 'heavy-vests',
    name: 'Heavy Vests',
    gives: 'Less heavy-armor wear; elite can deflect bullets outright.',
    how: 'Same loop as Light Vests for steel, ceramic and Titan armor: 0.4 points per 10 durability repaired, 0.01 per durability of damage taken (half the light-armor rate).',
    plan: [
      { when: 'Hideout', text: 'Self-repair steel and ceramic rigs with a kit' },
    ],
    cheese: {
      title: 'Repair blown flea armor from the stash',
      detail: 'Same flea trick as Light Vests with cheap worn Kirasa or ZHUK ceramic armors.',
    },
    cost: 'moderate',
  },
  {
    id: 'mag-drills',
    name: 'Mag Drills',
    gives: 'Faster mag loading and checking; elite shows mag fill on pickup.',
    how: 'XP for loading, unloading and checking magazines IN RAID only - stash and hideout mag work counts for nothing.',
    plan: [
      { when: 'Every raid', text: 'Load looted ammo into mags in raid' },
      { when: 'Extract', text: 'Consolidate mags, mag-check pickups' },
    ],
    cheese: {
      title: 'Load-unload at extract',
      detail:
        'Carry a stack of cheap 5.45 PS and a spare mag; at a safe moment before extract, load, unload and mag-check repeatedly until the fatigue arrow shows.',
    },
    caps: 'Roughly 2 points per raid, then sharp decay; a 200 second pause resets the rate.',
    cost: 'cheap',
  },
  {
    id: 'hideout-management',
    name: 'Hideout Management',
    gives: 'Stronger hideout bonuses and slower fuel and filter drain per level.',
    how: '0.8 points per finished craft, 12 per module upgrade, plus a trickle from resources being consumed. The Library bonus does NOT apply to it.',
    plan: [
      { when: 'Hideout', text: 'Generator on, short crafts always finishing' },
      { when: 'Hideout', text: 'Do every module upgrade you can afford' },
    ],
    caps: 'Once upgrades run out, progression is slow by design - the per-craft trickle is the only repeatable source.',
    cost: 'moderate',
  },
];
