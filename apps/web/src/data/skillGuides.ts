// Curated skill-leveling routines, rebuilt Aug 2026 from the official wiki
// plus TarkovForge / timesaver.gg / Games Finder guides (EFT 1.0 era).
// The Crafting skill is not listed here because the XP page computes it live
// from craft data and prices. Recoil Control and Memory were removed from the
// game in 0.14.5 and are deliberately absent.

export type GuideCost = 'free' | 'cheap' | 'moderate' | 'expensive';

/** When during play a step happens; shown as a chip in front of the step. */
export type StepWhen =
  | 'Raid start'
  | 'Mid raid'
  | 'Before extract'
  | 'Every raid'
  | 'Duo raid'
  | 'Hideout'
  | 'Daily';

export interface PlanStep {
  when: StepWhen;
  text: string;
}

export interface SkillCheese {
  title: string;
  detail: string;
}

export interface SkillGuide {
  id: string;
  name: string;
  /** what the skill gives you, one line */
  gives: string;
  /** how XP is actually earned, one line */
  how: string;
  /** the easy proven routine, in order */
  plan: PlanStep[];
  cheese?: SkillCheese;
  /** fatigue / cap warnings worth knowing before grinding */
  caps?: string;
  cost: GuideCost;
}

/** Page-level rules that apply to every skill below. */
export const skillGlobalNotes: string[] = [
  'Skill fatigue: after about 2-3 points in one skill per raid, gains are throttled hard. A 200 second pause without gains resets the rate to normal. Budget a little per skill per raid instead of grinding one.',
  'Hideout boosters: the Air Filtering Unit with an FP-100 filter gives +40 percent leveling on all physical skills. Defective Wall levels 2-5 impose -12 percent on physical skills until upgraded to the Gym.',
  'Quests that reward skill levels grant whole levels - the closer the skill is to its next level, the more points a reward level is worth.',
];

export const skillGuides: SkillGuide[] = [
  {
    id: 'metabolism',
    name: 'Metabolism',
    gives: 'Longer energy and hydration, faster physical skill gains, no fractures at elite.',
    how: 'XP per point of energy and hydration you restore in raid. Eating in the stash gives nothing.',
    plan: [
      {
        when: 'Raid start',
        text: 'Apply a Golden Star balm immediately and keep reapplying it all raid - it slowly drains energy and hydration, which you refill for points. Ibuprofen works the same way.',
      },
      {
        when: 'Mid raid',
        text: 'Eat a Jar of DevilDog mayo (+100 energy, -99 hydration) or a Can of condensed milk (+75, -65), then drink an Aquamari (+100 hydration) to refill the drain.',
      },
      {
        when: 'Before extract',
        text: 'Eat and drink back to full, and consume any found food you cannot carry out - those are free points.',
      },
      {
        when: 'Hideout',
        text: 'Medstation 3 crafts Golden Star into Propital you can sell, making the drain loop essentially free.',
      },
    ],
    caps: 'Fatigue throttles after 2-3 points per raid. High Metabolism later shortens debuff durations and slows Immunity leveling - if you want both, level Immunity first.',
    cost: 'cheap',
  },
  {
    id: 'endurance',
    name: 'Endurance',
    gives: 'More stamina, quieter breathing, faster stamina regeneration.',
    how: 'Distance sprinted or walked while NOT overweight (white weight number), credited when you stop.',
    plan: [
      {
        when: 'Every raid',
        text: 'Take a light kit (SMG or pistol, small rig, empty or no backpack) on a big map like Woods, Shoreline or Lighthouse and sprint everywhere while the weight number stays white.',
      },
      {
        when: 'Raid start',
        text: 'Optional: inject an SJ6 stim - more stamina means more sprint distance per minute.',
      },
      {
        when: 'Daily',
        text: 'One Gym session (up to 15 reps). A second session within 24 hours pays half points, a third pays nothing.',
      },
    ],
    cheese: {
      title: 'Stim under the weight bar',
      detail:
        'A strength or carry-weight stim can flip a normally overweight kit back under the threshold, so your sprints feed Endurance instead of Strength.',
    },
    caps: 'Fatigue after 2-3 points per raid; Gym is effectively once per day.',
    cost: 'cheap',
  },
  {
    id: 'strength',
    name: 'Strength',
    gives: 'Higher carry weight, faster sprint, further throws, more melee damage.',
    how: 'Distance moved while overweight (yellow number), plus grenade throws and melee hits (3 points per raid each), plus the Gym.',
    plan: [
      {
        when: 'Every raid',
        text: 'Pad your backpack just past the yellow weight threshold with cheap filler - 20-round stacks of 12/70 shotgun shells weigh 1 kg each - then move between points as normal and drop filler as real loot fills the bag.',
      },
      {
        when: 'Mid raid',
        text: 'Throw 3 cheap grenades in quiet moments: RDG-2B or M18 smokes, or a Zarya. That fills the whole grenade cap for the raid.',
      },
      {
        when: 'Daily',
        text: 'Gym session - reps land randomly in Strength or Endurance.',
      },
    ],
    caps: 'Grenade throws and melee hits each cap at 3 points per raid; overweight-movement XP fatigues like everything else.',
    cost: 'cheap',
  },
  {
    id: 'vitality',
    name: 'Vitality',
    gives: 'Lower bleed chance, and at elite bleeds stop on their own.',
    how: '0.01 points per 5 damage taken plus 0.3 points per bleed received, from any source - including a friend.',
    plan: [
      {
        when: 'Duo raid',
        text: 'In a quiet corner, let a friend put controlled shots into your legs, heal up with a Grizzly, swap roles, and repeat 2-3 cycles before playing the raid out normally.',
      },
      {
        when: 'Every raid',
        text: 'Bleeds are worth far more than raw damage - barbed wire scrapes and light bleeds are efficient. Power move: out-heal a heavy bleed with Propital without stopping it, so the ticks keep paying.',
      },
    ],
    cheese: {
      title: 'The friend-shooting method, done safely',
      detail:
        'Friend shoots your LEGS with a Makarov PM loaded with 9x18mm PM PBM gzh (40 damage, the weakest 9x18) or the dirt-cheap P gzh (50). A fresh leg has 65 HP, so one round never blacks it. Never shoot an already blacked limb - that damage spreads body-wide and can kill. Alternate legs, heal with a Grizzly, bring CALOK-B for bleeds and a splint for fractures. Also levels Health (25 percent pass-through) and Stress Resistance. It does NOT level Immunity. Ammo pick is community-derived from the ballistics table, not a named guide load.',
    },
    caps: 'Fatigue after 2-3 points per raid - pause 3-4 minutes between damage cycles.',
    cost: 'moderate',
  },
  {
    id: 'health',
    name: 'Health',
    gives: 'More HP on every limb, less fracture chance, faster out-of-raid regeneration.',
    how: 'Not trained directly: it gains 25 percent of every Endurance, Strength and Vitality point you earn in raid.',
    plan: [
      {
        when: 'Every raid',
        text: 'Just run the Endurance and Strength routines - Health accrues automatically at a quarter rate of everything they earn.',
      },
      {
        when: 'Duo raid',
        text: 'The Vitality damage session is also the fastest Health farm via the pass-through.',
      },
      {
        when: 'Daily',
        text: 'Gym points reportedly do NOT pass through to Health, so earn the contributing points in raid, not only at the Gym.',
      },
    ],
    cost: 'free',
  },
  {
    id: 'immunity',
    name: 'Immunity',
    gives: 'Less poison and toxin damage; at elite, immunity to most negative food effects.',
    how: 'About 0.0045 points per second of stim or food debuff, paid out when the debuff ENDS in raid. Extracting early forfeits the points.',
    plan: [
      {
        when: 'Raid start',
        text: 'Drink a Can of Max Energy - its roughly 5 minute debuff is the cheapest reliable point source. Repeat every 5 minutes if you brought more.',
      },
      {
        when: 'Raid start',
        text: 'Bigger option: inject 2A2-(b-TG) (15 minute hydration drain, bring water) or Obdolbos 2 (30 minutes of debuffs, bring meds) - only in the first minutes, so it runs out before extract.',
      },
      {
        when: 'Every raid',
        text: 'Stacks perfectly with the Metabolism loop: the food and drink you chug anyway refills what the debuffs drain.',
      },
    ],
    caps: 'Friend-shooting does NOT level Immunity - only consumable debuffs count. Level it before Metabolism gets high, because high Metabolism shortens debuff durations.',
    cost: 'cheap',
  },
  {
    id: 'stress-resistance',
    name: 'Stress Resistance',
    gives: 'Less pain shake and tremor; elite is Berserk mode.',
    how: '0.033 points per second while low on health plus 0.33 per pain effect. Painkillers suppress pain and therefore slow it.',
    plan: [
      {
        when: 'Mid raid',
        text: 'After a fight, stay on low HP while you loot instead of insta-healing - about 2 points per minute of low-HP time - and patch up only before the next fight or extract.',
      },
      {
        when: 'Every raid',
        text: 'Let pain tick for a while before taking painkillers. Skip the Golden Star Metabolism loop on raids where you farm this - the balm suppresses the pain you want.',
      },
    ],
    cheese: {
      title: 'Crate concussion',
      detail:
        'Drop a Zarya or RDG-2B into an enclosed open-top crate and stand next to it: concussion plus a pain effect at 0.33 points each, with no lethal damage. Conveniently spends the 3-grenade Strength budget too.',
    },
    caps: 'Fatigue after 2-3 points per raid.',
    cost: 'cheap',
  },
  {
    id: 'covert-movement',
    name: 'Covert Movement',
    gives: 'Quieter footsteps and faster covert movement speed.',
    how: 'Distance covered at slow speed with the sound meter showing no bar; points land each time you STOP moving.',
    plan: [
      {
        when: 'Every raid',
        text: 'During quiet stretches - indoors, between points, waiting at extract - drop to minimum-noise slow walk and move in segments: walk, stop, walk, stop. Do it on your normal loot route.',
      },
    ],
    cheese: {
      title: 'Extract shuffle',
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
      {
        when: 'Every raid',
        text: 'Run container-dense routes - Interchange shelves and registers, Customs and Shoreline hidden-stash circuits - and search every jacket, cabinet and corpse you pass. Trains Attention and Perception at the same time.',
      },
    ],
    cheese: {
      title: 'Night stash runs',
      detail:
        'Hidden-stash circuits at night (PMC or Scav) hit 15+ containers per raid with near-zero PvP exposure.',
    },
    cost: 'free',
  },
  {
    id: 'surgery',
    name: 'Surgery',
    gives: 'Faster surgery, less max-HP loss; elite restores limbs to full.',
    how: '1.1 points per CMS or Surv12 use on a blacked (0 HP) limb.',
    plan: [
      {
        when: 'Every raid',
        text: 'Carry a CMS kit (cheap, 5 uses). Whenever a limb blacks naturally, surgery it in raid instead of just painkilling through.',
      },
      {
        when: 'Before extract',
        text: 'Dedicated grind: take a short fall to black both legs, CMS both, then extract - 2 surgeries per raid is the efficient ceiling anyway.',
      },
    ],
    cheese: {
      title: 'Duo limb service',
      detail:
        'A squadmate blacks your limbs with weak pistol ammo (see Vitality for the safe load) so you can surgery 3-4 limbs per raid - and their shots feed your Vitality at the same time.',
    },
    caps: 'Fatigue makes roughly 2 surgeries per raid the efficient ceiling.',
    cost: 'cheap',
  },
  {
    id: 'aim-drills',
    name: 'Aim Drills',
    gives: 'Faster aim-down-sights and less ADS movement penalty.',
    how: '0.2 points per hit landed while aiming down sights. Hip-fire hits give nothing.',
    plan: [
      {
        when: 'Every raid',
        text: 'Always ADS when shooting Scavs - every connecting bullet counts, kills not required. Factory with a fast cheap SMG is the classic farm: several rounds into each Scav, limbs count too.',
      },
    ],
    caps: 'About 10 ADS hits (2 points) per raid before fatigue bites.',
    cost: 'cheap',
  },
  {
    id: 'bolt-action-rifles',
    name: 'Bolt-action Rifles',
    gives: 'The old Sniper skill: better bolt-action handling; elite steadies aim at any stamina.',
    how: 'XP for hits, reloads and bolt cycling with bolt-action rifles. Distance does not matter.',
    plan: [
      {
        when: 'Every raid',
        text: 'Bring a cheap Mosin as a secondary on loot runs and use it on every Scav you safely can. Legging Scavs with cheap 7.62x54R pays more hits than one-taps.',
      },
      {
        when: 'Every raid',
        text: 'Work the Tarkov Shooter and A Shooter Born in Heaven questlines - their reward levels (+5, +3) outpace raw grinding.',
      },
    ],
    cost: 'cheap',
  },
  {
    id: 'perception',
    name: 'Perception',
    gives: 'Better loot highlight reach and hearing; elite gives a loot proximity sense.',
    how: 'XP for picking up loot of any kind. 20 percent of it bleeds into Charisma.',
    plan: [
      {
        when: 'Every raid',
        text: 'Pick up (not just look at) every item on your route - grab and drop counts. Airdrops, hidden stashes and supply crates are the densest sources.',
      },
    ],
    caps: 'Six different quests award Perception levels - the most of any mental skill - so bank them when the skill is close to its next level.',
    cost: 'free',
  },
  {
    id: 'attention',
    name: 'Attention',
    gives: 'Faster looting and examination; elite doubles looting XP and can insta-find items.',
    how: '0.08 points per item uncovered in a container, plus loose-loot pickups.',
    plan: [
      {
        when: 'Every raid',
        text: 'Prefer containers that hold MANY items - supply crates, airdrops, dead PMC backpacks - over single-slot jackets. Same route as Search and Perception; the three level together.',
      },
    ],
    cost: 'free',
  },
  {
    id: 'charisma',
    name: 'Charisma',
    gives: 'Discounts on healing, insurance and the Scav Case.',
    how: '20 percent of Attention and Perception XP, plus 0.4 points per Scav Case run, per 200k roubles insured and per 10k roubles of trader repairs.',
    plan: [
      {
        when: 'Every raid',
        text: 'Insure everything, every raid - it is the correct play anyway and it pays Charisma.',
      },
      {
        when: 'Hideout',
        text: 'Keep the Scav Case running on cooldown with the cheapest input; loot heavily and let the Attention and Perception transfer do the rest.',
      },
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
      {
        when: 'Hideout',
        text: 'Repair the beat-up Scav guns and armor you drag out of raids with repair kits before selling them, and keep crafts running.',
      },
    ],
    cheese: {
      title: 'Flea junk grinder',
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
    how: 'XP for fixing weapon malfunctions (inspect, then clear).',
    plan: [
      {
        when: 'Every raid',
        text: 'Run worn Scav-tier guns (under 80 percent durability) with the cheapest surplus ammo on Scav-farming raids and clear every jam that happens - it levels itself as a byproduct.',
      },
    ],
    cheese: {
      title: 'Jam fishing',
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
      {
        when: 'Every raid',
        text: 'Wear cheap aramid armor (PACA, 6B23 variants) so incoming fire trains it.',
      },
      {
        when: 'Hideout',
        text: 'Repair the damage yourself with a Body armor repair kit instead of trader repair - both halves of the loop pay points.',
      },
    ],
    cheese: {
      title: 'Blown-armor repair grind',
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
      {
        when: 'Hideout',
        text: 'If you run steel or ceramic rigs anyway, self-repair them with a Body armor repair kit - damage alone levels this at half speed, so the kit is the main lever.',
      },
    ],
    cheese: {
      title: 'Blown-armor repair grind',
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
      {
        when: 'Every raid',
        text: 'Do all mag management inside the raid during quiet moments: load looted ammo boxes into mags on the spot, consolidate half-empty mags before extract, and mag-check pickups off bodies.',
      },
    ],
    cheese: {
      title: 'Extract load-unload',
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
      {
        when: 'Hideout',
        text: 'Keep the generator running and short crafts finishing around the clock - the crafting plan above does double duty here - and do every module upgrade you can afford.',
      },
    ],
    caps: 'Once upgrades run out, progression is slow by design - the per-craft trickle is the only repeatable source.',
    cost: 'moderate',
  },
];
