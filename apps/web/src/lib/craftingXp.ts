import type { RpCraft } from '@raidplanner/data';
import { snapshot } from '@raidplanner/data';
import { craftMaterialCost, type ItemPrices } from './profit';

/**
 * Crafting skill XP (wiki, verified Aug 2026): 5 points per completed craft,
 * but ONLY when the station alternates between two different recipes -
 * repeating one recipe back-to-back grants nothing. A small time drip
 * (~1.5 points per 8h of total crafting) accrues on top regardless.
 * So the plan per station is: alternate its two best short crafts.
 */
export const POINTS_PER_CRAFT = 5;

/** Roubles one hour of station time is worth when trading cost against speed:
 * paying this much extra in materials to finish an hour sooner breaks even. */
const TIME_VALUE_RUB_PER_HOUR = 20_000;

export interface CraftingLevelingRow {
  craft: RpCraft;
  materialCost: number;
  /** roubles of materials per skill point (materialCost / 5) */
  costPerPoint: number;
}

export interface StationCraftGroup {
  stationId: string;
  stationName: string;
  /** best crafts for this station, best first - alternate the top two */
  rows: CraftingLevelingRow[];
  /** skill points per hour when alternating the top two crafts; null when the
   * station has only one recipe (no alternation partner = no craft bonus) */
  pairPointsPerHour: number | null;
}

export function stationName(stationId: string): string {
  return snapshot.hideout.find((s) => s.id === stationId)?.name ?? 'Station';
}

export type CraftRanking =
  | { mode: 'value' }
  | { mode: 'shortest' }
  /** fill a fixed away-window (going to bed, going to work) as fully as possible */
  | { mode: 'window'; hours: number };

/**
 * Locked-crate openings (Unlocked equipment crate, valuables crate, ...) are
 * technically Workbench crafts but need a crate you cannot buy - never
 * recommend them.
 */
export function isCrateUnlock(craft: RpCraft, nameOf: (itemId: string) => string): boolean {
  return (
    craft.rewardItems.some((r) => /^unlocked .* crate/i.test(nameOf(r.itemId))) ||
    craft.requiredItems.some((r) => !r.tool && /^locked .* crate/i.test(nameOf(r.itemId)))
  );
}

/**
 * Best XP crafts grouped per station.
 *
 * - value: minimizes materials + the value of the station-hours spent,
 *   i.e. cheap AND short beats cheap-but-day-long and short-but-goldplated.
 * - shortest: shortest first - points per hour is 5 / duration, so short
 *   crafts win outright and no price data is needed.
 * - window: you are away for N hours; a station earns the most by running one
 *   craft that fills as much of that window as possible (idle hours are
 *   wasted), so minimize materials + the value of the hours left idle.
 *   Works without prices - it then simply favors the best-filling craft.
 */
export function bestCraftsPerStation(
  crafts: RpCraft[],
  prices: ItemPrices | null,
  hideoutLevels: Record<string, number>,
  opts: {
    onlyBuilt: boolean;
    ranking: CraftRanking;
    blockedIds?: ReadonlySet<string>;
    perStation?: number;
  },
): StationCraftGroup[] {
  const perStation = opts.perStation ?? 3;
  const { ranking } = opts;
  const needsPrices = ranking.mode === 'value';
  const windowSeconds = ranking.mode === 'window' ? ranking.hours * 3600 : null;
  const byStation = new Map<string, CraftingLevelingRow[]>();

  for (const craft of crafts) {
    if (craft.durationSeconds <= 0) continue;
    if (opts.blockedIds?.has(craft.id)) continue;
    if (isCrateUnlock(craft, (id) => snapshot.itemsLite[id]?.name ?? '')) continue;
    if (opts.onlyBuilt && (hideoutLevels[craft.stationId] ?? 0) < craft.stationLevel) continue;
    if (windowSeconds !== null && craft.durationSeconds > windowSeconds) continue;
    let materialCost = 0;
    if (prices) {
      const cost = craftMaterialCost(craft, prices);
      if (cost === null) {
        if (needsPrices) continue;
      } else {
        materialCost = cost;
      }
    } else if (needsPrices) {
      continue;
    }
    const list = byStation.get(craft.stationId) ?? [];
    list.push({
      craft,
      materialCost,
      costPerPoint: Math.round(materialCost / POINTS_PER_CRAFT),
    });
    byStation.set(craft.stationId, list);
  }

  const score = (row: CraftingLevelingRow): number => {
    const hours = row.craft.durationSeconds / 3600;
    if (ranking.mode === 'shortest') return row.craft.durationSeconds;
    if (ranking.mode === 'window') {
      return row.materialCost + TIME_VALUE_RUB_PER_HOUR * (ranking.hours - hours);
    }
    return row.materialCost + TIME_VALUE_RUB_PER_HOUR * hours;
  };

  const groups: StationCraftGroup[] = [];
  for (const [stationId, rows] of byStation) {
    rows.sort(
      (a, b) =>
        score(a) - score(b) ||
        a.materialCost - b.materialCost ||
        a.craft.durationSeconds - b.craft.durationSeconds,
    );
    const top = rows.slice(0, perStation);
    const pairHours =
      ranking.mode !== 'window' && top.length >= 2
        ? (top[0].craft.durationSeconds + top[1].craft.durationSeconds) / 3600
        : null;
    groups.push({
      stationId,
      stationName: stationName(stationId),
      rows: top,
      pairPointsPerHour: pairHours ? (2 * POINTS_PER_CRAFT) / pairHours : null,
    });
  }
  return groups.sort((a, b) => a.stationName.localeCompare(b.stationName));
}
