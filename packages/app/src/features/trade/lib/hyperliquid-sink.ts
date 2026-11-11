import { WsClient } from "@0xsignal/sdk-hyperliquid";
import type { WsActiveAssetCtx, WsTrade } from "@0xsignal/sdk-hyperliquid/subscription";
import type { DirectMarketSink } from "./hl-market-stream";
import type { DirectHandle } from "./direct-stream-failure";
import { createBookStream } from "./l2-book-stream";

// Browser-direct market data; the backend hub is the fallback.
const HL_MARKET_WS_URL = "wss://api.hyperliquid.xyz/ws";

type SdkHandle = ReturnType<WsClient["subscribe"]>;

const onErrorOption = (onError: (error: Error) => void) => ({
  onError: (error: unknown) => {
    onError(error instanceof Error ? error : new Error(String(error)));
  },
});

const toHandle = (handle: SdkHandle): DirectHandle => ({
  unsubscribe: () => handle.unsubscribeAsync(),
});

let marketClient: WsClient | null = null;

const sharedMarketClient = (): WsClient =>
  (marketClient ??= new WsClient({ url: HL_MARKET_WS_URL, shouldReconnect: true }));

export function subscribeAssetCtx(
  coin: string,
  listener: (ctx: WsActiveAssetCtx["ctx"]) => void,
  onError?: (error: unknown) => void,
): () => void {
  const handle = sharedMarketClient().subscribe(
    { type: "activeAssetCtx", coin },
    (payload: WsActiveAssetCtx) => {
      listener(payload.ctx);
    },
    { onError: (error) => onError?.(error) },
  );
  return () => {
    handle.unsubscribe();
  };
}

function subscribeTrades(
  coin: string,
  listener: (trades: readonly WsTrade[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  const handle = sharedMarketClient().subscribe(
    { type: "trades", coin },
    (payload: readonly WsTrade[]) => {
      listener(payload);
    },
    { onError: (error) => onError?.(error) },
  );
  return () => {
    handle.unsubscribe();
  };
}

export type HyperliquidSink = DirectMarketSink & {
  subscribeAssetCtx: typeof subscribeAssetCtx;
};

export function createHyperliquidSink(): HyperliquidSink {
  const client = sharedMarketClient();
  const books = createBookStream({ url: HL_MARKET_WS_URL });

  return {
    allMids: (listener, onError) =>
      Promise.resolve().then(() =>
        toHandle(client.subscribe({ type: "allMids" }, listener, onErrorOption(onError))),
      ),
    l2Book: (params, listener, onError) => {
      const handle = books.subscribe(params, listener, onError);
      return Promise.resolve({
        unsubscribe: () => {
          handle.unsubscribe();
          return Promise.resolve();
        },
      });
    },
    candle: (params, listener, onError) =>
      Promise.resolve().then(() =>
        toHandle(
          client.subscribe(
            { type: "candle", coin: params.coin, interval: params.interval },
            listener,
            onErrorOption(onError),
          ),
        ),
      ),
    trades: (params, listener, onError) =>
      Promise.resolve().then(() => {
        const unsubscribe = subscribeTrades(
          params.coin,
          (trades) => {
            listener(trades);
          },
          onErrorOption(onError).onError,
        );
        return {
          unsubscribe: () => {
            unsubscribe();
            return Promise.resolve();
          },
        };
      }),
    subscribeAssetCtx,
  };
}
