import type { RpMap } from '@raidplanner/data';
import { useEffect, useState } from 'react';
import type { Navigator } from './navGrid';
import { makeNavigator } from './navGrid';
import { loadNavGrid } from './svgNav';

/**
 * The walkability navigator for a map, or null while loading / when the map
 * has no SVG data. Grids are rasterized once per map and cached for the
 * session; routes fall back to straight lines until the grid is ready.
 */
export function useNavGrid(map: RpMap | undefined): Navigator | null {
  const [nav, setNav] = useState<Navigator | null>(null);
  const mapId = map?.id;
  const cal = map?.calibration;

  useEffect(() => {
    let alive = true;
    setNav(null);
    if (!mapId || !cal?.svgFile) return;
    void loadNavGrid(mapId, cal).then((grid) => {
      if (alive && grid) setNav(makeNavigator(grid));
    });
    return () => {
      alive = false;
    };
  }, [mapId, cal]);

  return nav;
}
