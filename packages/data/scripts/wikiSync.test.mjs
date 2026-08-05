// Unit checks for the wiki catalog sync; same plain-assert style as
// validate-snapshot.mjs.
import {
  normalizeQuestName,
  parseQuestIndex,
  parseQuestPage,
  stripWikiMarkup,
} from './wikiQuests.mjs';
import { applyWikiSync } from './wikiSync.mjs';

const failures = [];
const check = (cond, message) => {
  if (!cond) failures.push(message);
};

// --- normalizeQuestName: both sides' decorations collapse to one key
check(
  normalizeQuestName('Between Two Fires [PVP ZONE]') === normalizeQuestName('Between Two Fires'),
  'API zone suffix stripped',
);
check(
  normalizeQuestName('Immunity (quest)') === normalizeQuestName('Immunity'),
  'wiki disambiguation suffix stripped',
);
check(
  normalizeQuestName('New Beginning (Prestige 3)') === normalizeQuestName('Neuanfang'),
  'prestige quests match their untranslated API name',
);
check(
  normalizeQuestName('Small Things, Big Help') === normalizeQuestName('small things big help'),
  'punctuation-insensitive',
);

// --- stripWikiMarkup
check(
  stripWikiMarkup("Eliminate 5 [[Scavs]] on [[Woods]],[[Ground Zero|GZ]]") ===
    'Eliminate 5 Scavs on Woods,GZ',
  `link markup stripped: got "${stripWikiMarkup("Eliminate 5 [[Scavs]] on [[Woods]],[[Ground Zero|GZ]]")}"`,
);

// --- parseQuestIndex on a miniature Quests page
const INDEX_FIXTURE = `
<ul>
<li>[[File:A.png|119x119px|link=|class=wds-tabs__tab-label|Prapor]]</li>
<li>[[File:B.png|119x119px|link=|class=wds-tabs__tab-label|Therapist]]</li>
</ul>
<div class="wds-tab__content wds-is-current">
{| class="wikitable sortable"
|-
!Quest
!Objectives
!Rewards
|-
| [[Debut]]
|
* Eliminate 5 [[Scavs]] on [[Woods]]
** (''Optional'') Do it at night
|
* +3,000 [[EXP]]
* 80,000 Roubles
|-
| [[Luxurious Life|Lux Life]]
|
* Locate the store
|
* +1,750 [[EXP]]
|}
</div>
<div class="wds-tab__content">
{| class="wikitable sortable"
|-
!Quest
!Objectives
!Rewards
|-
| [[First in Line]]
|
* Visit the camp
|
* +1,200 [[EXP]]
|}
</div>
`;
{
  const index = parseQuestIndex(INDEX_FIXTURE);
  check(index.length === 3, `expected 3 quests, got ${index.length}`);
  const debut = index.find((q) => q.name === 'Debut');
  check(debut?.trader === 'Prapor', 'Debut belongs to Prapor');
  check(debut?.exp === 3000, `Debut EXP parsed, got ${debut?.exp}`);
  check(debut?.objectives.length === 2, 'both objective bullets kept');
  check(debut?.objectives[0].text === 'Eliminate 5 Scavs on Woods', 'objective text cleaned');
  check(debut?.objectives[1].optional === true, 'sub-bullet marked optional');
  const fil = index.find((q) => q.name === 'First in Line');
  check(fil?.trader === 'Therapist', 'second tab maps to second trader');
}

// --- parseQuestPage
{
  const page = parseQuestPage(`
{{Infobox quest
|previous     =[[Gratitude]]<br/>[[A Big Loss]]
|reqkappa     =<font color="red">Yes</font>
}}
==Requirements==
* Must be level 30 to start this quest.
`);
  check(page.kappa === true, 'kappa yes parsed');
  check(page.level === 30, `level parsed, got ${page.level}`);
  check(
    page.previous?.length === 2 && page.previous[1] === 'A Big Loss',
    'previous quests parsed',
  );
}
{
  const page = parseQuestPage(`{{Infobox quest
|previous     =
|reqkappa     =<font color="green">No</font>
}}
==Requirements==
* Obtain level 2 loyalty with [[Ragman]]
`);
  check(page.kappa === false, 'kappa no parsed');
  check(page.level === null, 'missing level line -> null');
  check(Array.isArray(page.previous) && page.previous.length === 0, 'empty previous -> []');
  check(
    page.loyalty?.level === 2 && page.loyalty?.trader === 'Ragman',
    `loyalty line parsed, got ${JSON.stringify(page.loyalty)}`,
  );
}

// --- applyWikiSync
const task = (id, name, extra = {}) => ({
  id,
  name,
  normalizedName: id,
  modes: ['pvp', 'pve'],
  trader: { id: 'trader-1', name: 'Prapor' },
  mapId: null,
  minPlayerLevel: 15,
  factionName: 'Any',
  kappaRequired: false,
  experience: 100,
  taskRequirements: [],
  objectives: [],
  ...extra,
});
{
  const tasks = [
    task('t1', 'Debut'),
    task('t2', 'Removed Quest'),
    task('t3', 'Kept Daily'),
    task('t4', 'Zone Quest [PVP ZONE]'),
    task('t5', 'Zone Quest [PVE ZONE]'),
    task('t6', 'Collector', {
      taskRequirements: [{ taskId: 't1', status: ['complete'] }],
    }),
  ];
  const index = [
    { trader: 'Prapor', name: 'Debut', objectives: [], exp: 3000, order: 0 },
    { trader: 'Prapor', name: 'Zone Quest', objectives: [], exp: null, order: 1 },
    { trader: 'Prapor', name: 'Collector', objectives: [], exp: null, order: 2 },
    {
      trader: 'Prapor',
      name: 'Brand New (quest)',
      objectives: [{ text: 'Visit the mall on Interchange', optional: false }],
      exp: 5000,
      order: 3,
    },
    { trader: 'Prapor', name: 'Chained New', objectives: [], exp: null, order: 4 },
  ];
  const pages = new Map([
    ['Debut', { kappa: true, level: null, previous: [], loyalty: null }],
    ['Zone Quest', { kappa: null, level: null, previous: null, loyalty: { level: 3, trader: 'Prapor' } }],
    ['Collector', { kappa: true, level: null, previous: ['Collector#Requirements'], loyalty: null }],
    ['Brand New (quest)', { kappa: false, level: 12, previous: ['Debut'], loyalty: { level: 2, trader: 'Prapor' } }],
    ['Chained New', { kappa: null, level: null, previous: ['Brand New (quest)'], loyalty: null }],
  ]);
  const { tasks: synced, drift } = applyWikiSync({
    tasks,
    maps: [{ id: 'map-i', name: 'Interchange' }],
    traderIdByName: new Map([['Prapor', 'trader-1']]),
    index,
    pages,
    config: { keepDespiteWikiAbsence: ['Kept Daily'] },
  });
  const byId = new Map(synced.map((t) => [t.id, t]));
  check(byId.get('t1')?.experience === 3000, 'matched task adopts wiki EXP');
  check(byId.get('t1')?.minPlayerLevel === 1, 'no level line -> loyalty-gated -> level 1');
  check(byId.get('t1')?.kappaRequired === true, 'kappa adopted');
  check(!byId.has('t2'), 'quest gone from the wiki is dropped');
  check(byId.has('t3'), 'allowlisted task survives wiki absence');
  check(byId.has('t4') && byId.has('t5'), 'zone variants both match the single wiki entry');
  check(
    byId.get('t6')?.taskRequirements.length === 1,
    'section-link prerequisites keep the API chain',
  );
  check(
    byId.get('t4')?.loyaltyLevel === 3 && byId.get('t5')?.loyaltyLevel === 3,
    'loyalty requirement adopted on matched zone variants',
  );
  const brandNew = byId.get('wiki-brand-new');
  check(brandNew?.wikiOnly === true, 'wiki-only quest synthesized');
  check(brandNew?.minPlayerLevel === 12, 'synthetic takes wiki level');
  check(brandNew?.loyaltyLevel === 2, 'synthetic takes wiki loyalty level');
  check(
    brandNew?.taskRequirements[0]?.taskId === 't1',
    'synthetic prerequisite resolves to API task',
  );
  check(
    brandNew?.objectives[0]?.maps[0] === 'map-i',
    'objective map references resolved from text',
  );
  check(
    byId.get('wiki-chained-new')?.taskRequirements[0]?.taskId === 'wiki-brand-new',
    'synthetic prerequisite resolves to another synthetic',
  );
  check(drift.dropped.length === 1 && drift.dropped[0].id === 't2', 'drop recorded in drift');
  check(drift.synthesized.length === 2, 'synthesized recorded in drift');
}

if (failures.length > 0) {
  console.error(`wiki-sync checks FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('wiki-sync checks passed.');
