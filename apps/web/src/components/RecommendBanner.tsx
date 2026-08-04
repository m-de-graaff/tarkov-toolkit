import { Button } from '@/components/ui/button';
import { snapshot } from '@raidplanner/data';
import { useMemo } from 'react';
import { snapshotForMode } from '../lib/modeTasks';
import { recommendMaps } from '../lib/recommend';
import { usePlanner } from '../store';

export function RecommendBanner() {
  const tracker = usePlanner((s) => s.tracker);
  const selectedMapId = usePlanner((s) => s.selectedMapId);
  const selectMap = usePlanner((s) => s.selectMap);

  const gameMode = usePlanner((s) => s.gameMode);
  const top = useMemo(
    () => recommendMaps(snapshotForMode(snapshot, gameMode), tracker).slice(0, 3),
    [tracker, gameMode],
  );

  if (top.length === 0 || top[0].mapId === selectedMapId) return null;

  return (
    <div className="recommend-banner flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
      <span>Best maps for your open quests:</span>
      {top.map((score) => (
        <Button
          key={score.mapId}
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-primary/50 text-xs text-primary tabular-nums hover:border-primary"
          onClick={() => selectMap(score.mapId)}
        >
          {score.mapName} ({score.availableQuestCount})
        </Button>
      ))}
    </div>
  );
}
