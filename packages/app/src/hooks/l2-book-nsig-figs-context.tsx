/**
 * Shared Hyperliquid L2 `nSigFigs` for a symbol when Orderbook + Depth chart mount together.
 *
 * Hyperliquid `l2Book` subscription takes `nSigFigs` (2–5): server-side price precision / bucketing
 * for the snapshot — not the same as client `groupLevels` step, but the **authoritative** book
 * aggregation for that stream.
 *
 * Without this context, OrderbookWidget and DepthChart each run `useHyperliquidOrderbook` with
 * independent state (manual tick dropdown vs adaptive zoom), so the displayed `nSigFigs` can differ.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const DEFAULT_N_SIG_FIGS = 5;

export interface L2BookNSigFigsContextValue {
  /** Active subscription nSigFigs (2–5), aligned with Orderbook dropdown when user changes it. */
  nSigFigs: number;
  setNSigFigs: (n: number) => void;
}

const L2BookNSigFigsContext = createContext<L2BookNSigFigsContextValue | null>(null);

export function L2BookNSigFigsProvider({ children }: { children: ReactNode }) {
  const [nSigFigs, setNSigFigsState] = useState(DEFAULT_N_SIG_FIGS);

  const setNSigFigs = useCallback((n: number) => {
    const clamped = Math.max(2, Math.min(5, Math.round(n)));
    setNSigFigsState(clamped);
  }, []);

  const value = useMemo(
    () => ({
      nSigFigs,
      setNSigFigs,
    }),
    [nSigFigs, setNSigFigs]
  );

  return <L2BookNSigFigsContext.Provider value={value}>{children}</L2BookNSigFigsContext.Provider>;
}

/** Returns null when no provider (e.g. orderbook-only page) — callers use autonomous book mode. */
export function useOptionalL2BookNSigFigs(): L2BookNSigFigsContextValue | null {
  return useContext(L2BookNSigFigsContext);
}
