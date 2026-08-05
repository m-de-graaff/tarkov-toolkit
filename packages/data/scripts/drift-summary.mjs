// Prints generated/wiki-drift.json as markdown - appended to the nightly
// snapshot job's GITHUB_STEP_SUMMARY so wiki/API drift is visible per run
// without scraping anything by hand. Exits 0 always; this is reporting.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const drift = JSON.parse(
  await readFile(path.join(here, '..', 'generated', 'wiki-drift.json'), 'utf8'),
);

console.log('## Wiki catalog drift');
if (drift.skipped) {
  console.log(`Sync pass skipped: ${drift.skipped}`);
  process.exit(0);
}
const rows = (list, fmt) => list.forEach((x) => console.log(`- ${fmt(x)}`));

console.log(
  `${drift.synthesized.length} synthesized, ${drift.dropped.length} dropped, ` +
    `${drift.patched.length} patched, ${drift.manualOverrides.applied.length} manual overrides active, ` +
    `${drift.manualOverrides.retired.length} retired.`,
);
if (drift.synthesized.length > 0) {
  console.log('\n### Wiki-only quests (tarkov.dev has not caught up)');
  rows(drift.synthesized, (s) => `${s.trader}: ${s.name}`);
}
if (drift.dropped.length > 0) {
  console.log('\n### Dropped (gone from the wiki catalog)');
  rows(drift.dropped, (d) => `${d.trader}: ${d.name}`);
}
if (drift.manualOverrides.retired.length > 0) {
  console.log('\n### Manual overrides retired - delete from task-overrides.json');
  rows(drift.manualOverrides.retired, (r) => r.name);
}
