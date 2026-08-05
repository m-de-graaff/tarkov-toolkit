// Maps where no usable walkable-area data exists: Terminal's schematic SVG
// and Icebreaker's per-deck tile masks are too sparse to route on honestly.
// Rather than draw confident-looking lines through walls, routing is switched
// off there and the UI says so.
import type { RpMap } from '@raidplanner/data';

const UNSUPPORTED = new Set(['terminal', 'icebreaker']);

export function routingSupported(map: RpMap | undefined): boolean {
  return Boolean(map) && !UNSUPPORTED.has(map!.normalizedName);
}
