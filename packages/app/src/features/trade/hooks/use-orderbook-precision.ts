import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generateTickSizeOptions } from "./use-hyperliquid-orderbook";
import {
  getEffectiveNSigFigs,
  shouldApplyInitialPrecisionSync,
  type PriceScalingState,
} from "../utils/orderbook-widget-shared";
import { useTradeUIStore } from "@/stores/use-trade-ui-store";

interface BookPrices {
  bids: Array<{ price: number }>;
  asks: Array<{ price: number }>;
}

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
    setNSigFigs(first.nSigFigs ?? 5);
    initialSyncedSymbolsRef.current.add(symbol);
  }, [orderbook, scalingOptions, symbol, selectedNSigFigs, setNSigFigs]);

  const handleNSigFigsChange = useCallback(
    (newValue: number) => {
      const opt = scalingOptions.find((o) => o.value === newValue);
      const nextSig = opt?.nSigFigs ?? null;

      setSelectedNSigFigs({ symbol, value: newValue });
      userInteractedSymbolsRef.current.add(symbol);
      setNSigFigs(nextSig);
    },
    [scalingOptions, symbol, setNSigFigs],
  );

  return { effectiveNSigFigs, scalingOptions, handleNSigFigsChange };
}
