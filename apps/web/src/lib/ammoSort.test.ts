import type { AmmoRound } from '@raidplanner/data';
import { describe, expect, it } from 'vitest';
import { classEffectiveness, classRating, filterAmmo, penTier, sortAmmo, totalDamage } from './ammoSort';

const round = (name: string, over: Partial<AmmoRound>): AmmoRound => ({
  id: name,
  name,
  shortName: name,
  caliber: '556x45NATO',
  damage: 50,
  penetrationPower: 30,
  armorDamage: 40,
  fragmentationChance: 0.2,
  initialSpeed: 900,
  tracer: false,
  projectileCount: 1,
  ...over,
});

describe('sortAmmo', () => {
  it('sorts by the chosen key in either direction', () => {
    const rounds = [round('a', { damage: 40 }), round('b', { damage: 90 }), round('c', { damage: 60 })];
    expect(sortAmmo(rounds, 'damage', 'desc').map((r) => r.name)).toEqual(['b', 'c', 'a']);
    expect(sortAmmo(rounds, 'damage', 'asc').map((r) => r.name)).toEqual(['a', 'c', 'b']);
  });
});

describe('filterAmmo', () => {
  it('filters by caliber and search together', () => {
    const rounds = [round('M855A1', {}), round('7N40', { caliber: '545x39' })];
    expect(filterAmmo(rounds, '545x39', '').map((r) => r.name)).toEqual(['7N40']);
    expect(filterAmmo(rounds, null, 'm855').map((r) => r.name)).toEqual(['M855A1']);
    expect(filterAmmo(rounds, '545x39', 'm855')).toEqual([]);
  });
});

describe('penTier', () => {
  it('maps penetration power to armor-class tiers', () => {
    expect(penTier(5)).toBe(0);
    expect(penTier(12)).toBe(1);
    expect(penTier(20)).toBe(2);
    expect(penTier(30)).toBe(3);
    expect(penTier(44)).toBe(4);
    expect(penTier(50)).toBe(5);
    expect(penTier(70)).toBe(6);
  });
});

describe('classEffectiveness', () => {
  it('grades a round against each armor class by pen margin', () => {
    // M855A1-like: pen 44
    expect(classEffectiveness(44, 2)).toBe('excellent'); // margin +24
    expect(classEffectiveness(44, 3)).toBe('good'); // +14 → good (not excellent)
    expect(classEffectiveness(44, 4)).toBe('fair'); // +4
    expect(classEffectiveness(44, 5)).toBe('poor'); // -6
    expect(classEffectiveness(44, 6)).toBe('none'); // -16
  });

  it('maps tiers to the displayed 0-6 rating', () => {
    expect(classRating(44, 2)).toBe(6);
    expect(classRating(44, 3)).toBe(5);
    expect(classRating(44, 4)).toBe(3);
    expect(classRating(44, 5)).toBe(1);
    expect(classRating(44, 6)).toBe(0);
  });
});

describe('totalDamage', () => {
  it('multiplies pellets for buckshot', () => {
    expect(totalDamage(round('shot', { damage: 39, projectileCount: 8 }))).toBe(312);
  });
});
