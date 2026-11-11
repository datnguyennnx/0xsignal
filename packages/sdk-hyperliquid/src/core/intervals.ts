/**
 * @hyperliquid-api candle interval
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions.md
 */

export type CandleInterval =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "8h"
  | "12h"
  | "1d"
  | "3d"
  | "1w"
  | "1M";
