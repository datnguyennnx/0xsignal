/**
 * Market-data API contract types.
 * Single source of truth — no runtime deps.
 */

// Candle

/**
 * A single OHLCV candle.
 *
 * `timestamp` reflects the candle's open time. After JSON deserialization
 * on the client, `timestamp` arrives as an ISO-8601 string; server-side it
 * may be a `Date` object. Consumers should use `candleToChartDataPoint`
 * (from `@0xsignal/shared`) which handles all three formats transparently.
 */
export interface Candle {
  readonly timestamp: Date | string | number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

// Market Ticker

export interface MarketTicker {
  readonly symbol: string;
  readonly mid: number | null;
  readonly markPx: number | null;
  readonly midPx: number | null;
  readonly prevDayPx: number | null;
  readonly dayNtlVlm: number | null;
  readonly openInterest: number | null;
  readonly funding: number | null;
}

// Order Book

export type OrderBookLevel = readonly [px: number, sz: number, n?: string | null];

export interface OrderBook {
  readonly symbol: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
  readonly orderbook?: {
    readonly levels: readonly [
      bids: { px: string; sz: string; n: number }[],
      asks: { px: string; sz: string; n: number }[],
    ];
  };
}

// Trade Annotation

export interface TradeAnnotation {
  readonly symbol: string;
  readonly annotation: unknown;
}

// Market Type (Perp / Spot)

export type MarketTypeCategory = "perp" | "spot";

// Aggregated Market

export interface AggregatedMarket {
  readonly coin: string;
  readonly rawCoin: string;
  readonly displaySymbol: string;
  readonly dexPrefix: string | null;
  readonly isHip3: boolean;
  readonly quoteCurrency: string;
  readonly name: string;
  readonly category: string;
  readonly displayCategory: string;
  readonly isDelisted: boolean;
  readonly dex: string;
  readonly assetId: number;
  readonly marketType: MarketTypeCategory;
  readonly markPx: string;
  readonly prevDayPx: string;
  readonly openInterest: string;
  readonly funding: string;
  readonly dayNtlVlm: string;
  readonly maxLeverage: number;
  readonly szDecimals: number;
  /** Spot-specific: circulating supply for market cap calculation. */
  readonly circulatingSupply?: string;
  /** Spot-specific: EVM contract address. */
  readonly evmContract?: string;
}

// Coverage

export interface CoverageWindow {
  readonly start: Date;
  readonly end: Date;
}

export interface CoverageResult {
  readonly hasData: boolean;
  readonly rowCount: number;
  readonly expectedCount: number;
  readonly fullCoverage: boolean;
  readonly missingWindows: CoverageWindow[];
}

// Candle Response

export interface CandleResponse {
  readonly candles: Candle[];
  readonly provenance: string;
  readonly coverage: CoverageResult;
}

// Recent Candle Response

export interface RecentCandleResponse {
  readonly candles: Candle[];
  readonly provenance: string;
  readonly coverage: CoverageResult;
}

// Health

export interface HealthStatus {
  readonly status: "ok";
  readonly timestamp: Date;
  readonly uptime: number;
  readonly postgres: boolean;
}

// WebSocket Market Stream

export type WsMarketChannel = "candle" | "l2Book" | "trades" | "allMids";

export const WS_MARKET_INTERVALS = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "8h",
  "12h",
  "1d",
  "1w",
] as const;

export type WsMarketInterval = (typeof WS_MARKET_INTERVALS)[number];

export interface WsMarketSubscription {
  readonly channel: WsMarketChannel;
  readonly symbol?: string;
  readonly interval?: WsMarketInterval;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
}
