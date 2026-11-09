import type { WsMarketSubscription } from "@0xsignal/shared";
import type { MarketStreamMeta } from "../utils/market-stream-decoder";
import type { BookMergeState } from "./l2-book-merge";

export interface MarketStreamCallbacks {
  onMessage: (data: unknown, channel: string, meta?: MarketStreamMeta) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: Error) => void;
}

export interface DirectHandle {
  unsubscribe(): Promise<void>;
}

/** Why a direct subscription dropped, and whether the index proved its coin. */
export type DirectFailure = { readonly validated: boolean; readonly coin: string };

export interface DirectEntry {
  readonly subscription: WsMarketSubscription;
  readonly frameSymbol: string;
  /** True when the coin came from the markets index; a raw perp guess sets false. */
  readonly validated: boolean;
  readonly registrations: Set<MarketStreamCallbacks>;
  readonly fallbacks: Map<MarketStreamCallbacks, { unsubscribe(): void }>;
  handles: DirectHandle[];
  book: BookMergeState | null;
  lastBookEvent: unknown;
  closed: boolean;
  directFailed: boolean;
}

export const failureOf = (entry: DirectEntry): DirectFailure => ({
  validated: entry.validated,
  coin: entry.subscription.symbol ?? entry.frameSymbol,
});

export interface DirectHooks {
  readonly onOpen?: () => void;
  readonly onFailure?: (error: Error, failure: DirectFailure) => void;
  /** Re-homes a live registration onto the hub when the direct socket drops. */
  readonly fallback?: (
    subscription: WsMarketSubscription,
    callbacks: MarketStreamCallbacks,
    reason: string,
  ) => Promise<{ unsubscribe(): void }>;
}
