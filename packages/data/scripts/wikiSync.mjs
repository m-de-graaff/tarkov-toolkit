// Reconciles the API's task list against the wiki's current quest catalog
// (wikiQuests.mjs). The wiki table is the authority on WHICH quests exist
// right now; the API stays the authority on ids, objectives with map points,
// and everything else it already serves. Three moves, all recorded in a
// drift report so nobody has to scrape the wiki by hand every wipe:
//
//  - synthesize: quest in the wiki table but absent from the API -> add a
//    task with a "wiki-" id. It disappears automatically on the first
//    snapshot run where the API serves the quest (the wiki entry then
//    matches and nothing is synthesized).
//  - drop: task whose name (and formerName) no longer appears in the wiki
//    table -> removed from the game, excluded from the snapshot. The
//    allowlist in manual/wiki-sync.json keeps exceptions (operational
//    tasks, event quests the wiki does not list).
//  - patch: task in both -> adopt the wiki's XP, level requirement, kappa
//    flag, and prerequisites. The 1.1 convention: a page without a "Must be
//    level N" line is loyalty-gated, i.e. minPlayerLevel 1. Wiki pages can
//    carry stale leftovers; manual/task-overrides.json applies after this
//    pass and has the final say.

import { normalizeQuestName } from './wikiQuests.mjs';

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function applyWikiSync({ tasks, maps, traderIdByName, index, pages, config }) {
  const drift = { synthesized: [], dropped: [], patched: [], notes: [] };
  const keep = new Set(config?.keepDespiteWikiAbsence ?? []);
  const wikiTraders = new Set(index.map((q) => q.trader));

  const byNorm = new Map();
  const register = (name, task) => {
    const key = normalizeQuestName(name);
    if (!byNorm.has(key)) byNorm.set(key, []);
    if (!byNorm.get(key).includes(task)) byNorm.get(key).push(task);
  };
  for (const task of tasks) {
    register(task.name, task);
    if (task.formerName) register(task.formerName, task);
  }

  // --- phase 1: partition, create synthetic shells so prerequisite
  // resolution can see wiki-only quests as targets too ----------------------
  const matchedTaskIds = new Set();
  const matchedQuests = [];
  const syntheticSpecs = [];
  for (const quest of index) {
    const matched = byNorm.get(normalizeQuestName(quest.name)) ?? [];
    if (matched.length > 0) {
      matched.forEach((t) => matchedTaskIds.add(t.id));
      matchedQuests.push({ quest, matched });
      continue;
    }
    const traderId = traderIdByName.get(quest.trader);
    if (!traderId) {
      drift.notes.push(`"${quest.name}": trader "${quest.trader}" unknown to the API, not synthesized`);
      continue;
    }
    const cleanName = quest.name.replace(/\s*\(quest\)\s*$/i, '');
    const slug = slugify(cleanName);
    const page = pages.get(quest.name);
    const task = {
      id: `wiki-${slug}`,
      name: cleanName,
      normalizedName: slug,
      modes: ['pvp', 'pve'],
      trader: { id: traderId, name: quest.trader },
      mapId: null,
      minPlayerLevel: page?.level ?? 1,
      factionName: 'Any',
      kappaRequired: page?.kappa ?? false,
      wikiLink: `https://escapefromtarkov.fandom.com/wiki/${encodeURIComponent(quest.name.replace(/ /g, '_'))}`,
      experience: quest.exp ?? 0,
      taskRequirements: [],
      objectives: quest.objectives.map((o, i) => ({
        id: `wiki-${slug}-${i}`,
        type: 'wiki',
        description: o.text,
        optional: o.optional,
        maps: maps.filter((m) => o.text.includes(m.name)).map((m) => m.id),
        points: [],
      })),
      wikiOnly: true,
    };
    syntheticSpecs.push({ quest, task, page });
    register(quest.name, task);
    drift.synthesized.push({ id: task.id, name: cleanName, trader: quest.trader });
  }

  const resolvePrereqs = (names, context) => {
    const reqs = [];
    for (const name of names) {
      const matched = byNorm.get(normalizeQuestName(name)) ?? [];
      if (matched.length === 0) {
        drift.notes.push(`${context}: prerequisite "${name}" not resolvable, dropped`);
        continue;
      }
      if (matched.length > 1) {
        drift.notes.push(`${context}: prerequisite "${name}" matches ${matched.length} tasks, using first`);
      }
      reqs.push({ taskId: matched[0].id, status: ['complete'] });
    }
    return reqs;
  };

  // --- phase 2: patch matched tasks, fill synthetic prerequisites ---------
  for (const { quest, matched } of matchedQuests) {
    const page = pages.get(quest.name);
    for (const task of matched) {
      const fields = {};
      if (quest.exp != null && quest.exp !== task.experience) {
        fields.experience = [task.experience, quest.exp];
        task.experience = quest.exp;
      }
      if (page) {
        const level = page.level ?? 1;
        if (level !== task.minPlayerLevel) {
          fields.minPlayerLevel = [task.minPlayerLevel, level];
          task.minPlayerLevel = level;
        }
        if (page.kappa != null && page.kappa !== task.kappaRequired) {
          fields.kappaRequired = [task.kappaRequired, page.kappa];
          task.kappaRequired = page.kappa;
        }
        if (page.previous != null) {
          // A "#section" link (Collector's kappa list) or a fully
          // unresolvable set means the infobox can't be interpreted as a
          // task list - keep the API's chain rather than un-gating the quest.
          const sectionLink = page.previous.some((n) => n.includes('#'));
          const reqs = sectionLink ? [] : resolvePrereqs(page.previous, quest.name);
          const uninterpretable =
            sectionLink || (page.previous.length > 0 && reqs.length === 0);
          if (!uninterpretable) {
            const before = task.taskRequirements.map((r) => r.taskId).sort().join();
            const after = reqs.map((r) => r.taskId).sort().join();
            if (before !== after) {
              fields.taskRequirements = [before || '(none)', after || '(none)'];
              task.taskRequirements = reqs;
            }
          } else if (sectionLink) {
            drift.notes.push(`${quest.name}: prerequisites are a section link, keeping API chain`);
          }
        }
      }
      if (Object.keys(fields).length > 0) {
        drift.patched.push({ id: task.id, name: task.name, fields });
      }
    }
  }
  for (const { quest, task, page } of syntheticSpecs) {
    if (page?.previous) {
      task.taskRequirements = resolvePrereqs(page.previous, quest.name);
    }
  }

  // --- phase 3: drop tasks gone from the wiki table -----------------------
  const synced = tasks.filter((task) => {
    if (matchedTaskIds.has(task.id)) return true;
    if (!wikiTraders.has(task.trader.name)) return true; // trader not in the table at all
    if (keep.has(task.id) || keep.has(task.name)) return true;
    drift.dropped.push({
      id: task.id,
      name: task.name,
      trader: task.trader.name,
      minPlayerLevel: task.minPlayerLevel,
    });
    return false;
  });

  synced.push(...syntheticSpecs.map((s) => s.task));
  return { tasks: synced, drift };
}
