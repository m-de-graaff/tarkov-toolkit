import { useEffect, useRef, useState } from 'react';
import { usePlanner } from '../store';
import { fetchPrices, loadCachedPrices, type CachedPrices } from './prices';

export interface PricesState {
  cached: CachedPrices | null;
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
}

/**
 * Live flea prices for the active game mode: cache first. The ~16MB payload
 * is fetched automatically only when NO cache exists for the mode (first
 * visit); after that, re-downloading is always user-triggered via refresh().
 * A stale cache renders as-is - pages show its age next to the refresh
 * button. Auto-fetching is disabled under tests so pages render
 * deterministically offline.
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
      // only a missing cache warrants an unsolicited ~16MB download
      if (!existing) void refresh();
    });
    return () => {
      disposed = true;
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
