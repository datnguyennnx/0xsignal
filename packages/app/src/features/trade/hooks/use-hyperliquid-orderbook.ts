import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { InfoClient, Transport } from "@0xsignal/sdk-hyperliquid";
import { bookWriteMeta, useHyperliquidWs } from "./use-hyperliquid-ws";
import { normalizeSymbol } from "../lib/symbol";
import { useMarketDataStore, useOrderbookData } from "@/stores/use-market-data-store";
import { orderbookStoreKey } from "../lib/orderbook-book";
import { selectOrderbookError } from "../lib/orderbook-error";
import { isL2BookSnapshotPayload } from "../utils/market-stream-decoder";
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
  opts.push({ value: 0, label: "Raw", nSigFigs: null, mantissa: null });
  return opts;
}

interface UseHyperliquidOrderbookOptions {
  controlledNSigFigs?: number | null;
}

const HL_INFO_URL = "https://api.hyperliquid.xyz";

let orderbookClient: InfoClient | null = null;

const getOrderbookClient = (): InfoClient => {
  orderbookClient ??= new InfoClient(
    new Transport({ baseUrl: HL_INFO_URL, timeoutMs: 10_000, retries: 0 }),
  );
  return orderbookClient;
};

const toSubscriptionSigFigs = (value: number | null): Precision | undefined =>
  isSigFigs(value) ? value : undefined;

export function orderbookSeedQueryKey(
  coin: string,
  nSigFigs: number | null,
): readonly ["market", "orderbook", "seed", string] {
  return ["market", "orderbook", "seed", orderbookStoreKey(coin, nSigFigs)];
}

export function useHyperliquidOrderbook(
  symbol: string,
  enabled = true,
  options: UseHyperliquidOrderbookOptions = {},
) {
  const [rawError, setRawError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [wsBookKey, setWsBookKey] = useState<string | null>(null);
  const wsReceivedKey = useRef<string | null>(null);

  const controlledNSigFigs = options.controlledNSigFigs;
  const activeSigFigs = controlledNSigFigs === undefined ? DEFAULT_SIG_FIGS : controlledNSigFigs;

  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const subscriptionSigFigs = toSubscriptionSigFigs(activeSigFigs);
  const orderbookKey = orderbookStoreKey(coin, subscriptionSigFigs ?? null);

  const orderbook = useOrderbookData(orderbookKey);
  const applySnapshot = useMarketDataStore((s) => s.applyOrderbookSnapshot);
  const hasWsBook = wsBookKey === orderbookKey;

  const { data: restSnapshot } = useQuery({
    queryKey: orderbookSeedQueryKey(coin, subscriptionSigFigs ?? null),
    queryFn: () =>
      getOrderbookClient().l2Book({
        coin,
        ...(subscriptionSigFigs !== undefined && { nSigFigs: subscriptionSigFigs }),
      }),
    enabled: enabled && coin !== "" && !hasWsBook,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (restSnapshot === undefined || wsReceivedKey.current === orderbookKey) return;
    applySnapshot(orderbookKey, [[...restSnapshot.levels[0]], [...restSnapshot.levels[1]]]);
  }, [restSnapshot, applySnapshot, orderbookKey]);

  const handleBookMessage = useCallback(
    (data: unknown, channel: string) => {
      if (channel !== "l2Book" || !isL2BookSnapshotPayload(data)) return;
      wsReceivedKey.current = orderbookKey;
      setWsBookKey(orderbookKey);
      applySnapshot(orderbookKey, [[...data.levels[0]], [...data.levels[1]]], bookWriteMeta(data));
    },
    [applySnapshot, orderbookKey],
  );

  const subscription = useMemo(
    () =>
      enabled && coin !== ""
        ? {
            channel: "l2Book" as const,
            symbol: coin,
            nSigFigs: subscriptionSigFigs,
            retryToken,
          }
        : null,
    [enabled, coin, subscriptionSigFigs, retryToken],
  );

  const ws = useHyperliquidWs({
    subscription,
    enabled: enabled && symbol !== "",
    onMessage: handleBookMessage,
    onError: (e) => {
      setRawError(e.message);
    },
  });

  const error = selectOrderbookError(rawError, ws.isConnected);

  const retry = useCallback(() => {
    setRawError(null);
    setRetryToken((token) => token + 1);
  }, []);

  return {
    orderbook,
    isConnected: ws.isConnected,
    error,
    retry,
    activeSigFigs,
  };
}
