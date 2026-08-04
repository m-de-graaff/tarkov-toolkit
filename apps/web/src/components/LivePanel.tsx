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

  if (!liveFix || receivedAt === null) return <span className="live-age">no fix yet</span>;
  const seconds = Math.max(0, Math.round((Date.now() - receivedAt) / 1000));
  return <span className="live-age">fix {seconds}s ago</span>;
}

export function LivePanel({
  watcher,
  outOfBounds,
}: {
  watcher: LiveWatcher;
  outOfBounds: boolean;
}) {
  if (!watcher.supported) {
    return <span className="live-unsupported">Live mode needs Chrome or Edge</span>;
  }
  return (
    <div className="live-panel">
      <span className={`live-dot${watcher.connected ? ' on' : ''}`} aria-hidden="true" />
      <button
        type="button"
        onClick={() => (watcher.connected ? watcher.disconnect() : void watcher.connect())}
      >
        {watcher.connected ? 'Disconnect live' : 'Connect screenshots folder'}
      </button>
      {watcher.connected && <FixAge />}
      {watcher.error && <span className="live-error">{watcher.error}</span>}
      {outOfBounds && (
        <span className="live-error">Position is outside this map — wrong map selected?</span>
      )}
    </div>
  );
}
