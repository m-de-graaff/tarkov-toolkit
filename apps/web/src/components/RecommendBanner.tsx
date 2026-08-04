import { snapshot } from '@raidplanner/data';
import { useMemo } from 'react';
import { recommendMaps } from '../lib/recommend';
import { usePlanner } from '../store';

export function RecommendBanner() {
  const tracker = usePlanner((s) => s.tracker);
  const selectedMapId = usePlanner((s) => s.selectedMapId);
  const selectMap = usePlanner((s) => s.selectMap);

  const top = useMemo(() => recommendMaps(snapshot, tracker).slice(0, 3), [tracker]);

  if (top.length === 0 || top[0].mapId === selectedMapId) return null;

  return (
    <div className="recommend-banner">
      <span>Best maps for your open quests:</span>
      {top.map((score) => (
        <button key={score.mapId} type="button" onClick={() => selectMap(score.mapId)}>
          {score.mapName} ({score.availableQuestCount})
        </button>
      ))}
    </div>
  );
}
