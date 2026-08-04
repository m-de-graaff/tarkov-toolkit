import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TrackerState } from '../lib/availability';
import { usePlanner } from '../store';

const FACTIONS: TrackerState['faction'][] = ['Any', 'USEC', 'BEAR'];

export function TrackerBar() {
  const tracker = usePlanner((s) => s.tracker);
  const setLevel = usePlanner((s) => s.setLevel);
  const setFaction = usePlanner((s) => s.setFaction);

  return (
    <div className="flex items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>Level</span>
        <Input
          type="number"
          min={1}
          max={79}
          value={tracker.level}
          onChange={(e) => setLevel(Number(e.target.value) || 1)}
          className="h-8 w-20 tabular-nums"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span>Faction</span>
        <Select
          value={tracker.faction}
          onValueChange={(v) => setFaction(v as TrackerState['faction'])}
        >
          <SelectTrigger className="h-8 w-24" aria-label="Faction">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FACTIONS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <span
        className="ml-auto pb-1 text-xs text-muted-foreground tabular-nums"
        title="Quests marked as done"
      >
        {tracker.completedTaskIds.length} done
      </span>
    </div>
  );
}
