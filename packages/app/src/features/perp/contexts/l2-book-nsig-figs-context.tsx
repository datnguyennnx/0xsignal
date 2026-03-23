/**
 * @overview L2 Book SigFigs Context
 *
 * Manages the shared `nSigFigs` (precision/aggregation) for Hyperliquid L2 subscriptions.
 * Ensures that Orderbook and Depth Chart components are synchronized to the same authoritative data stream.
 *
 * @mechanism
 * - Hyperliquid `l2Book` subscription takes `nSigFigs` (2–5) for server-side price precision.
 * - This context prevents independent components from requesting different precision levels for the same symbol.
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
