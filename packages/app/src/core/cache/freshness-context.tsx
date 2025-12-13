/** Data Freshness Context - Global tracking of data fetch timestamps */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface FreshnessState {
  dashboard: Date | null;
  treasury: Date | null;
  buyback: Date | null;
  asset: Date | null;
}

interface FreshnessContextValue extends FreshnessState {
  recordFetch: (key: keyof FreshnessState) => void;
  getLatestFetch: () => Date | null;
}

const FreshnessContext = createContext<FreshnessContextValue | null>(null);

export function FreshnessProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FreshnessState>({
    dashboard: null,
    treasury: null,
    buyback: null,
    asset: null,
  });

  const recordFetch = useCallback((key: keyof FreshnessState) => {
    setState((prev) => ({ ...prev, [key]: new Date() }));
  }, []);

  const getLatestFetch = useCallback((): Date | null => {
    const timestamps = Object.values(state).filter(Boolean) as Date[];
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps.map((d) => d.getTime())));
  }, [state]);

  return (
    <FreshnessContext.Provider value={{ ...state, recordFetch, getLatestFetch }}>
      {children}
    </FreshnessContext.Provider>
  );
}

export function useFreshness() {
  const ctx = useContext(FreshnessContext);
  if (!ctx) {
    // Return no-op if outside of provider
    return {
      dashboard: null,
      treasury: null,
      buyback: null,
      asset: null,
      recordFetch: () => {},
      getLatestFetch: () => null,
    };
  }
  return ctx;
}
