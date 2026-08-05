import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { snapshot } from '@raidplanner/data';
import { MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STORY_WIKI_URL, storyChapters } from '../data/storyline';
import { usePlanner } from '../store';

const mapByNormalized = (normalized: string) =>
  snapshot.maps.find((m) => m.normalizedName === normalized);

/**
 * A chapter's map as a chip. Renderable maps deep-link into the planner -
 * "where do I need to be" is one click from "what do I need to do".
 */
function MapChip({ normalized, starts }: { normalized: string; starts?: boolean }) {
  const navigate = useNavigate();
  const selectMap = usePlanner((s) => s.selectMap);
  const map = mapByNormalized(normalized);
  const name = map?.name ?? normalized;
  const label = starts ? `Starts on ${name}` : name;
  if (!map?.calibration) {
    return (
      <Badge variant="outline" className="px-1.5 text-[10px] text-muted-foreground">
        {label}
      </Badge>
    );
  }
  return (
    <button
      type="button"
      title={`Open ${name} in the planner`}
      onClick={() => {
        selectMap(map.id);
        navigate('/planner');
      }}
      className={cn(
        'story-map-chip flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors',
        starts
          ? 'border-primary/60 bg-accent text-primary hover:bg-accent/80'
          : 'text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      <MapPin aria-hidden="true" className="size-3 shrink-0" />
      {label}
    </button>
  );
}

/**
 * The storyline as a guided timeline: finished chapters collapse, the first
 * unfinished chapter is "you are here" with its trigger and maps front and
 * center, later chapters stay readable but quiet. Chapters remain tickable in
 * any order - the game lets players skip around, so the UI must too.
 */
export function StoryTimeline() {
  const done = usePlanner((s) => s.tracker.storyChapterIds) ?? [];
  const toggleStoryChapter = usePlanner((s) => s.toggleStoryChapter);
  const currentId = storyChapters.find((c) => !done.includes(c.id))?.id;
  const pct = Math.round((done.length / storyChapters.length) * 100);

  return (
    <section aria-label="Story chapters" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Storyline
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done.length}/{storyChapters.length} chapters
        </span>
        <span
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Story completion"
          className="block h-1.5 w-32 overflow-hidden rounded-full bg-secondary"
        >
          <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
        </span>
        <a
          href={STORY_WIKI_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-xs text-primary/70 underline-offset-2 hover:underline"
        >
          wiki
        </a>
      </div>

      <ol className="m-0 flex list-none flex-col p-0">
        {storyChapters.map((chapter, index) => {
          const finished = done.includes(chapter.id);
          const current = chapter.id === currentId;
          const last = index === storyChapters.length - 1;
          return (
            <li key={chapter.id} className="story-step relative flex gap-3">
              {/* rail: the checkbox is the timeline dot; the line connects steps */}
              <span className="flex flex-col items-center pt-1.5">
                <input
                  type="checkbox"
                  checked={finished}
                  onChange={() => toggleStoryChapter(chapter.id)}
                  aria-label={`Mark chapter ${chapter.name} as finished`}
                  className={cn(
                    'size-4 shrink-0 cursor-pointer accent-primary',
                    current && 'outline-2 outline-offset-2 outline-primary/50',
                  )}
                />
                {!last && <span aria-hidden="true" className="w-px flex-1 bg-border" />}
              </span>

              <div className={cn('min-w-0 flex-1', last ? 'pb-1' : 'pb-4')}>
                {finished ? (
                  <p className="pt-1 text-sm font-medium text-muted-foreground line-through">
                    {chapter.order}. {chapter.name}
                  </p>
                ) : current ? (
                  <div className="rounded-lg border border-primary/60 bg-card p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-primary">
                      Current chapter
                    </p>
                    <h3 className="mt-0.5 text-balance text-sm font-semibold">
                      {chapter.order}. {chapter.name}
                    </h3>
                    <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      How to start
                    </p>
                    <p className="mt-0.5 text-pretty text-[13px]">{chapter.start}</p>
                    {chapter.notes && (
                      <p className="mt-1.5 text-pretty text-xs text-muted-foreground">
                        {chapter.notes}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {chapter.startMap && <MapChip normalized={chapter.startMap} starts />}
                      {chapter.maps
                        .filter((m) => m !== chapter.startMap)
                        .map((m) => (
                          <MapChip key={m} normalized={m} />
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="pt-1">
                    <h3 className="text-sm font-medium">
                      {chapter.order}. {chapter.name}
                    </h3>
                    <p className="mt-0.5 text-pretty text-xs text-muted-foreground">
                      {chapter.start}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {chapter.maps.slice(0, 4).map((m) => (
                        <Badge
                          key={m}
                          variant="outline"
                          className="px-1.5 text-[10px] text-muted-foreground"
                        >
                          {mapByNormalized(m)?.name ?? m}
                        </Badge>
                      ))}
                      {chapter.maps.length > 4 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{chapter.maps.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
