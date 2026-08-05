// EFT 1.0 story chapters, curated by hand: json.tarkov.dev does not model
// the storyline (chapters are not tasks), so this file carries the chapter
// list, how each one is triggered, and the maps it plays on. Sources: the
// official wiki's Story chapters page plus 1.0-era walkthroughs (Aug 2026).
// Completion is self-tracked - the game gives no API signal for chapters.

export interface StoryChapter {
  id: string;
  name: string;
  /** reading order; Tour is the tutorial arc, The Ticket is the finale */
  order: number;
  /** how the chapter is triggered, one or two glanceable sentences */
  start: string;
  /** normalizedName of the map where the trigger lives (undefined = automatic) */
  startMap?: string;
  /** normalizedNames of maps the chapter plays on */
  maps: string[];
  notes?: string;
}

export const STORY_WIKI_URL = 'https://escapefromtarkov.fandom.com/wiki/Story_chapters';

export const storyChapters: StoryChapter[] = [
  {
    id: 'tour',
    name: 'Tour',
    order: 1,
    start:
      'Begins automatically with a fresh 1.0 profile: the guided arc that unlocks the traders and maps.',
    maps: [
      'streets-of-tarkov',
      'interchange',
      'factory',
      'woods',
      'shoreline',
      'lighthouse',
      'the-lab',
    ],
    notes: 'Finishing Tour (including all of Mechanic\'s objectives) opens the main story.',
  },
  {
    id: 'falling-skies',
    name: 'Falling Skies',
    order: 2,
    start:
      'Opens after the full Tour chapter with all of Mechanic\'s objectives done (Standard/Unheard editions also need Prapor loyalty 2).',
    maps: ['woods', 'reserve'],
  },
  {
    id: 'batya',
    name: 'Batya',
    order: 3,
    start:
      'Investigate BEAR outposts across the maps, then collect the Bogatyr patch from the power station trailer on Customs.',
    startMap: 'customs',
    maps: ['customs', 'reserve'],
  },
  {
    id: 'accidental-witness',
    name: 'Accidental Witness',
    order: 4,
    start:
      'Find the car spray-painted with random letters in the dorms parking area on Customs.',
    startMap: 'customs',
    maps: ['customs'],
  },
  {
    id: 'they-are-already-here',
    name: 'They Are Already Here',
    order: 5,
    start: 'Read the note beside the cultist camp near the scout tower on Shoreline.',
    startMap: 'shoreline',
    maps: ['shoreline'],
  },
  {
    id: 'blue-fire',
    name: 'Blue Fire',
    order: 6,
    start:
      'At the Emercom base BTR stop on Woods, check the large shelf for the flyer stuck to its side wall.',
    startMap: 'woods',
    maps: ['woods'],
  },
  {
    id: 'the-unheard',
    name: 'The Unheard',
    order: 7,
    start:
      'On Streets of Tarkov, head north to the Cardinal apartments and read the note on the desk in the eastern wing office.',
    startMap: 'streets-of-tarkov',
    maps: ['streets-of-tarkov'],
  },
  {
    id: 'the-labyrinth',
    name: 'The Labyrinth',
    order: 8,
    start:
      'Take the Knossos LLC facility key from the admin wing of the Shoreline resort, then enter the underground tunnels.',
    startMap: 'shoreline',
    maps: ['shoreline', 'the-labyrinth'],
  },
  {
    id: 'boreas',
    name: 'Boreas',
    order: 9,
    start:
      'The icebreaker arc (added in 1.1): board the Boreas and recover the hard drives from compartment C-1 for Mechanic.',
    startMap: 'icebreaker',
    maps: ['icebreaker'],
    notes: 'Several trader quests (e.g. Ragman\'s Fresh Stock) only open after this chapter.',
  },
  {
    id: 'the-ticket',
    name: 'The Ticket',
    order: 10,
    start:
      'Unlocks automatically once Falling Skies is done - the finale arc; your choices across the chapters decide which of the four endings you can reach.',
    maps: ['terminal'],
    notes: 'Four endings exist; this chapter is where the branches resolve.',
  },
];

/** chapters that start or play on the given map (planner sidebar hint) */
export function chaptersOnMap(normalizedName: string): StoryChapter[] {
  return storyChapters.filter(
    (c) => c.startMap === normalizedName || c.maps.includes(normalizedName),
  );
}
