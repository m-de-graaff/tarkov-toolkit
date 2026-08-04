import { isScreenshotName } from './parse.ts';

/**
 * Of the not-yet-seen names, return the latest screenshot name (EFT filenames
 * sort chronologically), or null. Marks every new name as seen either way, so
 * repeated polls stay O(new files).
 */
export function pickNewestFix(names: string[], seen: Set<string>): string | null {
  let newest: string | null = null;
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (!isScreenshotName(name)) continue;
    if (newest === null || name > newest) newest = name;
  }
  return newest;
}
