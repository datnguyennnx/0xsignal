/**
 * Shared boundary types for market-data domain.
 *
 * Single source of truth for API contract types.
 * Backend validates against these shapes (via Effect Schema internally).
 * Frontend imports these types directly — no runtime dependency.
 */

// ─── Candle ───────────────────────────────────────────────────────────────────

export interface Candle {
  readonly timestamp: Date;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

// ─── Market Ticker ────────────────────────────────────────────────────────────

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

// ─── Order Book ───────────────────────────────────────────────────────────────

export type OrderBookLevel = readonly [px: number, sz: number, n?: string | null];

export interface OrderBook {
  readonly symbol: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
  readonly levels: readonly [bids: OrderBookLevel[], asks: OrderBookLevel[]];
}

// ─── Trade Annotation ─────────────────────────────────────────────────────────

export interface TradeAnnotation {
  readonly symbol: string;
  readonly annotation: unknown;
}

// ─── Market Type (Perp / Spot / Outcome) ──────────────────────────────────────

export type MarketTypeCategory = "perp" | "spot" | "outcome";

// ─── Aggregated Market (trade list / discover-markets) ────────────────────────

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
}

// ─── Coverage ─────────────────────────────────────────────────────────────────

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

// ─── Candle Response (wraps candles + provenance + coverage) ──────────────────

export interface CandleResponse {
  readonly candles: Candle[];
  readonly provenance: string;
  readonly coverage: CoverageResult;
}

// ─── Recent Candle Response ───────────────────────────────────────────────────

export interface RecentCandleResponse {
  readonly candles: Candle[];
  readonly provenance: string;
  readonly coverage: CoverageResult;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface HealthStatus {
  readonly status: "ok";
  readonly timestamp: Date;
  readonly uptime: number;
  readonly postgres: boolean;
}
