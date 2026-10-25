/**
 * Hyperliquid /info weights from the official rate-limit table
 * (https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits);
 * the per-IP budget is 1200 weight per minute.
 */
export type InfoOperation =
  | "allMids"
  | "l2Book"
  | "clearinghouseState"
  | "spotClearinghouseState"
  | "orderStatus"
  | "meta"
  | "spotMeta"
  | "metaAndAssetCtxs"
  | "spotMetaAndAssetCtxs"
  | "candleSnapshot"
  | "userFills"
  | "frontendOpenOrders";

export const INFO_WEIGHTS: Record<InfoOperation, number> = {
  allMids: 2,
  l2Book: 2,
  clearinghouseState: 2,
  spotClearinghouseState: 2,
  orderStatus: 2,
  meta: 20,
  spotMeta: 20,
  metaAndAssetCtxs: 20,
  // The spot twin of metaAndAssetCtxs carries the same heavy metadata payload.
  spotMetaAndAssetCtxs: 20,
  candleSnapshot: 20,
  userFills: 20,
  frontendOpenOrders: 20,
};

/**
 * Candle snapshots cost 20 plus one extra weight per 60 requested items.
 * The table's flat 20 only covers a request of fewer than 60 candles.
 */
export const candleSnapshotWeight = (count: number): number =>
  INFO_WEIGHTS.candleSnapshot + Math.floor(Math.max(0, count) / 60);

/**
 * Operations the published table does not name keep the old flat estimate:
 * charging them as heavy would starve the limiter without documentation.
 */
export const UNLISTED_INFO_WEIGHT = 2;
