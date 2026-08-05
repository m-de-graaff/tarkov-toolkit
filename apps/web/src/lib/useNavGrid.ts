import type { RpMap } from '@raidplanner/data';
import { useEffect, useState } from 'react';
import type { Navigator } from './navGrid';
import { makeMultiNavigator } from './navGrid';
import { loadMaskNav } from './maskNav';
import { loadNavGrid } from './svgNav';

/**
 * The walkability navigator for a map, or null while loading / when the map
 * has no walkability source. SVG maps rasterize the bundled SVG; tile-only
 * maps (Lab, Labyrinth, Icebreaker) load the precomputed masks derived from
 * the tile renders. Grids are built once per map (one per floor on
 * multi-level maps) and cached for the session; routes fall back to straight
 * lines until the grids are ready.
 */
export function useNavGrid(map: RpMap | undefined): Navigator | null {
  const [nav, setNav] = useState<Navigator | null>(null);
  const mapId = map?.id;
  const cal = map?.calibration;

  useEffect(() => {
    let alive = true;
    setNav(null);
    if (!mapId || !cal) return;
    const load = cal.svgFile
      ? loadNavGrid(mapId, cal)
      : cal.navFile
        ? loadMaskNav(mapId, cal)
        : null;
    if (!load) return;
    void load.then((multi) => {
      if (alive && multi) setNav(makeMultiNavigator(multi.base, multi.layers));
    });
    return () => {
      alive = false;
    };
  }, [mapId, cal]);

  return nav;
}
