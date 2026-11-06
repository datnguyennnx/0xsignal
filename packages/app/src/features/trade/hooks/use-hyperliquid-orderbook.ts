import { useState, useMemo } from "react";
import { useHyperliquidWs } from "./use-hyperliquid-ws";
import { normalizeSymbol } from "../lib/symbol";
import { useOrderbookData } from "@/stores/use-market-data-store";
import { orderbookStoreKey } from "../lib/orderbook-book";
import {
  DEFAULT_SIG_FIGS,
  MAX_SIG_FIGS,
  MIN_SIG_FIGS,
  isSigFigs,
  type Precision,
} from "@/core/utils/formatters";

export interface TickSizeOption {
  value: number;
  label: string;
  nSigFigs: number | null;
  mantissa: number | null;
}

export function generateTickSizeOptions(price: number): TickSizeOption[] {
  if (!price || price <= 0) return [];
  const mag = Math.floor(Math.log10(price));
  const opts: TickSizeOption[] = [];
  for (const sig of [MAX_SIG_FIGS, 4, 3, MIN_SIG_FIGS]) {
    const step = Number(Math.pow(10, mag - sig + 1).toPrecision(10));
    const label =
      step >= 1000
        ? `${step / 1000}K`
        : step >= 1
          ? String(step)
          : step.toFixed(Math.max(0, -Math.floor(Math.log10(step))));
    opts.push({ value: sig, label, nSigFigs: sig, mantissa: null });
  }
  // "Raw" option — no aggregation, full precision
  opts.push({ value: 0, label: "Raw", nSigFigs: null, mantissa: null });
  return opts;
}

interface UseHyperliquidOrderbookOptions {
  controlledNSigFigs?: number | null;
}

const toSubscriptionSigFigs = (value: number | null): Precision | undefined =>
  isSigFigs(value) ? value : undefined;

export function useHyperliquidOrderbook(
  symbol: string,
  enabled = true,
  options: UseHyperliquidOrderbookOptions = {},
) {
  const [error, setError] = useState<string | null>(null);

  const controlledNSigFigs = options.controlledNSigFigs;
  const activeSigFigs = controlledNSigFigs === undefined ? DEFAULT_SIG_FIGS : controlledNSigFigs;

  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const subscriptionSigFigs = toSubscriptionSigFigs(activeSigFigs);
  const orderbookKey = orderbookStoreKey(coin, subscriptionSigFigs ?? null);

  // The first l2Book frame is a full snapshot, so there is no REST seed. Until
  // it lands `orderbook` is undefined and the widget renders its loading state.
  const orderbook = useOrderbookData(orderbookKey);

  const subscription = useMemo(
    () =>
      enabled && coin !== ""
        ? {
            channel: "l2Book" as const,
            symbol: coin,
            nSigFigs: subscriptionSigFigs,
          }
        : null,
    [enabled, coin, subscriptionSigFigs],
  );

  const ws = useHyperliquidWs({
    subscription,
    enabled: enabled && symbol !== "",
    onError: (e) => {
      setError(e.message);
    },
  });

  return {
    orderbook,
    isConnected: ws.isConnected,
    error,
    activeSigFigs,
  };
}
