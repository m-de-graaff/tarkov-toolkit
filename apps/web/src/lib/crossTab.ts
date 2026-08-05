// Cross-tab consistency: when another tab writes the persisted store, this
// tab rehydrates instead of later clobbering the newer copy with its own
// stale snapshot. The `storage` event only fires in OTHER tabs, so this never
// reacts to our own writes.
import { PROGRESS_KEY } from './storage';

export function startCrossTabSync(rehydrate: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const onStorage = (e: StorageEvent) => {
    if (e.key !== PROGRESS_KEY || e.newValue === null) return;
    if (timer) clearTimeout(timer);
    // coalesce bursts of writes into one rehydrate
    timer = setTimeout(rehydrate, 100);
  };
  window.addEventListener('storage', onStorage);
  return () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener('storage', onStorage);
  };
}
