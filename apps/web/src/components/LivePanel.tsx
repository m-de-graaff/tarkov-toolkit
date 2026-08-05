import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import type { LiveWatcher } from '../lib/useLiveWatcher';
import { usePlanner } from '../store';

function FixAge() {
  const liveFix = usePlanner((s) => s.liveFix);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    setReceivedAt(liveFix ? Date.now() : null);
  }, [liveFix]);

  useEffect(() => {
    if (receivedAt === null) return;
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [receivedAt]);

  if (!liveFix || receivedAt === null) {
    return (
      <span className="text-xs text-muted-foreground">
        waiting for a screenshot — press PrtScn in raid
      </span>
    );
  }
  // The capture time lives in the filename ("2026-08-05[00-04]"); show it so a
  // pre-existing screenshot is honestly labelled rather than "0s ago".
  const takenClock = liveFix.takenAt?.slice(11, 16).replace('-', ':');
  const seconds = Math.max(0, Math.round((Date.now() - receivedAt) / 1000));
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {takenClock ? `position from ${takenClock}` : `fix ${seconds}s ago`}
    </span>
  );
}

function CompanionStatus() {
  const lastAutoEvent = usePlanner((s) => s.lastAutoEvent);
  return (
    <span className="live-auto text-xs text-muted-foreground">
      {lastAutoEvent ?? 'Companion connected — raids and quests track themselves'}
    </span>
  );
}

/** latest GitHub release of the companion — CI attaches the exe on every version tag */
export const COMPANION_DOWNLOAD_URL =
  'https://github.com/m-de-graaff/raidplanner/releases/latest';

export function LivePanel({
  watcher,
  outOfBounds,
}: {
  watcher: LiveWatcher;
  outOfBounds: boolean;
}) {
  const active = watcher.companion || watcher.connected;
  return (
    <div className="live-panel flex flex-wrap items-center gap-2 text-[13px]">
      <span
        className={cn('size-2 shrink-0 rounded-full', active ? 'bg-ok' : 'bg-muted-foreground')}
        aria-hidden="true"
      />
      <span
        className={cn('text-xs font-medium', watcher.companion ? 'text-ok' : 'text-muted-foreground')}
        title={
          watcher.companion
            ? 'The companion app is feeding positions, raids, and quest completions'
            : 'The companion app is not running'
        }
      >
        {watcher.companion ? 'Connected' : 'Disconnected'}
      </span>
      {!watcher.companion && (
        <a
          href={COMPANION_DOWNLOAD_URL}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary underline-offset-2 hover:underline"
          title="Get RaidplannerCompanion.exe from the latest GitHub release — double-click and you're live"
        >
          Don't have the companion app? Download
        </a>
      )}
      {watcher.companion ? (
        <CompanionStatus />
      ) : watcher.canResume ? (
        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-7 text-xs"
          title="Continue watching the screenshots folder you picked last time"
          onClick={() => void watcher.resume()}
        >
          Resume showing my position
        </Button>
      ) : watcher.supported ? (
        <Button
          type="button"
          variant={watcher.connected ? 'outline' : 'default'}
          size="sm"
          className="h-7 text-xs"
          title="Pick your Documents → Escape from Tarkov → Screenshots folder once; after that, pressing PrtScn in raid shows where you are. Prefer any browser? Run the companion app instead (see README)."
          onClick={() => (watcher.connected ? watcher.disconnect() : void watcher.connect())}
        >
          {watcher.connected ? 'Stop showing my position' : 'Show my position'}
        </Button>
      ) : null}
      {active && <FixAge />}
      {watcher.error && <span className="text-xs text-destructive">{watcher.error}</span>}
      {outOfBounds && (
        <span className="text-xs text-destructive">
          Position is outside this map — wrong map selected?
        </span>
      )}
    </div>
  );
}
