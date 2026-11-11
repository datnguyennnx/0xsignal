/**
 * @hyperliquid-api wss://api.hyperliquid.xyz/ws
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions.md
 */

import type { Subscription } from "./types";
import { decodeFastAssetCtxs } from "./deflate";

export const CHANNEL_OF = {
  allMids: "allMids",
  notification: "notification",
  webData3: "webData3",
  twapStates: "twapStates",
  clearinghouseState: "clearinghouseState",
  openOrders: "openOrders",
  candle: "candle",
  l2Book: "l2Book",
  trades: "trades",
  orderUpdates: "orderUpdates",
  userEvents: "user",
  userFills: "userFills",
  userFundings: "userFundings",
  userNonFundingLedgerUpdates: "userNonFundingLedgerUpdates",
  activeAssetCtx: "activeAssetCtx",
  activeAssetData: "activeAssetData",
  userTwapSliceFills: "userTwapSliceFills",
  userTwapHistory: "userTwapHistory",
  bbo: "bbo",
  spotState: "spotState",
  allDexsClearinghouseState: "allDexsClearinghouseState",
  allDexsAssetCtxs: "allDexsAssetCtxs",
  outcomeMetaUpdates: "outcomeMetaUpdates",
  fastAssetCtxs: "fastAssetCtxs",
} as const satisfies Record<Subscription["type"], string>;

export const MAX_CONNECTIONS = 10;
export const MAX_NEW_CONNECTIONS_PER_MIN = 30;
export const MAX_SUBSCRIPTIONS = 1000;
export const MAX_UNIQUE_USERS = 10;
export const MAX_MESSAGES_PER_MIN = 2000;
export const MAX_INFLIGHT_POSTS = 100;
export const HEARTBEAT_IDLE_MS = 60_000;

export function subscribeFrame(s: Subscription): {
  method: "subscribe";
  subscription: Subscription;
} {
  return { method: "subscribe", subscription: s };
}

export function unsubscribeFrame(s: Subscription): {
  method: "unsubscribe";
  subscription: Subscription;
} {
  return { method: "unsubscribe", subscription: s };
}

export const PING_FRAME = { method: "ping" } as const;

export function decodeData(channel: string, data: unknown): unknown {
  switch (channel) {
    case CHANNEL_OF.fastAssetCtxs:
      return typeof data === "string" ? decodeFastAssetCtxs(data) : data;
    default:
      return data;
  }
}
