import type { RpCraft } from '@raidplanner/data';
import { snapshot } from '@raidplanner/data';
import { craftMaterialCost, type ItemPrices } from './profit';

export interface CraftingLevelingRow {
  craft: RpCraft;
  materialCost: number;
  /** roubles burned per hour of continuous crafting; lower is better */
  costPerHour: number;
}

/**
 * Crafting skill XP accrues with production time, so the cheapest way to
 * power-level is keeping stations busy with the lowest material cost per
 * crafting hour. Short cheap crafts also let you requeue often.
 */
export function craftingLevelingRows(
  crafts: RpCraft[],
  prices: ItemPrices,
  hideoutLevels: Record<string, number>,
  onlyBuilt: boolean,
): CraftingLevelingRow[] {
  const rows: CraftingLevelingRow[] = [];
  for (const craft of crafts) {
    if (craft.durationSeconds <= 0) continue;
    if (onlyBuilt && (hideoutLevels[craft.stationId] ?? 0) < craft.stationLevel) continue;
    const materialCost = craftMaterialCost(craft, prices);
    if (materialCost === null) continue;
    rows.push({
      craft,
      materialCost,
      costPerHour: Math.round(materialCost / (craft.durationSeconds / 3600)),
    });
  }
  return rows.sort(
    (a, b) => a.costPerHour - b.costPerHour || a.craft.durationSeconds - b.craft.durationSeconds,
  );
}

export function stationName(stationId: string): string {
  return snapshot.hideout.find((s) => s.id === stationId)?.name ?? 'Station';
}
