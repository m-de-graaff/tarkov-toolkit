// Quest-name healing via the community wiki. Game patches rename quests
// (1.1.0 turned "The Blood of War - Part 1" into "Fuel Crisis") and
// tarkov.dev can lag those renames by days; the wiki moves the page within
// hours, which leaves a redirect from the old title to the new one. Batch-
// querying the MediaWiki API with every task name surfaces exactly those
// redirects, so the snapshot can show the names players actually see in-game.

const WIKI_API = 'https://escapefromtarkov.fandom.com/api.php';
const BATCH = 50; // MediaWiki caps titles per query

/** A redirect target we trust as a plain quest rename. */
export function isCleanRename(from, to) {
  return (
    typeof from === 'string' &&
    typeof to === 'string' &&
    to.length > 0 &&
    to !== from &&
    !to.includes('#') && // section redirect - not a standalone quest page
    !to.includes(':') // cross-namespace (File:, Category:, ...) - not a quest
  );
}

/**
 * Old name -> current wiki title for every name that is a redirect.
 * MediaWiki may normalize a title before resolving it (case, underscores),
 * so the chain original -> normalized -> redirect target is composed back
 * onto the original name.
 */
export async function fetchWikiRenames(names, fetchJson) {
  const unique = [...new Set(names)].filter(
    (n) => typeof n === 'string' && n.length > 0 && !n.includes('|'),
  );
  const renames = new Map();
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const url =
      `${WIKI_API}?action=query&titles=${encodeURIComponent(batch.join('|'))}` +
      `&redirects=1&format=json&formatversion=2`;
    const res = await fetchJson(url);
    const normalized = new Map(
      (res?.query?.normalized ?? []).map((n) => [n.to, n.from]),
    );
    for (const r of res?.query?.redirects ?? []) {
      if (!isCleanRename(r.from, r.to)) continue;
      // undo title normalization so the key matches our task name exactly
      const original = normalized.get(r.from) ?? r.from;
      if (batch.includes(original)) renames.set(original, r.to);
    }
  }
  return renames;
}

/** Renames matching tasks in place; keeps the old name for search. */
export function applyWikiRenames(tasks, renames) {
  let count = 0;
  for (const task of tasks) {
    const to = renames.get(task.name);
    if (!to) continue;
    task.formerName = task.name;
    task.name = to;
    count += 1;
  }
  return count;
}
