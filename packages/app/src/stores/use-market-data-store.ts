import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  createMarketStreamClient,
  type MarketStreamClient,
  type MarketStreamSubscription,
} from "@/features/trade/lib/market-stream-client";
import type { WsMarketChannel } from "@0xsignal/shared";

export interface MarketDataState {
  marketStreamClient: MarketStreamClient | null;
  activeSubscriptions: Record<string, MarketStreamSubscription>;
  tickers: Record<string, unknown>;
  orderbookDeltas: Record<string, unknown>;

  initializeStreamClient: () => MarketStreamClient;
  subscribe: (symbol: string, channel: string) => Promise<void>;
  unsubscribe: (symbol: string, channel: string) => void;
  updateTicker: (symbol: string, data: unknown) => void;
  updateOrderbook: (symbol: string, data: unknown) => void;
}

export const useMarketDataStore = create<MarketDataState>()(
  subscribeWithSelector((set, get) => ({
    marketStreamClient: null,
    activeSubscriptions: {},
    tickers: {},
    orderbookDeltas: {},

    initializeStreamClient: () => {
      const existing = get().marketStreamClient;
      if (existing) return existing;
      const client = createMarketStreamClient();
      set({ marketStreamClient: client });
      return client;
    },

    subscribe: async (symbol: string, channel: string) => {
      const client = get().initializeStreamClient();
      const subscriptionKey = `${symbol}:${channel}`;

      // Skip if already subscribed
      if (get().activeSubscriptions[subscriptionKey]) return;

      const subscription = {
        channel: channel as WsMarketChannel,
        symbol,
      };

      const wsSubscription = await client.subscribe(subscription, {
        onMessage: (data, msgChannel) => {
          if (msgChannel === "l2Book") {
            get().updateOrderbook(symbol, data);
          } else {
            get().updateTicker(symbol, data);
          }
        },
        onError: (error: Error) => {
          console.error(`[MarketDataStore] Stream error for ${subscriptionKey}:`, error);
        },
      });

      set((state) => ({
        activeSubscriptions: {
          ...state.activeSubscriptions,
          [subscriptionKey]: wsSubscription,
        },
      }));
    },

    unsubscribe: (symbol: string, channel: string) => {
      const subscriptionKey = `${symbol}:${channel}`;
      const sub = get().activeSubscriptions[subscriptionKey];
      if (sub) {
        sub.unsubscribe();
        set((state) => {
          const remaining = { ...state.activeSubscriptions };
          delete remaining[subscriptionKey];
          return { activeSubscriptions: remaining };
        });
      }
    },

    updateTicker: (symbol: string, data: unknown) => {
      set((state) => ({
        tickers: { ...state.tickers, [symbol]: data },
      }));
    },

    updateOrderbook: (symbol: string, data: unknown) => {
      set((state) => ({
        orderbookDeltas: { ...state.orderbookDeltas, [symbol]: data },
      }));
    },
  })),
);
