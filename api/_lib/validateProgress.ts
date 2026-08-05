// Server-side validation of the synced progress blob. The client normalizes
// too, but the server must not store shapes that would brick other devices'
// sync on pull (e.g. a non-array completedTaskIds throws in the client merge).
// Hand-rolled on purpose: no runtime deps in functions.

const MODES = new Set(['pvp', 'pve']);
const FACTIONS = new Set(['Any', 'USEC', 'BEAR']);
const MAX_IDS = 5000;
const MAX_BLACKLIST = 2000;
const MAX_KEY_LEN = 200;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isStringArray = (v: unknown, max: number): boolean =>
  Array.isArray(v) &&
  v.length <= max &&
  v.every((s) => typeof s === 'string' && s.length <= MAX_KEY_LEN);

const isNumberRecord = (v: unknown): boolean =>
  isObject(v) &&
  Object.entries(v).every(
    ([k, n]) =>
      k.length <= MAX_KEY_LEN && typeof n === 'number' && Number.isFinite(n) && n >= 0,
  );

function trackerError(v: unknown, path: string): string | null {
  if (!isObject(v)) return `${path} must be an object`;
  const level = v.level;
  if (typeof level !== 'number' || !Number.isFinite(level) || level < 1 || level > 79)
    return `${path}.level must be a number between 1 and 79`;
  if (typeof v.faction !== 'string' || !FACTIONS.has(v.faction))
    return `${path}.faction must be one of Any, USEC, BEAR`;
  if (!isStringArray(v.completedTaskIds, MAX_IDS))
    return `${path}.completedTaskIds must be an array of at most ${MAX_IDS} ids`;
  if (v.hideoutLevels !== undefined && !isNumberRecord(v.hideoutLevels))
    return `${path}.hideoutLevels must map ids to non-negative numbers`;
  if (v.itemsHave !== undefined && !isNumberRecord(v.itemsHave))
    return `${path}.itemsHave must map ids to non-negative numbers`;
  return null;
}

/** Returns an error message, or null when the state is acceptable. */
export function validateSyncedState(value: unknown): string | null {
  if (!isObject(value)) return 'state must be an object';
  if (typeof value.gameMode !== 'string' || !MODES.has(value.gameMode))
    return 'state.gameMode must be pvp or pve';
  const trackerErr = trackerError(value.tracker, 'state.tracker');
  if (trackerErr) return trackerErr;
  if (value.profiles !== undefined) {
    if (!isObject(value.profiles)) return 'state.profiles must be an object';
    for (const [mode, tracker] of Object.entries(value.profiles)) {
      if (!MODES.has(mode)) return `state.profiles has unknown mode "${mode}"`;
      const err = trackerError(tracker, `state.profiles.${mode}`);
      if (err) return err;
    }
  }
  if (value.craftBlacklist !== undefined && !isStringArray(value.craftBlacklist, MAX_BLACKLIST))
    return `state.craftBlacklist must be an array of at most ${MAX_BLACKLIST} ids`;
  return null;
}
