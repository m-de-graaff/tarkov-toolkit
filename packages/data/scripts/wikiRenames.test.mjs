// Unit checks for the wiki rename pass; same plain-assert style as
// validate-snapshot.mjs.
import { applyWikiRenames, fetchWikiRenames, isCleanRename } from './wikiRenames.mjs';

const failures = [];
const check = (cond, message) => {
  if (!cond) failures.push(message);
};

// --- isCleanRename
check(isCleanRename('Old Name', 'New Name'), 'plain rename accepted');
check(!isCleanRename('Same', 'Same'), 'identical titles rejected');
check(!isCleanRename('Old', 'Quests#Section'), 'section redirect rejected');
check(!isCleanRename('Old', 'Category:Quests'), 'cross-namespace redirect rejected');
check(!isCleanRename('Old', ''), 'empty target rejected');

// --- fetchWikiRenames: batching, redirect + normalization composition
{
  const calls = [];
  const names = Array.from({ length: 60 }, (_, i) => `Quest ${i}`);
  const fakeFetch = async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      return {
        query: {
          normalized: [{ from: 'Quest 1', to: 'Quest_1_norm' }],
          redirects: [
            { from: 'Quest 0', to: 'Renamed 0' },
            { from: 'Quest_1_norm', to: 'Renamed 1' },
            { from: 'Quest 2', to: 'File:NotAQuest' },
          ],
        },
      };
    }
    return { query: { redirects: [{ from: 'Quest 55', to: 'Renamed 55' }] } };
  };
  const renames = await fetchWikiRenames(names, fakeFetch);
  check(calls.length === 2, `60 names should need 2 batches, got ${calls.length}`);
  check(renames.get('Quest 0') === 'Renamed 0', 'direct redirect mapped');
  check(renames.get('Quest 1') === 'Renamed 1', 'normalized redirect mapped back to the original name');
  check(!renames.has('Quest 2'), 'cross-namespace target dropped');
  check(renames.get('Quest 55') === 'Renamed 55', 'second batch processed');
}

// --- applyWikiRenames
{
  const tasks = [
    { id: 'a', name: 'The Blood of War - Part 1' },
    { id: 'b', name: 'Sales Night' },
    { id: 'c', name: 'Fresh Stock' },
  ];
  const count = applyWikiRenames(
    tasks,
    new Map([
      ['The Blood of War - Part 1', 'Fuel Crisis'],
      ['Sales Night', 'Pathfinder'],
    ]),
  );
  check(count === 2, `expected 2 renames applied, got ${count}`);
  check(tasks[0].name === 'Fuel Crisis' && tasks[0].formerName === 'The Blood of War - Part 1', 'rename keeps former name');
  check(tasks[2].name === 'Fresh Stock' && tasks[2].formerName === undefined, 'unrenamed task untouched');
}

if (failures.length > 0) {
  console.error(`wiki-renames checks FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('wiki-renames checks passed.');
