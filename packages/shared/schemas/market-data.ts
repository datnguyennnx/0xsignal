/**
 * Market-data API contract types.
 * Single source of truth — no runtime deps.
 */

import type { DecimalString } from "@0xsignal/sdk-hyperliquid";
import type { CandleInterval } from "@0xsignal/sdk-hyperliquid/info";

// Candle

/**
 * A single OHLCV candle. `t` is the candle's open time in epoch milliseconds;
 * the provider normalizer emits this one shape.
 */
export interface Candle {
  readonly t: number;
  readonly open: DecimalString;
  readonly high: DecimalString;
  readonly low: DecimalString;
  readonly close: DecimalString;
  readonly volume: DecimalString;
  readonly T: number;
  readonly n: number;
  readonly i: CandleInterval;
  readonly s: string;
}

// Market Ticker

export interface MarketTicker {
  readonly symbol: string;
  readonly mid: DecimalString | null;
  readonly markPx: DecimalString | null;
  readonly midPx: DecimalString | null;
  readonly prevDayPx: DecimalString | null;
  readonly dayNtlVlm: DecimalString | null;
  readonly openInterest: DecimalString | null;
  readonly funding: DecimalString | null;
}

// Order Book

/** Single L2 orderbook level as it appears on the wire. */
export interface OrderBookLevel {
  readonly px: string;
  readonly sz: string;
  readonly n: number;
}

export interface OrderBook {
  readonly symbol: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5 | null;
  readonly orderbook?: {
    readonly levels: readonly [bids: OrderBookLevel[], asks: OrderBookLevel[]];
  };
}

// Market Type (Perp / Spot)

export type MarketTypeCategory = "perp" | "spot";

export interface EvmContractDescriptor {
  readonly address: string;
  readonly evm_extra_wei_decimals: number;
}

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
  readonly circulatingSupply?: string | undefined;
  /** Spot-specific: EVM contract address. */
  readonly evmContract?: string | undefined;
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

export type RecentCandleResponse = CandleResponse;

// Health

export interface HealthStatus {
  readonly status: "ok";
  readonly timestamp: Date;
  readonly uptime: number;
  readonly postgres: boolean;
}

// WebSocket Market Stream

export type WsMarketChannel = "candle" | "l2Book" | "allMids";

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
  "3d",
  "1w",
  "1M",
] as const satisfies readonly CandleInterval[];

export type WsMarketInterval = (typeof WS_MARKET_INTERVALS)[number];

export interface WsMarketSubscription {
  readonly channel: WsMarketChannel | "trades";
  readonly symbol?: string | undefined;
  readonly interval?: WsMarketInterval | undefined;
  readonly nSigFigs?: 2 | 3 | 4 | 5 | null | undefined;
  readonly dex?: string;
}
