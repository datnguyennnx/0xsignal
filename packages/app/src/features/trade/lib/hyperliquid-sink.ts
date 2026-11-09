import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import type { DirectMarketSink } from "./hl-market-stream";
import { bookFrameLeg } from "./l2-book-merge";

// Browser-direct market data; the backend hub is the fallback.
const HL_MARKET_WS_URL = "wss://api.hyperliquid.xyz/ws";

const onErrorOption = (onError: (error: Error) => void) => ({ onError });

export function createHyperliquidSink(): DirectMarketSink {
  const transport = new WebSocketTransport({ url: HL_MARKET_WS_URL, resubscribe: true });
  const client = new SubscriptionClient({ transport });

  return {
    allMids: (listener, onError) => client.allMids(listener, onErrorOption(onError)),
    l2Book: (params, listener, onError) => {
      const payload = {
        coin: params.coin,
        ...(params.nSigFigs !== undefined && { nSigFigs: params.nSigFigs }),
        ...(params.fast === true && { fast: true }),
      };
      const wantedLeg = params.fast === true ? "fast" : "slow";
      return client.l2Book(
        payload,
        (event) => {
          // One channel name, every listener: drop the other leg's frames.
          if (bookFrameLeg(event) !== wantedLeg) return;
          listener(event);
        },
        onErrorOption(onError),
      );
    },
    candle: (params, listener, onError) => client.candle(params, listener, onErrorOption(onError)),
  };
}
