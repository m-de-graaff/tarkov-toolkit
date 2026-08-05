// Quest catalog from the community wiki. The wiki's "Quests" page carries a
// per-trader table of every quest currently in the game - freshly maintained
// within days of a patch, while tarkov.dev can lag a rename wave or a quest
// rework by weeks. This module fetches and parses that table plus individual
// quest pages (level requirement, prerequisites, kappa) into plain records;
// wikiSync.mjs reconciles them against the API's task list.

const WIKI_API = 'https://escapefromtarkov.fandom.com/api.php';
const BATCH = 50; // MediaWiki caps titles per query

/**
 * Canonical form for matching wiki titles against API task names. The two
 * sides decorate the same quest differently:
 *  - the API splits zone variants into "Name [PVP ZONE]" / "Name [PVE ZONE]"
 *  - the wiki disambiguates page titles as "Name (quest)"
 *  - prestige quests are untranslated in the API ("Neuanfang") but titled
 *    "New Beginning (Prestige N)" on the wiki
 */
export function normalizeQuestName(name) {
  let n = String(name)
    .replace(/\s*\[[^\]]*\]\s*$/, '') // API zone suffix
    .replace(/\s*\(quest\)\s*$/i, '') // wiki disambiguation
    .trim();
  if (/^new beginning\s*\(prestige \d+\)$/i.test(n) || /^neuanfang$/i.test(n)) {
    n = 'neuanfang';
  }
  return n.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** [[A|B]] -> B, [[A]] -> A, strip bold/italic, templates, html tags. */
export function stripWikiMarkup(text) {
  return text
    .replace(/\[\[(?:[^\]|]*\|)?([^\]|]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The "Quests" page: one wds-tabber with a portrait tab per trader and a
 * wikitable per tab (| quest link | objectives bullets | rewards bullets).
 * Returns [{trader, name, objectives: [{text, optional}], exp, order}].
 */
export function parseQuestIndex(wikitext) {
  const traders = [
    ...wikitext.matchAll(/class=wds-tabs__tab-label\|([^\]]+)\]\]/g),
  ].map((m) => m[1].trim());
  const blocks = wikitext.split(/class="wds-tab__content[^"]*">/).slice(1);
  const quests = [];
  blocks.forEach((block, blockIndex) => {
    const trader = traders[blockIndex];
    if (!trader) return;
    for (const [order, row] of block.split(/\n\|-/).slice(1).entries()) {
      // cells start at lines beginning with a single pipe
      const cells = [];
      for (const line of row.split('\n')) {
        if (/^\|(?!\})/.test(line)) cells.push([line.slice(1)]);
        else if (cells.length > 0) cells[cells.length - 1].push(line);
        if (/^\|\}/.test(line)) break; // table end
      }
      if (cells.length === 0) continue;
      const nameMatch = cells[0].join(' ').match(/\[\[([^\]|]+)/);
      if (!nameMatch) continue;
      const objectives = (cells[1] ?? [])
        .filter((l) => /^\*+/.test(l.trim()))
        .map((l) => ({
          text: stripWikiMarkup(l.replace(/^\s*\*+\s*/, '')),
          optional: /^\s*\*\*/.test(l) || /optional/i.test(l),
        }))
        .filter((o) => o.text.length > 0);
      const expMatch = (cells[2] ?? [])
        .join(' ')
        .match(/\+\s*([\d,]+)\s*\[\[EXP\]\]/);
      quests.push({
        trader,
        name: nameMatch[1].trim(),
        objectives,
        exp: expMatch ? Number(expMatch[1].replace(/,/g, '')) : null,
        order,
      });
    }
  });
  return quests;
}

/**
 * A single quest page. Returns:
 *  - kappa: true/false when the infobox says so, else null
 *  - level: N from "Must be level N", else null (the 1.1 wiki convention is
 *    to drop the line entirely when a quest is loyalty-gated instead)
 *  - previous: prerequisite quest titles from the infobox, [] when the field
 *    is present but empty, null when the infobox/field is missing
 */
export function parseQuestPage(wikitext) {
  const kappaMatch = wikitext.match(/\|\s*reqkappa\s*=[^\n]*\b(Yes|No)\b/i);
  const levelMatch = wikitext.match(/Must be level (\d+)/i);
  const prevMatch = wikitext.match(/\|\s*previous\s*=([^\n]*)/);
  return {
    kappa: kappaMatch ? /yes/i.test(kappaMatch[1]) : null,
    level: levelMatch ? Number(levelMatch[1]) : null,
    previous: prevMatch
      ? [...prevMatch[1].matchAll(/\[\[([^\]|]+)/g)].map((m) => m[1].trim())
      : null,
  };
}

export async function fetchQuestIndex(fetchJson) {
  const url =
    `${WIKI_API}?action=query&prop=revisions&rvprop=content&rvslots=main` +
    `&format=json&formatversion=2&titles=Quests`;
  const res = await fetchJson(url);
  const content = res?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content;
  if (!content) throw new Error('wiki Quests page unavailable');
  return parseQuestIndex(content);
}

/** title -> parseQuestPage() result for every fetchable page, batched. */
export async function fetchQuestPages(titles, fetchJson) {
  const unique = [...new Set(titles)].filter((t) => t && !t.includes('|'));
  const pages = new Map();
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const url =
      `${WIKI_API}?action=query&prop=revisions&rvprop=content&rvslots=main` +
      `&format=json&formatversion=2&redirects=1` +
      `&titles=${encodeURIComponent(batch.join('|'))}`;
    const res = await fetchJson(url);
    // compose title normalization + redirects back onto the requested title
    const back = new Map();
    for (const n of res?.query?.normalized ?? []) back.set(n.to, n.from);
    for (const r of res?.query?.redirects ?? []) {
      back.set(r.to, back.get(r.from) ?? r.from);
    }
    for (const page of res?.query?.pages ?? []) {
      if (page.missing) continue;
      const content = page.revisions?.[0]?.slots?.main?.content;
      if (!content) continue;
      const requested = back.get(page.title) ?? page.title;
      pages.set(requested, parseQuestPage(content));
    }
  }
  return pages;
}
