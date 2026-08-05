import { useEffect, useRef, useState } from 'react';
import { usePlanner } from '../store';
import { fetchPrices, loadCachedPrices, type CachedPrices } from './prices';

const STALE_MS = 10 * 60 * 1000;

export interface PricesState {
  cached: CachedPrices | null;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
}

/**
 * Live flea prices for the active game mode: cache first, auto-fetch when
 * missing or stale, refreshed on an interval while mounted. Auto-fetching is
 * disabled under tests so pages render deterministically offline.
 */
export function usePrices(): PricesState {
  const gameMode = usePlanner((s) => s.gameMode);
  const [cached, setCached] = useState<CachedPrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    setCached(null);
    setError(null);

    const refresh = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setLoading(true);
      try {
        const fresh = await fetchPrices(gameMode);
        if (!disposed) {
          setCached(fresh);
          setError(null);
        }
      } catch {
        if (!disposed) setError("Couldn't fetch prices. Are you online?");
      } finally {
        fetchingRef.current = false;
        if (!disposed) setLoading(false);
      }
    };

    void loadCachedPrices(gameMode).then((existing) => {
      if (disposed) return;
      if (existing) setCached(existing);
      if (import.meta.env.MODE === 'test') return;
      if (!existing || Date.now() - existing.fetchedAt > STALE_MS) void refresh();
    });
    const interval =
      import.meta.env.MODE === 'test' ? null : setInterval(() => void refresh(), STALE_MS);
    return () => {
      disposed = true;
      if (interval) clearInterval(interval);
    };
  }, [gameMode]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setCached(await fetchPrices(usePlanner.getState().gameMode));
    } catch {
      setError("Couldn't fetch prices. Are you online?");
    } finally {
      setLoading(false);
    }
  };

  return { cached, loading, error, refresh };
}
