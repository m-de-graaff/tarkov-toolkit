import type { AmmoRound } from '@raidplanner/data';

export type AmmoSortKey =
  | 'damage'
  | 'penetrationPower'
  | 'armorDamage'
  | 'fragmentationChance'
  | 'initialSpeed';

export function sortAmmo(
  rounds: AmmoRound[],
  key: AmmoSortKey,
  direction: 'asc' | 'desc',
): AmmoRound[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rounds].sort((a, b) => sign * (a[key] - b[key]) || a.name.localeCompare(b.name));
}

export function filterAmmo(rounds: AmmoRound[], caliber: string | null, search: string): AmmoRound[] {
  return rounds.filter((r) => {
    if (caliber && r.caliber !== caliber) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
}

/**
 * Effective armor-class tier a round reliably defeats, tarkov.dev-style
 * thresholds on penetration power. 0 = flesh only.
 */
export function penTier(penetrationPower: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  if (penetrationPower >= 58) return 6;
  if (penetrationPower >= 48) return 5;
  if (penetrationPower >= 38) return 4;
  if (penetrationPower >= 28) return 3;
  if (penetrationPower >= 18) return 2;
  if (penetrationPower >= 10) return 1;
  return 0;
}

/** total flesh damage accounting for multi-projectile rounds (buckshot) */
export function totalDamage(round: AmmoRound): number {
  return round.damage * round.projectileCount;
}

export type Effectiveness = 'excellent' | 'good' | 'fair' | 'poor' | 'none';

/**
 * How reliably a round defeats a given armor class (1..6), tarkov.dev-style:
 * each class's reference threshold is class×10 pen; margins map to tiers.
 */
export function classEffectiveness(penetrationPower: number, armorClass: number): Effectiveness {
  const threshold = armorClass * 10;
  const margin = penetrationPower - threshold;
  if (margin >= 15) return 'excellent';
  if (margin >= 5) return 'good';
  if (margin >= -5) return 'fair';
  if (margin >= -15) return 'poor';
  return 'none';
}
