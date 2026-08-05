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

/**
 * Best XP crafts grouped per station.
 *
 * - ignoreCost: shortest first - points per hour is 5 / duration, so short
 *   crafts win outright and no price data is needed.
 * - cost-aware: minimizes materials + the value of the station-hours spent,
 *   i.e. cheap AND short beats cheap-but-day-long and short-but-goldplated.
 */
export function bestCraftsPerStation(
  crafts: RpCraft[],
  prices: ItemPrices | null,
  hideoutLevels: Record<string, number>,
  opts: { onlyBuilt: boolean; ignoreCost: boolean; perStation?: number },
): StationCraftGroup[] {
  const perStation = opts.perStation ?? 3;
  const byStation = new Map<string, CraftingLevelingRow[]>();

  for (const craft of crafts) {
    if (craft.durationSeconds <= 0) continue;
    if (opts.onlyBuilt && (hideoutLevels[craft.stationId] ?? 0) < craft.stationLevel) continue;
    let materialCost = 0;
    if (!opts.ignoreCost) {
      if (!prices) continue;
      const cost = craftMaterialCost(craft, prices);
      if (cost === null) continue;
      materialCost = cost;
    }
    const list = byStation.get(craft.stationId) ?? [];
    list.push({
      craft,
      materialCost,
      costPerPoint: Math.round(materialCost / POINTS_PER_CRAFT),
    });
    byStation.set(craft.stationId, list);
  }

  const groups: StationCraftGroup[] = [];
  for (const [stationId, rows] of byStation) {
    rows.sort(
      opts.ignoreCost
        ? (a, b) =>
            a.craft.durationSeconds - b.craft.durationSeconds || a.materialCost - b.materialCost
        : (a, b) =>
            scoreCostAware(a) - scoreCostAware(b) ||
            a.craft.durationSeconds - b.craft.durationSeconds,
    );
    const top = rows.slice(0, perStation);
    const pairHours =
      top.length >= 2
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

/** Materials plus the value of the station time a run consumes; lower is better. */
function scoreCostAware(row: CraftingLevelingRow): number {
  return row.materialCost + TIME_VALUE_RUB_PER_HOUR * (row.craft.durationSeconds / 3600);
}
