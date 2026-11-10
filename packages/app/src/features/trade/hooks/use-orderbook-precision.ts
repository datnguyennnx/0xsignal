import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateTickSizeOptions } from "./use-hyperliquid-orderbook";
import {
  getEffectiveNSigFigs,
  shouldApplyInitialPrecisionSync,
  type PriceScalingState,
} from "../utils/orderbook-widget-shared";
import { useTradeUIStore } from "@/stores/use-trade-ui-store";
import { DEFAULT_SIG_FIGS } from "@/core/utils/formatters";

interface BookPrices {
  bids: Array<{ price: number }>;
  asks: Array<{ price: number }>;
}

// The sets remember per-symbol sync flags for the life of the view, so a long
// session visiting thousands of markets would grow them without bound.
const MAX_TRACKED_SYMBOLS = 64;

const trackSymbol = (set: Set<string>, symbol: string): void => {
  set.delete(symbol);
  set.add(symbol);
  if (set.size <= MAX_TRACKED_SYMBOLS) return;
  // Evicting the oldest entry only costs one re-sync for a symbol unseen in
  // 64 switches; that is cheaper than an unbounded set.
  const oldest = set.values().next().value;
  if (oldest !== undefined) set.delete(oldest);
};

export function useOrderbookPrecision(symbol: string, orderbook: BookPrices | undefined) {
  const setNSigFigs = useTradeUIStore((s) => s.setNSigFigs);

  const [selectedNSigFigs, setSelectedNSigFigs] = useState<PriceScalingState | null>(null);
  const initialSyncedSymbolsRef = useRef<Set<string>>(new Set());
  const userInteractedSymbolsRef = useRef<Set<string>>(new Set());

  const bestAskPrice = orderbook?.asks[0]?.price;
  const bestBidPrice = orderbook?.bids[0]?.price;
  const bestPrice = bestAskPrice ?? bestBidPrice ?? 0;

  const scalingOptions = useMemo(() => generateTickSizeOptions(bestPrice), [bestPrice]);

  const effectiveNSigFigs = useMemo(
    () => getEffectiveNSigFigs(selectedNSigFigs, symbol, scalingOptions),
    [selectedNSigFigs, symbol, scalingOptions],
  );

  useEffect(() => {
    if (!orderbook || scalingOptions.length === 0) return;

    if (
      !shouldApplyInitialPrecisionSync({
        symbol,
        userPriceScaling: selectedNSigFigs,
        hasSyncedForSymbol: initialSyncedSymbolsRef.current.has(symbol),
        userInteracted: userInteractedSymbolsRef.current.has(symbol),
      })
    ) {
      return;
    }

    const first = scalingOptions[0];
    setNSigFigs(first.nSigFigs ?? DEFAULT_SIG_FIGS);
    trackSymbol(initialSyncedSymbolsRef.current, symbol);
  }, [orderbook, scalingOptions, symbol, selectedNSigFigs, setNSigFigs]);

  const handleNSigFigsChange = useCallback(
    (newValue: number) => {
      const opt = scalingOptions.find((o) => o.value === newValue);
      const nextSig = opt?.nSigFigs ?? null;

      setSelectedNSigFigs({ symbol, value: newValue });
      trackSymbol(userInteractedSymbolsRef.current, symbol);
      setNSigFigs(nextSig);
    },
    [scalingOptions, symbol, setNSigFigs],
  );

  return { effectiveNSigFigs, scalingOptions, handleNSigFigsChange };
}
